// Load environment variables from .env
import dotenv from 'dotenv';
dotenv.config(); 

// Misc imports 
import processBlock from '../methods/block-processor/process-block'; 
import processBlockTxs from '../methods/block-processor/process-block-txs'; 
import * as Wrappers from '../lib/node-wrappers';
import { initHooks } from '../lib/chain-implementations';
import config from '../lib/utilities/config';
import { startServer as startHealthcheckServer } from '../lib/healthcheck';

const nodesToInit = config.mustEnabledChains();
console.log({nodesToInit});

// A collection of all initialized BlockchainNode instances. 
const nodes: { [key: string]: Wrappers.BlockchainWrapper } = {}; 

// Simple infinite loop terminator
var running = true; 

// A simple infinite execution loop that doesn't block the event loop. 
const nonBlockingInfiniteLoop = async (wrapper: Wrappers.BlockchainWrapper) => {
    try {
        if(wrapper.ticker === "ARBI"){
            await processBlockTxs(wrapper); 
        }else{
            await processBlock(wrapper); 
        }
        setTimeout(() => running && nonBlockingInfiniteLoop(wrapper) || null, 1); 
    } catch (error) {
        console.error(error);
        setTimeout(() => running && nonBlockingInfiniteLoop(wrapper) || null, 1); 
    }   
}

const run = async () => {
    if(nodesToInit.includes('BTC')) {
        const btcWrapper = new Wrappers.BTCWrapper(
            { username: 'user', password: 'pass', host: process.env.BTC_NODE as string, port: Number(process.env.BTC_NODE_PORT) || 8332 },
            { host: process.env.BTC_NODE as string, port: Number(process.env.BTC_NODE_ZMQPORT) || 28332 }); 

        nonBlockingInfiniteLoop(btcWrapper); 
    }

    if(nodesToInit.includes('BCH')) {
        const bchWrapper = new Wrappers.BCHWrapper(
            { username: 'user', password: 'pass', host: process.env.BCH_NODE as string, port: Number(process.env.BCH_NODE_PORT) || 8332 },
            { host: process.env.BCH_NODE as string, port: Number(process.env.BCH_NODE_ZMQPORT) || 28332 }); 

        nonBlockingInfiniteLoop(bchWrapper); 
    }

    if(nodesToInit.includes('XMR')) {
        const xmrWrapper = new Wrappers.XMRWrapper(process.env.XMR_NODE as string);

        nonBlockingInfiniteLoop(xmrWrapper); 
    }


    if(nodesToInit.includes('LTC')) {
        const ltcWrapper = new Wrappers.LTCWrapper(
            { username: 'user', password: 'pass', host: process.env.LTC_NODE as string, port: Number(process.env.LTC_NODE_PORT) || 9332 },
            { host: process.env.LTC_NODE as string, port: Number(process.env.LTC_NODE_ZMQPORT) || 28332 }); 

        nonBlockingInfiniteLoop(ltcWrapper); 
    }

    if(nodesToInit.includes('ETH')) {
        const ethWrapper = config.initEthWrapper();

        nonBlockingInfiniteLoop(ethWrapper); 
    }

    if(nodesToInit.includes('ARBI')) {
        initHooks("ARBI");
        const arbiWrapper = new Wrappers.ARBIWrapper();
        nonBlockingInfiniteLoop(arbiWrapper); 
    }

    if(nodesToInit.includes('RINKEBY')) {
        const rinkebyWrapper = new Wrappers.RINKEBYWrapper(process.env.RINKEBY_NODE as string); 

        nonBlockingInfiniteLoop(rinkebyWrapper); 
    }
}

startHealthcheckServer();
run(); 
