import { BlockchainWrapper } from '../../lib/node-wrappers';
import { waitForTime } from '../../lib/utilities';

import findNextRequest from "./find-next-request"
import storeBlockDatabase from './store-block-database';
import unlockRequest from './unlock-request';
import findBlockDatabase from './find-block-database';
import createTransactionRequests from './create-transaction-requests';
import createBlockJson from './create-block-json';

import processUncle from './process-uncle';

const action = async (wrapper: BlockchainWrapper, blockId: string | number = null, depth: number = 0, searchRequest: boolean = true): Promise<void> => {
    let request: any = null;
    try { 
        // Sanity check for block-processing depth.
        if(depth > wrapper.blockDepthLimit) 
            return; 

        // The database key of the identifying property for this request.
        // This is usually the hash, but if a user-generated request supplies a height it can change.
        let databaseKey = 'hash'; 

        // Obtain the block id (hash or height) to process if once was not provided
        if(searchRequest) {
            request = await findNextRequest(wrapper.ticker); 
            if(blockId == null) {
                if(request) {
                    blockId = request.hash || request.height; 
                    if(!request.hash && request.height != null) 
                        databaseKey = 'height';
                }
            }
            if(request)
                console.log("Request found..."); 
        } else {
            request = { hash: blockId }
        }

        

        // If there's nothing to process, process a short delay then return a success response. 
        // This is to prevent spamming the database for requests between blocks. 
        if(blockId == null) 
            return await waitForTime(100); 

        // Sanity check some defaults.
        if(searchRequest) {
            if(request.processMetadata === undefined)
                request.processMetadata = true;
            if(request.processTransactions === undefined)
                request.processTransactions = true; 
        }
            
        // Check if the block already exists in the datbase. 
        // If it already exists, return a success response. 
        let block = await findBlockDatabase(wrapper.ticker, databaseKey, blockId); 
        if(block && !(request.processMetdata || request.processTransactions)) return; 
        if(!searchRequest && block) {
            request.processMetadata = block.timestamp == null;
            request.processTransactions = block.timestamp == null;
        }
        
        if(searchRequest)
            console.log(`Found request: ${request.hash}`); 

        if(request.processMetadata || (!block && blockId)) {
            // Utilize the blockchain specific implementation to resolve the block data.
            let resolvedBlock = await wrapper.getBlock(blockId, 2); 

            // The exists field is appended to ensure that the execution flow is stopped in the event of an error
            // that has already been logged by the localized log in the blockchain implementation.
            if(!resolvedBlock) {
                console.warn(`Could not get block for hash ${blockId} results: ${resolvedBlock}`)
                await unlockRequest(wrapper.ticker, blockId as string); 
                return await waitForTime(100);
            }
            // Assign block the be the resolved block. 
            block = resolvedBlock;
                        
            if(resolvedBlock.parentHash && block.parentHash != "0x0000000000000000000000000000000000000000000000000000000000000000" && depth < wrapper.blockDepthLimit)
                await action(wrapper, resolvedBlock.parentHash, depth + 1, false); 

            if((wrapper as any).getUncle && resolvedBlock.uncles && resolvedBlock.uncles.length) {
                const startTime = Date.now();
                for(let i = 0; i < resolvedBlock.uncles.length; i++) {
                    await processUncle(wrapper, blockId, i);
                }
                console.log(`Took ${Date.now() - startTime}ms to process uncles.`);
            }
        }


        // Create a tmp value holding the transactions array for the block. 
        // This is later passed into createTransactionRequests. 
        // But we want to reduce block.transactions to an array of hashes for database storage. 
        let transactions: any[] = block.transactions;
        if(block.transactions?.length && typeof block.transactions[0] === 'object') {
            block.transactions = block.transactions.map((tx: any) => tx.hash); 
        }
        
        // Store the block in the database 
        await storeBlockDatabase(wrapper.ticker, block, databaseKey); 
        
        if(request.processTransactions && !request.lastTransactionFetch || request.lastTransactionFetch >= Date.now() - 1209600000) {
            // When storing a transaction in the local database, mark it with blockHeight so it can be queried easily.
            await createTransactionRequests(wrapper, block.hash, block.height, transactions);
            
            // If the amount of transactions in the block is equal to zero, we need to create the json data for the block.
            // as there will be nothing for the transaction-processor to pick up.
            if(block.transactions?.length === 0) {
                await createBlockJson(wrapper.ticker, block); 
            }
        }
    } catch (error) {
        if(request && request.hash) 
            await unlockRequest(wrapper.ticker, request.hash); 
        console.error(error);
    }
}


// This function handles Phase 1 of fulfilling a request to process a block.
// Phase 2 is started inside of the redis message callback when a transaction processor
// responds that a blocks transactions have been completely processed. You can find the
// callback that registers this in src/index 
export default async (wrapper: BlockchainWrapper, blockId: string | number = null, depth: number = 0, searchRequest: boolean = true): Promise<void> => {
    await action(wrapper, blockId, depth, searchRequest); 
}