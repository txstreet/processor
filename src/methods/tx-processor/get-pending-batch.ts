import { BlockchainWrapper } from '../../lib/node-wrappers';
import mongodb from '../../databases/mongodb';

// This method obtains a batch of pending transactions (Transactions that have been submitted by
// the mempool, but not yet verified to actually exist). 
export default async (wrapper: BlockchainWrapper): Promise<any[]> => {
    // Determine the amount of transactions we are going to attempt to obtain from the database. 
    const batchSize = Number(process.env.PENDING_BATCH_SIZE || 25);
    try {
        const { connection, database } = await mongodb();
        const collection = database.collection('transactions_' + wrapper.ticker || ''); 
        
        // Create a database session to atomically execute multiple queries. 
        const session = connection.startSession(); 

        // Scopes declaration of the results to return after the transaction is finished.
        var results: any[] = [];

        // A transaction allows us to atomically execute multiple queries without queries from other clients
        // being executed in the middle.
        await session.withTransaction(async () => {
            // The query to find documents to return as results. 

            // if node and isnertAt < 300 seconds or not node 
            let where: any = { 
                processed: false, 
                locked: false,
                processFailures: { $lte: 5 },
                dropped: { $exists: false }
            }; 

            let project: any = {
                _id: 0, processed: 1, locked: 1, processFailures: 1, hash: 1, from: 1, value: 1, to: 1
            }

            // Execute the query. 
            results = await collection.find(where).limit(batchSize).toArray(); 

            // If there are results available, we need to lock them. 
            if(results.length > 0) {
                // Consolodite the results into an array of _id's (MongoDB unique identifiers)
                const ids = results.map((result: any) => result._id); 
                
                // Query to update the specified documents. 
                where = { _id: { $in: ids } };

                // The instructions to perform updates on the document. 
                let updateInstructions = { $set: { locked: true, lockedAt: Date.now() } }; 

                // Here we will lock the transactions so that other application instances can't process them. 
                await collection.updateMany(where, updateInstructions); 
            }
        }); 
        
        session.endSession(); 
        return results;
    } catch (error) {
        console.error(error); 
        return [];
    } finally {
    }
}
