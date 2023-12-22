import { BlockchainWrapper } from '../../lib/node-wrappers';
import mongodb from '../../databases/mongodb';

// This method obtains a batch of confirmed transactions (Transactions that have been submitted by
// a confirmed block, but have not had their data processed yet). 
export default async (wrapper: BlockchainWrapper): Promise<any[]> => {

    // Determine the amount of transactions we are going to attempt to obtain from the database. 
    const batchSize = Number(process.env.CONFIRMED_BATCH_SIZE || 25);
    let session: any = null; 
    try {
        const { connection, database } = await mongodb();
        const collection = database.collection('transactions_' + wrapper.ticker || ''); 

        // Create a database session to atomically execute multiple queries. 
        session = connection.startSession(); 

        // Scopes declaration of the results to return after the transaction is finished.
        var results: any[] = [];

        // A transaction allows us to atomically execute multiple queries without queries from other clients
        // being executed in the middle.
        await session.withTransaction(async () => {
            // The query to find documents to return as results. 
            let where: any =  { confirmed: false, processed: true, blockHeight: { $ne: null }, locked: false, processFailures: { $lte: 5 } }

            let project: any = {
                _id: 0, processed: 1, locked: 1, processFailures: 1, hash: 1, from: 1, value: 1, to: 1
            }
            
            // Execute the query. 
            results = await collection.find(where, project).sort({ blockHeight: 1 }).limit(batchSize).toArray(); 
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
        
        return results;
    } catch (error) {
        console.error(error)
        return [];
    } finally { 
        if(session)
            session.endSession();
    }
}