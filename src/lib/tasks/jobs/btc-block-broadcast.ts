import mongodb from '../../../databases/mongodb';
import redis from '../../../databases/redis'; 
import { formatTransaction, formatBlock, storeObject } from '../../../lib/utilities';
import path from 'path';

export default async (chain: string): Promise<void> => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('blocks'); 
        //first check if the transaction fetching is failing, and then update them to be picked up again to create the block json
        let block = await collection.find({ chain, stored: false, broadcast: false, processed: true, lastTransactionFetch: { $lt: Date.now() - 60000 } }).sort({ height: 1 }).limit(1).next();
        if(block){
            console.log("found stuck block " + block.hash);
            if(block.transactions && block.transactions.length){
                const buggedTxs = await database.collection('transactions_' + chain).find({ blockHash: block.hash, confirmed: true }).project({ hash: 1 }).toArray();
                if(buggedTxs.length){
                    for (let i = 0; i < buggedTxs.length; i++) {
                        const rtx = buggedTxs[i];
                        await database.collection('transactions_' + chain).updateOne({ hash: rtx.hash }, { $set: { confirmed: false, processed: true, blockHeight: block.height, locked: false, processFailures: 0 }});
                        console.log("updated failed tx " + rtx.hash);
                    }
                    // confirmed: false, processed: true, blockHeight: { $ne: null }, locked: false, processFailures: { $lte: 5 }
                    
                }
                return;
            }
        }

        block = await collection.find({ chain, stored: true, broadcast: false }).sort({ height: 1 }).limit(1).next(); 
        if(!block) {
            return; 
        }
        await checkBlock(database, chain, block); 
        
    } catch (error) {
        console.error(error); 
    }
}

const checkForConfirmation = async (database: any, chain: string, block: any) => {
    const txsCollection = database.collection('transactions_' + chain); 
    const blocksCollection = database.collection('blocks'); 
    
    const remainingTxs = await txsCollection.find({ confirmed: false, blockHash: block.hash, dropped: { $exists: false } }).count(); 
    if(!remainingTxs) {
        block.txFull = {}; 
        const transactions = await txsCollection.find({ hash: { $in: block.transactions }, confirmed: true, dropped: { $exists: false } }).toArray(); 
        transactions.forEach((transaction: any) => {
            const formatted = formatTransaction(chain, transaction);
            block.txFull[formatted.tx] = formatted; 
        });
        const content = JSON.stringify(formatBlock(chain, block)); 
        await storeObject(path.join('blocks', chain, block.hash), content); 
        await blocksCollection.updateOne({ chain, hash: block.hash }, { $set: { stored: true, broadcast: false } }); 
        return false;
    } else {
        return false; 
    }
}

const checkBlock = async (database: any, chain: string, block: any): Promise<boolean> => {
    try {
        const blocksCollection = database.collection('blocks'); 
        const parent = await blocksCollection.findOne({ chain, hash: block.previousblockhash }); 
        if(!parent) {
            redis.publish('block', JSON.stringify({ chain, height: block.height, hash: block.hash })); 
            await blocksCollection.updateOne({ chain, hash: block.hash }, { $set: { broadcast: true } }); 
            return true; 
        } 
        
        if(!parent.stored) {
            await checkForConfirmation(database, chain, parent);
            return false; 
        } 

        if(block.stored && parent.stored && parent.broadcast || block.stored && !parent) {
            console.log('Publishing block', block.height || block.number);
            redis.publish('block', JSON.stringify({ chain, height: block.height, hash: block.hash })); 
            await blocksCollection.updateOne({ chain, hash: block.hash }, { $set: { broadcast: true } }); 
            return true; 
        } else {
            return false;
        }
    } catch (error) {
        console.error(error); 
        return false; 
    }
}
 