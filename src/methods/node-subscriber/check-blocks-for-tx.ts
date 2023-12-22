import { BlockchainWrapper } from '../../lib/node-wrappers';
import mongodb from '../../databases/mongodb'; 

export default async (wrapper: BlockchainWrapper, transaction: any): Promise<boolean> => {
    try {
        if(process.env.USE_DATABASE !== "true") 
            return false; 
        const { database } = await mongodb();
        const collection = database.collection('blocks'); 
        const value = await collection.findOne({ chain: wrapper.ticker, transactions: transaction.hash }, { _id: 0, hash: 1 });
        if(value && value.hash) 
            return true; 
        return false; 
    } catch (error) {
        console.error(error);
        return false;

    }
}