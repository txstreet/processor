import { BlockchainWrapper } from '../../lib/node-wrappers';
import mongodb from '../../databases/mongodb';

// The purpose of this method is to unlock the transactions with the provided hashes.
// Transactions can be unlocked because the request was failed or successful. 
// When a transaction fails to be processed, the failure flag increments the processFailures 
// count. We can use this count to remove the transaction if failures keep occuring. 
export default async (wrapper: BlockchainWrapper, hashes: string[]): Promise<boolean> => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('transactions_' + wrapper.ticker || ''); 
        
        // The query matching all documents that should be updated. 
        const where = { hash: { $in: hashes } }; 

        // The instructions to perform updates on the document. 
        const updateInstructions = { $set: { locked: false }, $inc: { processFailures: 1 } }; 

        // Perform the query. 
        await collection.updateMany(where, updateInstructions);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}