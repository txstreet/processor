import ChainImplementation from '../../implementation'; 
import { decRound } from '../../../../lib/utilities';
// @ts-ignore-line
import abiDecoder from 'abi-decoder'; 
import tokenManager from "../../../../lib/utilities/tokenManager";

import contract_0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f from "./0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f.json";

import mongodb from '../../../../databases/mongodb'; 

const getToken = async (sushi: any, address: string) => {
    const tokenInfo = await sushi.tokenManager.getToken(address);
    return tokenInfo;
}

const tknSymbol = (token: any) => {
    if (!token || !token.symbol) return "???";
    return token.address === "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" ? "ETH" : token.symbol;
}

const swapPart = (token: any, amount: number, transaction: any) => {
    if (!token || !amount) return "???";
    const fullAmount = amount / Math.pow(10, token.decimals);
    if (token.address == "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" && fullAmount >= 25) {
        transaction.extras.showBubble = true;
    }
    return decRound(fullAmount) + " " + tknSymbol(token);
}

const swap = async (sushi: any, address1: string, amount1: number, address2: string, amount2: number, transaction: any) => {
    const token1 = await getToken(sushi, address1);
    const token2 = await getToken(sushi, address2);

    const inSwap = swapPart(token1, amount1, transaction);
    const outSwap = swapPart(token2, amount2, transaction);
    let message = inSwap + " ➞ " + outSwap;
    if (message.includes("e-")) return false;
    if (message.includes("???")) transaction.extras.showBubble = false;
    transaction.extras.erc20Swap = {
        from: {
            token: address1,
            amount: Number(amount1)
        },
        to: {
            token: address2,
            amount: Number(amount2)
        }
    }
    transaction.extras.houseContent = message;
    return message;
}


const getData = async (sushi:any, transaction: any): Promise<string | boolean> => {
    try {
        if(transaction.to.toLowerCase() != "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f" || !transaction.input) return false;
        const decoded: any = abiDecoder.decodeMethod(transaction.input); 
        if(!decoded || !decoded.name) return false;
        if (decoded.name == "swapExactTokensForETH" 
            || decoded.name == "swapExactTokensForTokens" 
            || decoded.name == "swapExactTokensForETHSupportingFeeOnTransferTokens" 
            || decoded.name == "swapExactTokensForTokensSupportingFeeOnTransferTokens") {
            const address1 = decoded.params[2].value[0];
            const amount1 = decoded.params[0].value;
            const address2 = decoded.params[2].value[decoded.params[2].value.length - 1];
            const amount2 = decoded.params[1].value;

            return await swap(sushi, address1, amount1, address2, amount2, transaction);
        } else if (decoded.name == "swapExactETHForTokens" 
            || decoded.name == "swapETHForExactTokens" 
            || decoded.name == "swapExactETHForTokensSupportingFeeOnTransferTokens") {
            const address1 = decoded.params[1].value[0];
            const amount1 = transaction.value;
            const address2 = decoded.params[1].value[decoded.params[1].value.length - 1];
            const amount2 = decoded.params[0].value;

            return await swap(sushi, address1, amount1, address2, amount2, transaction);
        } else if (decoded.name == "swapTokensForExactTokens" || decoded.name == "swapTokensForExactETH") {
            const address1 = decoded.params[2].value[0];
            const amount1 = decoded.params[1].value;
            const address2 = decoded.params[2].value[decoded.params[2].value.length - 1];
            const amount2 = decoded.params[0].value;

            return await swap(sushi, address1, amount1, address2, amount2, transaction);
        } else if (decoded.name == "addLiquidity" 
            || decoded.name == "removeLiquidityWithPermit" 
            || decoded.name == "removeLiquidity") {
            const address1 = decoded.params[0].value;
            const address2 = decoded.params[1].value;
            const token1 = await getToken(sushi,address1);
            const token2 = await getToken(sushi,address2);
            const action = decoded.name == "addLiquidity" ? "Added " : "Removed ";
            const message = action + tknSymbol(token1) + "/" + tknSymbol(token2) + " liquidity";
            transaction.extras.houseContent = message;
        } else if (decoded.name == "addLiquidityETH" 
            || decoded.name == "removeLiquidityETHWithPermit" 
            || decoded.name == "removeLiquidityETH" 
            || decoded.name == "removeLiquidityETHSupportingFeeOnTransferTokens" 
            || decoded.name == "removeLiquidityETHWithPermitSupportingFeeOnTransferTokens") {
            const address1 = decoded.params[0].value;
            const token1 = await getToken(sushi,address1);
            const action = decoded.name == "addLiquidityETH" ? "Added " : "Removed ";
            const message = action + tknSymbol(token1) + "/ETH liquidity";
            transaction.extras.houseContent = message;
        } else if (decoded.name == "removeLiquidityETHWithPermit") {
            // unused
        } else {
            // console.log(decoded);
        }
        return true;
    } catch (error) {
        return false;
    }
}


class Sushi extends ChainImplementation {
    public addresses: string[] = []; 
    public tokenManager: any;

    async init(): Promise<ChainImplementation> {
        try {
            if(process.env.USE_DATABASE === "false")
                return this;
            const { database } = await mongodb(); 
            const collection = database.collection('houses'); 
            const result = await collection.findOne({ chain: this.chain, name: "sushi" });
            for (let i = 0; i < result.contracts.length; i++) {
              result.contracts[i] = result.contracts[i].toLowerCase();
            }
            this.addresses = result.contracts;

            abiDecoder.addABI(contract_0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f);

            this.tokenManager = new tokenManager('ETH');

            console.log('initialized sushi');
        } catch (error) {
            console.error(error);
        } finally {
            return this; 
        }
    }

    async validate(transaction: any): Promise<boolean> {
        return this.addresses.includes(transaction.to)
    }

    async execute(transaction: any): Promise<boolean> {
        if(transaction.house === "sushi") return true;
        transaction.house = 'sushi'; //ALWAYS SET!
        if(!transaction.extras) transaction.extras = {};
        if(await getData(this, transaction) && !transaction?.extras?.showBubble) {
            transaction.extras.showBubble = false;
        }
        return true;
    }
}

export default new Sushi("ETH");