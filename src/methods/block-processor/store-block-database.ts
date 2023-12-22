import mongodb from '../../databases/mongodb';

const dontCheckTxs = ['ARBI'];

// The purpose of this method is to store chain-provided block information in the database. 
export default async (chain: string, block: any, databaseKey: string): Promise<void> => {
    try {
        // Initialize database.
        const { database } = await mongodb(); 
        const collection = database.collection('blocks');

        // Upsert (Update, Create if not exists) this block in the database. 
        await collection.updateOne({ chain, [databaseKey]: block[databaseKey] }, { $set: { ...block, processed: true, txsChecked: dontCheckTxs.includes(chain), locked: false, note: '[block-processor]: store-block-db', stored: false, broadcast: false } }, { upsert: true }); 
        console.log(`Stored block ${databaseKey}, processed=true, locked=false`)
    } catch (error) {
        console.error(error); 
    }
}


// chain, [databaseKey] (hash?) 
