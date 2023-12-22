import mongodb from '../../databases/mongodb';

// The purpose of this method is to find the next available unprocessed block request that
// needs to be handled. Inside of this method we also lock the request so that other block
// processors can not handle it. 
export default async (chain: string): Promise<string | null> => {
    // Get a reference to the database collection, setup collections & sessions for transactions. 
    const { connection, database } = await mongodb(); 
    const collection = database.collection('blocks');
    let session = connection.startSession();

    try {
        // The result which we're going to return from the transaction.
        var result: any = null; 

        // Use a transaction here to lock the request so that other nodes can't get it by issuing 
        // an 'in-the-middle' query.
        await session.withTransaction(async () => {
            // Find any unprocessed request. 
            result = await collection.findOne({ chain, locked: false, processed: false }, { session, sort: { lastInserted: -1 } }); 
            if(result) {
                // Lock the request so other nodes can't get to it.
                await collection.updateOne({ _id: result._id }, { $set: { locked: true } }, { session }); 
            }
        });

        return result; 
    } catch (error) {
        console.error(error); 
        return null;
    } finally {
        await session.endSession();
    }
}