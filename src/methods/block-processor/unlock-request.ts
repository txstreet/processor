import mongodb from '../../databases/mongodb';

// The purpose of this method is to unlock a request in the event of a failure so that
// either this processor or others can attempt to resolve it in the future. Increment the 
// processing failure key to keep track of how many failures there have been to potentially
// ignore bad blocks in the future. 
export default async (chain: string, hash: string): Promise<string | number | null> => {
    try {
        // Initialize database.
        const { database } = await mongodb(); 
        const collection = database.collection('blocks');

        // Sets locked state to false and increments processFailures by 1. 
        return await collection.updateOne({ chain, hash }, { $set: { locked: false }, $inc: { processFailures: 1 } }); 
    } catch (error) {
        console.error(error); 
        return null;
    }
}