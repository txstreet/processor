import ChainImplementation from '../../implementation'; 
import { decodeHex } from '../../../../lib/utilities';
import axios from 'axios'; 
import bchaddr from 'bchaddrjs-slp'; 
import redis from '../../../../databases/redis'; 
import mongodb from '../../../../databases/mongodb'; 

class SLP extends ChainImplementation {
    public _what: any = {}; 
    async init(): Promise<ChainImplementation> {
        return this;
    }

    async validate(transaction: any): Promise<boolean> {
        return true;
    }

    async execute(transaction: any): Promise<boolean> {
        for(let i = 0; i < transaction.asmArrays.length; i++) {
            const asmArray = transaction.asmArrays[i];
            const op_return = asmArray[0] === "OP_RETURN";
            if(!op_return) continue; 
            
            const code = asmArray[1]; 
            console.log(`Code:`, code);
            const links: any[] = []; 
            switch(code) {
                case "534c5000":
                case "5262419":
                    if(asmArray.length < 5) return false;
                    let type = decodeHex(asmArray[3]);
                    let token: any = false;
                    let ticker: any = false;
                    let decimals: any = false;
                    let amount: any = false;
                    let houseContent: any = false;
                    let handled = false; 
                    switch(type){
                        case "GENESIS":
                            handled = true;
                            if(!transaction.extras)
                                transaction.extras = {}
                            transaction.extras.houseTween = 'post';
                            houseContent = "New Token Created (" + decodeHex(asmArray[4]) + ")";
                            break;
                        case "SEND":
                            handled = true;
                            if(!transaction.extras)
                                transaction.extras = {}
                            transaction.extras.houseTween = 'send';
                            token = await this._getToken(asmArray[4]);
                            ticker = (typeof token.symbol == "undefined" ? "Unknown" : token.symbol);
                            decimals = token.decimals;
                            amount = await this._calcSendAmount(decimals, asmArray, true, transaction);
                            houseContent = "Sent " + amount + " " + ticker;
                            break;
                        case "MINT":
                            handled = true;
                            if(!transaction.extras)
                                transaction.extras = {}
                            transaction.extras.houseTween = 'coins';
                            token = await this._getToken(asmArray[4]);
                            ticker = (typeof token.symbol == "undefined" ? "Unknown" : token.symbol);
                            decimals = (Number.isInteger(token.decimals)?token.decimals:0);
                            amount = parseInt(asmArray[6], 16) / Math.pow(10, decimals);
                            houseContent = "Minted " + amount + " " + ticker;
                            break;
                        case "COMMIT":
                            handled = true;
                            if(!transaction.extras)
                                transaction.extras = {}
                            transaction.extras.houseTween = 'check';
                            token = await this._getToken(asmArray[4]);
                            ticker = (typeof token.symbol == "undefined" ? "Unknown" : token.symbol);
                            houseContent = ticker + " Commit";
                            break;
                    }

                    if(!handled) return false;
                    if(!transaction.extras)
                        transaction.extras = {};
                    transaction.extras.houseContent = houseContent
                    transaction.extras.showBubble = true;
                    transaction.house = "slp"; 
                    links.push({l:"https://simpleledger.info/#tx/" + transaction.hash});
                    transaction.extras.l = links;
                    console.log("SLP Found a transaction:", transaction.hash);
        
            }
        }
        return true; 
    }

    _getToken = async (txid: string): Promise<any> => {
        console.log('_getToken for id:', txid); 
        try {
            let token: any = await redis.getAsync(`slp-${txid}`); 
            // console.log('Redis:', token); 
            if(token) return JSON.parse(token); 
            token = await this._getTokenFromDb(txid);
            if(token && token.json) {
                redis.setAsync(`slp-${txid}`, JSON.stringify(token.json), "EX", 3600); 
                return token.json; 
            }
        } catch (error) {
            console.error(error);
        }

        let response = await this._getFromBitcoinCom(txid);
        let ticker = response.symbol;
        if(ticker && ticker.length > 1){
            this._insertTickerToDb(txid, ticker, response);
            redis.setAsync("slp-" + txid, JSON.stringify(response), "EX", 3600);
            return response;
        }

    }

    _getTokenFromDb = async (txid: string) => {
        try {
            const { database } = await mongodb();
            return await database.collection('slp_genesis').findOne({ hash: txid }); 
        } catch (err) {
            console.error(err);
            return false; 
        }
    }

    _insertTickerToDb = async (txid: string, ticker: string, json: string) => {
        try {
            const { database } = await mongodb();
            await database.collection('slp_genesis').updateOne({ chain: ticker, hash: txid }, { $set: { json } }, { upsert: true }); 
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    _getFromBitcoinCom = async (txid: string) => {
        let url = "https://api.fullstack.cash/v4/slp/list/" + txid;
        try {
            var response = await axios.get(url);
            var data = response.data;
            return data;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    _calcSendAmount = async (decimals: number, array: any[], format=false, tx: any) => {
        if(typeof decimals === "undefined" || !Number.isInteger(decimals)) return "?";

        //find which ones to skip
        let inputAddresses = [];
        for (let i = 0; i < tx.inputs.length; i++) {
            let address = tx.inputs[i].address;
            if(typeof address === "undefined" || !address || address.length < 10){
                continue;
            }
            inputAddresses.push(await this._toCashAddress(address));
        }

        let total = 0;
        for (let i = 0; i < array.length; i++) {
            if(i < 5) continue;
            // let outputIndex = i-4;
            let outputAddress = tx.outputs[i-4].address;
            if(typeof outputAddress !== "undefined" && outputAddress && outputAddress.length > 9){
                outputAddress = await this._toCashAddress(outputAddress);
                if(inputAddresses.includes(outputAddress)) continue;
            }
            let hexValue = array[i];
            total += parseInt(hexValue, 16);
        }
        let float: number|string = total / Math.pow(10, decimals);
        if(format) float = float.toLocaleString('en-US', {maximumFractionDigits: 5});
        return float;
    }

    //TODO all conversions and cached addresses in a parent class
    _toCashAddress = async (address: string) => {
        let key = `toCashAddress-${address}`
        if(this._what[key]) return this._what[key]; 
        let cached: any = await redis.getAsync(key);
        if(!cached) {
            cached = bchaddr.toCashAddress(address); 
            redis.setAsync(key, cached, 'EX', 3600 * 72); 
        }
        this._what[key] = cached; 
        return cached; 
    }
}

export default new SLP('BCH'); 