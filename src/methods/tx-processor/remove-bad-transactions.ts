import { BlockchainWrapper } from '../../lib/node-wrappers';
import mongodb from '../../databases/mongodb'; 


export default async (wrapper: BlockchainWrapper, hashes: string[]): Promise<boolean> => {
    try {
        if(!hashes.length) return; 

        // Initialize the database. 
        const { database } = await mongodb();
        const collection = database.collection('transactions_' + wrapper.ticker || '');

        // The query matching all documents that should be removed. 
        const where = { hash: { $in: hashes } }; 
        const update = { $set: { dropped: true } };

        // Execute the query 
        await collection.updateMany(where, update); 
        return true;
    } catch (error) {
        console.error(error); 
        return false;;
    }
}