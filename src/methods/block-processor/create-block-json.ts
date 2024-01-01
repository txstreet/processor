import redis from '../../databases/redisEvents';
import mongodb from '../../databases/mongodb';
import { formatBlock, storeObject  } from '../../lib/utilities';
import fs from 'fs';
import path from 'path';

// This is only used in the event there's no transactions in the block, otherwise
// please see the transaction-processor project for proper storage. 
export default async (chain: string, block: any): Promise<any> => {
    try {        
        if(!block) return; 

        // Format the txFull array
        block.txFull = {}; 
  
        // Encode the file content.
        const formatted: any = formatBlock(chain, block);
        formatted.note = 'block-processor'; 
        var content = JSON.stringify(formatted);

        // Create the file. 
        await storeObject(path.join('blocks', chain, block.hash), content);
        console.log("stored");

        // Initialize database 
        const { database } = await mongodb(); 
        const collection = database.collection('blocks');


        const requiresBlocksForBroadcast: string[] = []; 
        if(block.parentHash) requiresBlocksForBroadcast.push(block.parentHash); 
        if(block.uncles && block.uncles.length) requiresBlocksForBroadcast.push(...block.uncles); 
        
        let readyToBroadcast = true; 
        if(requiresBlocksForBroadcast.length > 0) {
            let requiredBlocks = await collection.find({ chain, hash: { $in: requiresBlocksForBroadcast } }).toArray(); 
            for(let i = 0; i < requiredBlocks.length; i++) {
                let requiredBlock = requiredBlocks[i]; 
                if(!requiredBlock.processed || !requiredBlock.stored || !requiredBlock.broadcast) {
                    readyToBroadcast = false;
                    break; 
                }
            }
        }

        if(readyToBroadcast) 
            redis.publish('block', JSON.stringify({ chain, height: block.height, hash: block.hash })); 


        // Update this block to be stored, and set broadcast to isReady. 
        // If broadcast: false then a scheduled task will pick it up and re-check dependency blocks and submit it when ready. 
        const where = { chain, hash: block.hash, processed: true }; 
        const updateInstructions = { $set: { stored: true, broadcast: readyToBroadcast, txsChecked: true } }; 
        await collection.updateOne(where, updateInstructions); 

        // Submit this block to the front-end if it was ready.
        if(readyToBroadcast)
            redis.publish('block', JSON.stringify({ chain, height: block.height, hash: block.hash })); 
        return block; 
    } catch (error) {
        console.error(error); 
        return null;
    }
}
