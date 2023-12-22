import { BlockchainWrapper } from '../../lib/node-wrappers';
import { waitForTime, formatBlock } from '../../lib/utilities';

// import findNextRequest from "./find-next-request"
// import storeBlockDatabase from './store-block-database';
import unlockRequest from './unlock-request';
// import findBlockDatabase from './find-block-database';
// import createTransactionRequests from './create-transaction-requests';
// import createBlockFile from './create-block-file';
import { formatTransaction } from '../../lib/utilities';
import redis from '../../databases/redisEvents';
import mongodb from "../../databases/mongodb";
import callChainHooks from '../../lib/chain-implementations';

const getRequests = async (chain: string): Promise<[] | null> => {
    // Get a reference to the database collection, setup collections & sessions for transactions. 
    const { connection, database } = await mongodb();
    const collection = database.collection('blocks');
    let session = connection.startSession();

    try {
        // The result which we're going to return from the transaction.
        var results: any = null;

        // Use a transaction here to lock the request so that other nodes can't get it by issuing 
        // an 'in-the-middle' query.
        await session.withTransaction(async () => {
            // Find any unprocessed request. 
            results = await collection.find({ chain, locked: false, processed: false, lastInserted: { $gte: (Date.now() - 60000) } }, { session, sort: { lastInserted: 1 } }).limit(50).toArray();

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                await collection.updateOne({ _id: result._id }, { $set: { locked: true } }, { session });
            }
        });

        return results;
    } catch (error) {
        console.error(error);
        return null;
    } finally {
        await session.endSession();
    }
}

const action = async (wrapper: BlockchainWrapper): Promise<void> => {
    let request: any = null;
    try {
        // The database key of the identifying property for this request.
        // This is usually the hash, but if a user-generated request supplies a height it can change.
        let databaseKey = 'hash';

        // Obtain the block id (hash or height) to process if once was not provided
        const requests = await getRequests(wrapper.ticker);

        // if(searchRequest) {
        //     request = await findNextRequest(wrapper.ticker); 
        //     if(blockId == null) {
        //         if(request) {
        //             blockId = request.hash || request.height; 
        //             if(!request.hash && request.height != null) 
        //                 databaseKey = 'height';
        //         }
        //     }
        //     if(request)
        //         console.log("Request found..."); 
        // } else {
        //     request = { hash: blockId }
        // }



        // If there's nothing to process, process a short delay then return a success response. 
        // This is to prevent spamming the database for requests between blocks. 
        // if(blockId == null) 
        //     return await waitForTime(10); 

        // // Sanity check some defaults.
        // if(searchRequest) {
        //     if(request.processMetadata === undefined)
        //         request.processMetadata = true;
        //     if(request.processTransactions === undefined)
        //         request.processTransactions = true; 
        // }

        // Check if the block already exists in the datbase. 
        // If it already exists, return a success response. 
        // let block = await findBlockDatabase(wrapper.ticker, databaseKey, blockId); 
        // if(block && !(request.processMetdata || request.processTransactions)) return; 
        // if(!searchRequest && block) {
        //     request.processMetadata = block.timestamp == null;
        //     request.processTransactions = block.timestamp == null;
        // }

        // if(searchRequest)
        //     console.log(`Found request: ${request.hash}`); 

        // if(request.processMetadata || (!block && blockId)) {
        // Utilize the blockchain specific implementation to resolve the block data.

        if (!Array.isArray(requests)) return;
        for (let i = 0; i < requests.length; i++) {
            (async () => {


                let block: any = requests[i];
                const blockId: any = block.hash || block.number;
                let resolvedBlock = await wrapper.getBlock(blockId, 2);

                // The exists field is appended to ensure that the execution flow is stopped in the event of an error
                // that has already been logged by the localized log in the blockchain implementation.
                if (!resolvedBlock) {
                    console.warn(`Could not get block for hash ${blockId} results: ${resolvedBlock}`)
                    await unlockRequest(wrapper.ticker, blockId as string);
                    return await waitForTime(100);
                }

                // if((wrapper as any).getUncle && resolvedBlock.uncles && resolvedBlock.uncles.length) {
                //     const startTime = Date.now();
                //     for(let i = 0; i < resolvedBlock.uncles.length; i++) {
                //         await processUncle(wrapper, blockId, i);
                //     }
                //     console.log(`Took ${Date.now() - startTime}ms to process uncles.`);
                // }
                // }
                block = { ...resolvedBlock, ...block };

                // const receipts = await wrapper.getTransactionReceipts(block);

                // Create a tmp value holding the transactions array for the block. 
                // This is later passed into createTransactionRequests. 
                // But we want to reduce block.transactions to an array of hashes for database storage. 
                let transactions: any[] = block.transactions;
                if (block.transactions?.length && typeof block.transactions[0] === 'object') {
                    block.transactions = block.transactions.map((tx: any) => tx.hash);
                }
                // Store the block in the database 
                // await storeBlockDatabase(wrapper.ticker, block, databaseKey);

                const differences: any[] = [];
                block.txFull = {};

                const transactionPromises: any = [];
                transactions.forEach((transaction: any) => {
                    transactionPromises.push(new Promise(async (resolve) => {
                        // for (let i = 0; i < receipts.length; i++) {
                        //     const receipt = receipts[i];
                        //     if (receipt.transactionHash === transaction.hash) {
                        //         transaction.receipt = receipt;
                        //         // transaction.gasUsed = Number(receipt.gasUsed);
                        //         // transaction.cumulativeGasUsed = Number(receipt.cumulativeGasUsed);
                        //         // transaction.effectiveGasPrice = Number(receipt.effectiveGasPrice);
                        //         if (transaction.gas > 21000) {
                        //             differences.push(Number(transaction.receipt.gasUsed) / transaction.gas);
                        //         }
                        //     }
                        // }

                        await callChainHooks(wrapper.ticker, transaction);
                        const formatted = formatTransaction(wrapper.ticker, transaction);
                        block.txFull[formatted.tx] = formatted;
                        resolve(true);
                    }));
                });
                await Promise.all(transactionPromises);

                // if (differences.length) {
                //     block.gasUsedDif = (differences.reduce((a: any, b: any) => a + b, 0) / differences.length) * 100;
                // }


                // console.log(transactions);
                block.transactionsFull = transactions;

                const { database } = await mongodb();

                // delete block.transactionsFull;
                // console.log("storing");
                // await createBlockFile(wrapper.ticker, block);
                // console.log("stored");
                // await database.collection('blocks').updateOne({ chain: wrapper.ticker, hash: block.hash }, { $set: { stored: true } });
                const formatted: any = formatBlock(wrapper.ticker, block);

                console.log("broadcasting: " + block.height);
                redis.publish('block', JSON.stringify({ chain: wrapper.ticker, height: block.height, hash: block.hash, block: formatted }));

                database.collection('blocks').updateOne({ chain: wrapper.ticker, hash: block.hash }, { $set: { ...block, processed: true, broadcast: true, txsChecked: true, locked: false, note: '[block-processor]: store-block-db', stored: false } }, { upsert: true });
                // database.collection('blocks').updateOne({ chain: wrapper.ticker, hash: block.hash }, { $set: { broadcast: true } });
            })();
        }
    } catch (error) {
        if (request && request.hash)
            await unlockRequest(wrapper.ticker, request.hash);
        console.error(error);
    }
}


// This function handles Phase 1 of fulfilling a request to process a block.
// Phase 2 is started inside of the redis message callback when a transaction processor
// responds that a blocks transactions have been completely processed. You can find the
// callback that registers this in src/index 
export default async (wrapper: BlockchainWrapper, blockId: string | number = null, depth: number = 0, searchRequest: boolean = true): Promise<void> => {
    await action(wrapper);
}