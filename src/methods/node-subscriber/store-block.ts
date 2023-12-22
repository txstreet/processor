import mongodb from '../../databases/mongodb';
import { BlockchainWrapper } from '../../lib/node-wrappers';

// Stores a #Block in the MongoDB Database.
export default async (wrapper: BlockchainWrapper, hash: string): Promise<Boolean> => {
    try {
        if(process.env.USE_DATABASE == "true") {
            const { database } = await mongodb(); 
            const collection = database.collection('blocks');
            
            await collection.updateOne({ chain: wrapper.ticker, hash }, { 
                $set: { lastInserted: Date.now(), node: true, note: '[node-sub]: store-block' },
                $setOnInsert: { insertedAt: new Date(), processed: false, locked: false, processFailures: 0, processMetadata: true, processTransactions: true }
            }, { upsert: true });
        }
    } catch (error) {
        console.error(error);
    }
    return false;
}