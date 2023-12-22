import fs from 'fs';
import path from 'path';
import { setInterval } from "../../../utils/OverlapProtectedInterval";
import { BTCBlocksSchema, BTCTransactionsSchema } from '../../../../../data/schemas';
import { ProjectedBTCBlock, ProjectedBTCTransaction } from "../../../types";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import tps from '../../common/tps';
import ctps from '../../common/ctps';
import bps from '../bps';
import medianBlockSize from '../../common/medianBlockSize';
import medianBlockTime from '../../common/medianBlockTime';
import medianTxsPerBlock from '../../common/medianTxsPerBlock';
import difficulty from '../../common/difficulty';
import blockHeight from '../../common/blockHeight';

import medianFeeSatPerByte from '../medianFee-satPerByte';
import medianFeeUsd from '../medianFee-usd';

// The last value(s) calculated during the execution of this task. 
let lastExecutionResults = {
    'tps': 0,
    'ctps': 0,
    'bps': 0,
    'difficulty': 0,
    'blockHeight': 0,
    'medianBlockSize': 0,
    'medianBlockTime': 0,
    'medianTxsPerBlock': 0,
    'medianFee-satPerByte': 0,
    'medianFee-usd': 0,
}; 

let lastKnownBlock: ProjectedBTCBlock = null;

setInterval(async () => {
    try {
        // Initialize connection to the database 
        const { database } = await mongodb();
        const collection = database.collection('statistic_updates'); 

        const initTasks: Promise<void>[] = [];

        let pricePerIncrement = 0; 
        let transactions: ProjectedBTCTransaction[] = [];
        let blocks: ProjectedBTCBlock[] = []; 
        let last250Blocks: ProjectedBTCBlock[] = []; 

        // Create the task to obtain the current BTC price. 
        initTasks.push(new Promise((resolve, reject) => {
            database.collection('statistics').findOne({ chain: 'BTC' }, { fiatPrice: 1 })
                .then((document: any) => {
                    pricePerIncrement = document['fiatPrice-usd'] * 0.00000001;
                    return resolve();
                })
                .catch(reject); 
        }));
        
        // Create the task to load the BTC transactions collection from disk. 
        initTasks.push(new Promise((resolve, reject) => {
            const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'transactions-BTC.bin'); 
            fs.readFile(dataPath, (err: NodeJS.ErrnoException, data: Buffer) => {
                if(err) return reject(err); 

                try {
                    // Use avsc to parse the schema.
                    let parsed = BTCTransactionsSchema.fromBuffer(data); 

                    // Create the values that will be used to filter the 5-minute window (+1); 
                    const now = Date.now();
                    const oneSecond = 1000 * 1;
                    const upperRange = now - oneSecond; 
                    const lowerRange = now - ((oneSecond * 60) * 5) - oneSecond;

                    // Filter the collection to obtain the transactions within the specified range. 
                    transactions = parsed.collection.filter((transaction: ProjectedBTCTransaction) => transaction.insertedAt >= lowerRange && transaction.insertedAt <= upperRange);
                    transactions = transactions.sort((a: ProjectedBTCTransaction, b: ProjectedBTCTransaction) => a.insertedAt - b.insertedAt);
                    console.log(`Found ${transactions.length} transactions in last 5 minutes.`);
                    return resolve();  
                } catch (error) {
                    console.error(error);
                    console.log('Attempting to decode schema...'); 
                    try { console.log(`Decoded information for error:`, BTCTransactionsSchema.decode(data)); } catch (error) { console.log('Schema could not be decoded.') }  
                    return reject(error); 
                }
            }); 
        }));

        
        // Create the task to load the BTC blocks collection from disk.
        initTasks.push(new Promise((resolve, reject) => {
            const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'blocks-BTC.bin'); 
            fs.readFile(dataPath,  (err: NodeJS.ErrnoException, data: Buffer) => {
                if(err) return reject(err); 

                try {
                    // Use avsc to parse the schema.
                    let parsed = BTCBlocksSchema.fromBuffer(data); 

                    // Create the values that will be used to filter the 1-hour window (+1); 
                    const now = Math.floor(Date.now() / 1000);
                    const oneSecond = 1;
                    const upperRange = now - oneSecond; 
                    const lowerRange = now - ((oneSecond * 60) * 60) - oneSecond;

                    // Filter the collection to obtain the transactions within the specified range. 
                    last250Blocks = parsed.collection.sort((a: ProjectedBTCBlock, b: ProjectedBTCBlock) => a.height - b.height).slice(0,250); 
                    blocks = parsed.collection.filter((block: ProjectedBTCBlock) => block.timestamp >= lowerRange && block.timestamp <= upperRange);
                    blocks = blocks.sort((a: ProjectedBTCBlock, b: ProjectedBTCBlock) => a.height - b.height); 
                    lastKnownBlock = blocks[blocks.length - 1]; 

                    if(!lastKnownBlock || !blocks.length) {
                        lastKnownBlock = parsed.collection.sort((a: ProjectedBTCBlock, b: ProjectedBTCBlock) => b.height - a.height)[0]; 
                        blocks = [lastKnownBlock];
                    }

                    return resolve();  
                } catch (error) {
                    console.error(error);
                    console.log('Attempting to decode schema...'); 
                    try { console.log(`Decoded information for error:`, BTCBlocksSchema.decode(data)); } catch (error) { console.log('Schema could not be decoded.') }
                    return reject(error); 
                }
            }); 
        }));

        await Promise.all(initTasks);

        // These tasks are all individually wrapped because their failures are not task-haulting. Even if one of these tasks fail to execute, 
        // the others can execute and if they depend on the failed task the lastExecutionResult will be available to use. 
        try { lastExecutionResults['tps'] = await tps(transactions); } catch (error) { console.error(error); };
        try { lastExecutionResults['ctps'] = await ctps(blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['bps'] = await bps(transactions); } catch (error) { console.error(error); };
        try { lastExecutionResults['medianBlockSize'] = await medianBlockSize(blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['medianBlockTime'] = await medianBlockTime(last250Blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['medianTxsPerBlock'] = await medianTxsPerBlock(blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['blockHeight'] = await blockHeight(lastKnownBlock); } catch (error) { console.error(error); };
        try { lastExecutionResults['difficulty'] = (await difficulty(lastKnownBlock)) as number; } catch (error) { console.error(error); };
        try { lastExecutionResults['medianFee-satPerByte'] = (await medianFeeSatPerByte(transactions)) as number; } catch (error) { console.error(error); };
        try { lastExecutionResults['medianFee-usd'] = (await medianFeeUsd(pricePerIncrement, transactions)) as number; } catch (error) { console.error(error); };
    } catch (error) {
        console.error(error); 
    } finally {
        // Wrapping a try/catch inside of a finally looks a little messy, but it's required to prevent a critical failure in the event
        // of a database error. We do this in finally so that we can make sure to update values that have successfully updated in the event
        // of an error.
        try {
            const { database } = await mongodb();
            const collection = database.collection('statistics');

            if(process.env.UPDATE_DATABASES.toLowerCase() == "true") {
                // TODO: Optimize to not re-insert data to lower bandwidth consumption. 
                await collection.updateOne({ chain: 'BTC' }, { $set: lastExecutionResults }); 
                redis.publish('stats', JSON.stringify({ chain: "BTC", ...lastExecutionResults })); 
            } else {
                console.log('=========================')
                console.log(lastExecutionResults);
            }
        } catch (error) {
            console.error(error); 
        }
    }
}, 1000).start(true);