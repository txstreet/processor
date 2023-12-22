import ChainImplementation from '../../implementation'; 
import redis from '../../../../databases/redis'; 
// @ts-ignore-line
// import abiDecoder from 'abi-decoder'; 
// import axios from 'axios';

// import contract_0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f from "./0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f.json";

class Arbitrum extends ChainImplementation {

    async init(): Promise<ChainImplementation> {
        try {
            console.log('initialized arbitrum sequencer');
        } catch (error) {
            console.error(error);
        } finally {
            return this; 
        }
    }

    async validate(transaction: any): Promise<boolean> {
        return transaction.from.toLowerCase() === "0xc1b634853cb333d3ad8663715b08f41a3aec47cc" && transaction.to.toLowerCase() === "0x1c479675ad559dc151f6ec7ed3fbf8cee79582b6";
    }

    async execute(transaction: any): Promise<boolean> {
        if(transaction.house === "arbitrum") return true;
        transaction.house = 'arbitrum'; //ALWAYS SET!
        if(!transaction.extras) transaction.extras = {};
        transaction.extras.mailman = true;

        //send redis event for this hash
        redis.publish('arbiRollup', JSON.stringify({hash: transaction.hash}));


        // if(getData(this, transaction) && !transaction?.extras?.showBubble) {
        //     transaction.extras.showBubble = false;
        // }
        return true;
    }
}

export default new Arbitrum("ETH");