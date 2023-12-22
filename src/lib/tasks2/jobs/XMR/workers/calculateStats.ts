import fs from 'fs';
import path from 'path';
import { XMRBlocksSchema, XMRTransactionsSchema } from '../../../../../data/schemas';
import { ProjectedXMRBlock, ProjectedXMRTransaction } from "../../../types";
import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';

import tps from '../../common/tps';
import ctps from '../../common/ctps';
import medianBlockSize from '../../common/medianBlockSize';
import medianBlockTime from '../../common/medianBlockTime';
import medianTxsPerBlock from '../../common/medianTxsPerBlock';
import difficulty from '../../common/difficulty';
import blockHeight from '../../common/blockHeight';
import bps from '../bps';
import medianFeeAByte from '../medianFee-aByte';
import medianFeeUsd from '../medianFee-usd';
import medianFeeFee from '../medianFee-fee';

// The last value(s) calculated during the execution of this task. 
let lastExecutionResults = {
    'tps': 0,
    'ctps': 0,
    'medianFee-usd': 0,
    'medianFee-aByte': 0, 
    'medianFee-fee': 0,
    'bps': 0,
    'blockHeight': 0,
    'difficulty': 0,
    'medianBlockTime': 0,
    'medianBlockSize': 0,
    'medianTxsPerBlock': 0,
}; 

let lastKnownBlock: ProjectedXMRBlock = null;

setInterval(async () => {
    try {
        // Initialize connection to the database 
        const { database } = await mongodb();
        const collection = database.collection('statistic_updates'); 

        const initTasks: Promise<void>[] = [];

        let pricePerIncrement = 0; 
        let transactions: ProjectedXMRTransaction[] = [];
        let blocks: ProjectedXMRBlock[] = []; 
        let last250Blocks: ProjectedXMRBlock[] = [];

        // Create the task to obtain the current ethereum price. 
        initTasks.push(new Promise((resolve, reject) => {
            database.collection('statistics').findOne({ chain: 'XMR' }, { fiatPrice: 1 })
                .then((document: any) => {
                    pricePerIncrement = document['fiatPrice-usd'] * .000000000001;
                    return resolve();
                })
                .catch(reject); 
        }));
        
        // Create the task to load the ethereum transactions collection from disk. 
        initTasks.push(new Promise((resolve, reject) => {
            const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'transactions-XMR.bin'); 
            fs.readFile(dataPath, (err: NodeJS.ErrnoException, data: Buffer) => {
                if(err) return reject(err); 

                try {
                    // Use avsc to parse the schema.
                    let parsed = XMRTransactionsSchema.fromBuffer(data); 

                    // Create the values that will be used to filter the 5-minute window (+1); 
                    const now = Date.now();
                    const oneSecond = 1000 * 1;
                    const upperRange = now - oneSecond; 
                    const lowerRange = now - ((oneSecond * 60) * 5) - oneSecond;

                    // Filter the collection to obtain the transactions within the specified range. 
                    transactions = parsed.collection.filter((transaction: ProjectedXMRTransaction) => transaction.insertedAt >= lowerRange && transaction.insertedAt <= upperRange);
                    transactions = transactions.sort((a: ProjectedXMRTransaction, b: ProjectedXMRTransaction) => a.insertedAt - b.insertedAt);
                    return resolve();  
                } catch (error) {
                    console.error(error);
                    console.log('Attempting to decode schema...'); 
                    try { console.log(`Decoded information for error:`, XMRTransactionsSchema.decode(data)); } catch (error) { console.log('Schema could not be decoded.') }  
                    return reject(error); 
                }
            }); 
        }));

        
        // Create the task to load the ethereum blocks collection from disk.
        initTasks.push(new Promise((resolve, reject) => {
            const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'blocks-XMR.bin'); 
            fs.readFile(dataPath,  (err: NodeJS.ErrnoException, data: Buffer) => {
                if(err) return reject(err); 

                try {
                    // Use avsc to parse the schema.
                    let parsed = XMRBlocksSchema.fromBuffer(data); 

                    // Create the values that will be used to filter the 1-hour window (+1); 
                    const now = Math.floor(Date.now() / 1000);
                    const oneSecond = 1;
                    const upperRange = now - oneSecond; 
                    const lowerRange = now - ((oneSecond * 60) * 60) - oneSecond;

                    // Filter the collection to obtain the transactions within the specified range. 
                    last250Blocks = parsed.collection.sort((a: ProjectedXMRBlock, b: ProjectedXMRBlock) => a.height - b.height).slice(0,250); 
                    blocks = parsed.collection.filter((block: ProjectedXMRBlock) => block.timestamp >= lowerRange && block.timestamp <= upperRange);
                    blocks = blocks.sort((a: ProjectedXMRBlock, b: ProjectedXMRBlock) => a.height - b.height); 
                    lastKnownBlock = blocks[blocks.length - 1]; 

                    return resolve();  
                } catch (error) {
                    console.error(error);
                    console.log('Attempting to decode schema...'); 
                    try { console.log(`Decoded information for error:`, XMRBlocksSchema.decode(data)); } catch (error) { console.log('Schema could not be decoded.') }
                    return reject(error); 
                }
            }); 
        }));

        await Promise.all(initTasks);

        // These tasks are all individually wrapped because their failures are not task-haulting. Even if one of these tasks fail to execute, 
        // the others can execute and if they depend on the failed task the lastExecutionResult will be available to use. 
        try { lastExecutionResults['tps'] = await tps(transactions); } catch (error) { console.error(error); };
        try { lastExecutionResults['ctps'] = await ctps(blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['medianBlockSize'] = await medianBlockSize(blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['medianBlockTime'] = await medianBlockTime(last250Blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['medianTxsPerBlock'] = await medianTxsPerBlock(blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['blockHeight'] = await blockHeight(lastKnownBlock); } catch (error) { console.error(error); };
        try { lastExecutionResults['difficulty'] = (await difficulty(lastKnownBlock)) as number; } catch (error) { console.error(error); };
        try { lastExecutionResults['bps'] = await bps(transactions); } catch (error) { console.error(error) }
        try { lastExecutionResults['medianFee-aByte'] = await medianFeeAByte(transactions);  } catch (error) { console.error(error) }
        try { lastExecutionResults['medianFee-usd'] = await medianFeeUsd(pricePerIncrement, transactions);  } catch (error) { console.error(error) }
        try { lastExecutionResults['medianFee-fee'] = await medianFeeFee(transactions) } catch (error) { console.error(error) }
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
                await collection.updateOne({ chain: 'XMR' }, { $set: lastExecutionResults }); 
                redis.publish('stats', JSON.stringify({ chain: "XMR", ...lastExecutionResults })); 
            } else {
                console.log('=========================')
                console.log(lastExecutionResults);
            }
        } catch (error) {
            console.error(error); 
        }
    }
}, 1000).start(true);