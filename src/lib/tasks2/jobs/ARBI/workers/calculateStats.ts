import fs from 'fs';
import path from 'path';
import { setInterval } from "../../../utils/OverlapProtectedInterval";
import { ETHBlocksSchema, ETHTransactionsSchema } from '../../../../../data/schemas';
import { ProjectedEthereumBlock, ProjectedEthereumTransaction } from "../../../types";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import gasUsedDif from '../../ETH/gasUsedDif';
import medianFeeGasPrice from '../../ETH/medianFee-gasPrice';
import medianFeeUsd from '../../ETH/medianFee-usd';
import medianFeeUsdTransfer from '../medianFee-usdTransfer';
// import tps from '../../common/tps';
import ctps from '../../common/ctps';
import medianBlockSize from '../../common/medianBlockSize';
import medianBlockTime from '../../common/medianBlockTime';
import medianTxsPerBlock from '../../common/medianTxsPerBlock';
// import difficulty from '../../common/difficulty';
import blockHeight from '../../common/blockHeight';
import baseFee from '../../ETH/baseFee';
// import tipPrice from '../tipPrice';
import gasTarget from '../../ETH/gasTarget';
import gasLimit from '../../ETH/gasLimit';
import medianGasUsed from '../../ETH/medianGasUsed';

// The last value(s) calculated during the execution of this task. 
let lastExecutionResults = {
    // 'tps': 0,
    'ctps': 0,
    // 'difficulty': '0',
    'blockHeight': 0,
    'baseFee': 0,
    // 'tipPrice': 0,
    'gasTarget': 0,
    'gasLimit': 0,
    'medianGasUsed': 0,
    'medianBlockSize': 0,
    'medianBlockTime': 0,
    'medianTxsPerBlock': 0,
    'medianFee-gasPrice': 0,
    'medianFee-usd': 0,
    'medianFee-usdTransfer': 0,
    'gasUsedDif': 100,
}; 

let lastKnownBlock: ProjectedEthereumBlock = null;


redis.subscribe('block');
redis.events.on('block', (data) => {
    const { chain, uncle } = data;
    if(chain !== 'ARBI') return; 
    if(uncle) return; 
    interval.force();
});


const interval = setInterval(async () => {
    try {
        // Initialize connection to the database 
        const { database } = await mongodb();

        const initTasks: Promise<void>[] = [];

        let pricePerIncrement = 0; 
        let transactions: ProjectedEthereumTransaction[] = [];
        let blocks: ProjectedEthereumBlock[] = []; 
        let last250Blocks: ProjectedEthereumBlock[] = []; 


        initTasks.push(new Promise((resolve, reject) => {
            database.collection('statistics').findOne({ chain: 'ETH' }, { fiatPrice: 1 })
                .then((document: any) => {
                    pricePerIncrement = document['fiatPrice-usd'] / 1000000000000000000;
                    return resolve();
                })
                .catch(reject); 
        }));
        
        // Create the task to load the ethereum transactions collection from disk. 
        initTasks.push(new Promise((resolve, reject) => {
            const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'transactions-ARBI.bin'); 
            fs.readFile(dataPath, (err: NodeJS.ErrnoException, data: Buffer) => {
                if(err) return reject(err); 

                try {
                    // Use avsc to parse the schema.
                    let parsed = ETHTransactionsSchema.fromBuffer(data); 

                    // Create the values that will be used to filter the 5-minute window (+1); 
                    const now = Date.now();
                    const oneSecond = 1000 * 1;
                    const upperRange = now - oneSecond; 
                    const lowerRange = now - ((oneSecond * 60) * 5) - oneSecond;

                    // Filter the collection to obtain the transactions within the specified range. 
                    transactions = parsed.collection.filter((transaction: ProjectedEthereumTransaction) => transaction.insertedAt >= lowerRange && transaction.insertedAt <= upperRange);
                    transactions = transactions.sort((a: ProjectedEthereumTransaction, b: ProjectedEthereumTransaction) => a.insertedAt - b.insertedAt);
                    
                    return resolve();  
                } catch (error) {
                    console.error(error);
                    console.log('Attempting to decode schema...'); 
                    try { console.log(`Decoded information for error:`, ETHTransactionsSchema.decode(data)); } catch (error) { console.log('Schema could not be decoded.') }  
                    return reject(error); 
                }
            }); 
        }));

        
        // Create the task to load the ethereum blocks collection from disk.
        initTasks.push(new Promise((resolve, reject) => {
            const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'blocks-ARBI.bin'); 
            fs.readFile(dataPath,  (err: NodeJS.ErrnoException, data: Buffer) => {
                if(err) return reject(err); 

                try {
                    // Use avsc to parse the schema.
                    let parsed = ETHBlocksSchema.fromBuffer(data); 

                    // Create the values that will be used to filter the 1-hour window (+1); 
                    const now = Math.floor(Date.now() / 1000);
                    const oneSecond = 1;
                    const upperRange = now - oneSecond; 
                    const lowerRange = now - ((oneSecond * 60) * 60) - oneSecond;

                    // Filter the collection to obtain the transactions within the specified range. 
                    last250Blocks = parsed.collection.sort((a: ProjectedEthereumBlock, b: ProjectedEthereumBlock) => a.height - b.height).slice(0,250); 
                    blocks = parsed.collection.filter((block: ProjectedEthereumBlock) => block.timestamp >= lowerRange && block.timestamp <= upperRange);
                    blocks = blocks.sort((a: ProjectedEthereumBlock, b: ProjectedEthereumBlock) => a.height - b.height); 
                    lastKnownBlock = blocks[blocks.length - 1]; 
                    return resolve();  
                } catch (error) {
                    console.error(error);
                    console.log('Attempting to decode schema...'); 
                    try { console.log(`Decoded information for error:`, ETHBlocksSchema.decode(data)); } catch (error) { console.log('Schema could not be decoded.') }
                    return reject(error); 
                }
            }); 
        }));

        await Promise.all(initTasks);

        // These tasks are all individually wrapped because their failures are not task-haulting. Even if one of these tasks fail to execute, 
        // the others can execute and if they depend on the failed task the lastExecutionResult will be available to use. 
        const startTime = Date.now(); 

        // try { lastExecutionResults['tps'] = await tps(transactions); } catch (error) { console.error(error); };
        try { lastExecutionResults['ctps'] = await ctps(blocks); } catch (error) { console.error(error); };
        // try { lastExecutionResults['medianBlockSize'] = await medianBlockSize(blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['medianBlockTime'] = await medianBlockTime(last250Blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['medianTxsPerBlock'] = await medianTxsPerBlock(blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['blockHeight'] = await blockHeight(lastKnownBlock); } catch (error) { console.error(error); };
        // try { lastExecutionResults['difficulty'] = (await difficulty(lastKnownBlock)) as string; } catch (error) { console.error(error); };
        // try { lastExecutionResults['gasUsedDif'] = await gasUsedDif(blocks); } catch (error) { console.error(error) }
        try { lastExecutionResults['gasUsedDif'] = 100; } catch (error) { console.error(error) }
        // try { lastExecutionResults['tipPrice'] = await tipPrice(lastKnownBlock); } catch (error) { console.error(error) }
        // try { lastExecutionResults['baseFee'] = await baseFee(lastKnownBlock); } catch (error) { console.error(error) }
        try { lastExecutionResults['gasTarget'] = await gasTarget(lastKnownBlock); } catch (error) { console.error(error) }
        try { lastExecutionResults['gasLimit'] = await gasLimit(lastKnownBlock); } catch (error) { console.error(error) }
        try { lastExecutionResults['medianGasUsed'] = await medianGasUsed(blocks); } catch (error) { console.error(error) }
        try { lastExecutionResults['medianFee-gasPrice'] = await medianFeeGasPrice(transactions);  } catch (error) { console.error(error) }
        try { lastExecutionResults['medianFee-usd'] = await medianFeeUsd(transactions, pricePerIncrement, lastExecutionResults['gasUsedDif']);  } catch (error) { console.error(error) }
        try { lastExecutionResults['medianFee-usdTransfer'] = await medianFeeUsdTransfer(pricePerIncrement, lastExecutionResults['medianFee-gasPrice']) } catch (error) { console.error(error) }
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
                await collection.updateOne({ chain: 'ARBI' }, { $set: lastExecutionResults }); 
                redis.publish('stats', JSON.stringify({ chain: "ARBI", ...lastExecutionResults })); 
            } else {
                console.log('=========================')
                console.log(lastExecutionResults);
            }

        } catch (error) {
            console.error(error); 
        }
    }
}, 1000).start(true);