import { BlockchainWrapper } from '../../lib/node-wrappers';
import { waitForTime } from '../../lib/utilities';

import findNextRequest from "./find-next-request"
import storeBlockDatabase from './store-block-database';
import unlockRequest from './unlock-request';
import findBlockDatabase from './find-block-database';
import createTransactionRequests from './create-transaction-requests';
import createBlockJson from './create-block-json';



// if(block.parentHash && block.parentHash != "0x0000000000000000000000000000000000000000000000000000000000000000" && depth < this.blockDepthLimit)
// await this.resolveBlock(block.parentHash, verbosity, depth + 1); 


const action = async (wrapper: BlockchainWrapper, blockId: string | number, uncleIndex: number): Promise<void> => {
    try { 
        let anyWrapper: any = (wrapper as any); 
        // Check if the block already exists in the datbase. 
        // If it already exists, return a success response. 
        let block = await findBlockDatabase(wrapper.ticker, 'hash', blockId); 
        if(block && block.processed) return;

        // Utilize the blockchain specific implementation to resolve the block data.
        let resolvedBlock = await anyWrapper.getUncle(blockId, uncleIndex); 
        console.log(`Uncle:`, resolvedBlock);
        
        // The exists field is appended to ensure that the execution flow is stopped in the event of an error
        // that has already been logged by the localized log in the blockchain implementation.
        if(!resolvedBlock) {
            console.warn(`Could not get uncle ${uncleIndex} for hash ${blockId} results: ${resolvedBlock}`)
            return; 
        }
            
        block = resolvedBlock; 
        block.uncle = true; 
        block.transactions = block.transactions || [];

        let transactions: any[] = block.transactions;
        if(block.transactions?.length && typeof block.transactions[0] === 'object') {
            block.transactions = block.transactions.map((tx: any) => tx.hash); 
        }
        
        await storeBlockDatabase(wrapper.ticker, block, 'hash'); 
        
        console.log(`Uncle transactions: ${block.transactions}`);

        // When storing a transaction in the local database, mark it with blockHeight so it can be queried easily.
        await createTransactionRequests(wrapper, block.hash, block.height, transactions);
        
        // If the amount of transactions in the block is equal to zero, we need to create the json data for the block.
        // as there will be nothing for the transaction-processor to pick up.
        if(block.transactions?.length === 0) {
            await createBlockJson(wrapper.ticker, block); 
        }
    } catch (error) {
        console.error(error);
    }
}


// This function handles Phase 1 of fulfilling a request to process a block.
// Phase 2 is started inside of the redis message callback when a transaction processor
// responds that a blocks transactions have been completely processed. You can find the
// callback that registers this in src/index 
export default async (wrapper: BlockchainWrapper, blockId: string | number = null, uncleIndex: number): Promise<void> => {
    action(wrapper, blockId, uncleIndex); 
}