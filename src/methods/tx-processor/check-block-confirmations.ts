import { BlockchainWrapper } from "../../lib/node-wrappers";
import mongodb from '../../databases/mongodb'
import redis from '../../databases/redis'
import createBlockJson from "./create-block-json";

const execute = async (database: any, chain: string, hash: string) => {
    const txCollection = database.collection(`transactions_${chain}`);
    const blockCollection = database.collection(`blocks`); 
    
    const block = await blockCollection.findOne({ chain, hash }); 
    if(!block || block.stored || block.broadcast) return;
    
    
    const remainingTransactions = await txCollection.find({ blockHash: block.hash, dropped: { $exists: false }, confirmed: false }).count()
    if(remainingTransactions > 0) return; 
    
    if(!(await createBlockJson(chain, block)))
        return;
    
    const requiresBlocksForBroadcast: string[] = []; 
    if(block.parentHash) requiresBlocksForBroadcast.push(block.parentHash); 
    if(block.uncles && block.uncles.length) requiresBlocksForBroadcast.push(...block.uncles); 
    
    let readyToBroadcast = true; 
    if(requiresBlocksForBroadcast.length > 0) {
        let requiredBlocks = await blockCollection.find({ chain, hash: { $in: requiresBlocksForBroadcast } }).toArray(); 
        if(requiredBlocks.length !== requiresBlocksForBroadcast.length) {
            readyToBroadcast = false;
        } else { 
            for(let i = 0; i < requiredBlocks.length; i++) {
                let requiredBlock = requiredBlocks[i]; 
                if(!requiredBlock.processed || !requiredBlock.stored || !requiredBlock.broadcast) {
                    readyToBroadcast = false;
                    break; 
                }
            }
        }
    }

    if(readyToBroadcast) 
        redis.publish('block', JSON.stringify({ chain, height: block.height, hash: block.hash })); 

    await blockCollection.updateOne(
        { chain, hash },
        { $set: { stored: true, broadcast: readyToBroadcast, txsChecked: true } })
}

export default async (wrapper: BlockchainWrapper, hashes: string[]): Promise<void> => {
    try {
        const { connection, database } = await mongodb();
        const tasks: Promise<any>[] = [];
        hashes.forEach((hash: string) => tasks.push(execute(database, wrapper.ticker, hash))); 
        await Promise.all(tasks); 
    } catch (error) {
        console.error(error); 
    }
}


// Make sure that transactions are stored/marked as confirmed before executing this code..
// For each hash we need to  
// - Find how many remaining unconfirmed transactions there are for that block. (.count())
// - Stop if there are remaining unconfirmed transactions
// - Obtain the block data for that transaction.  (findOne)
// - if(block.stored is true) stop();
// - create & store the json for the block. 
// - make sure that this block is ready to be broadcast.
// - - parentHash is stored & broadcast
// - - all uncles are stored 
// - update the block to be marked as stored, with broadcast: (are dependents done)
// - if broadcast is true, then broadcast. 