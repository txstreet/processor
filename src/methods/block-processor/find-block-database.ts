import mongodb from '../../databases/mongodb';

// The purpose of this method is to find chain-provided block information in the database. 
export default async (chain: string, key: string, value: any): Promise<any> => {
    try {
        // Initialize database.
        const { database } = await mongodb(); 
        const collection = database.collection('blocks');

        // Here we need to make sure processed is true, as that's how we differentiate between 
        // a block and a request.
        const block = await collection.findOne({ chain, [key]: value });
        if(block && block.processed) return block;

        // Some error with rinkeby sending invalid blocks through the geth event. 
        // XXX: This ONLY happens on Rinkeby. 
        if(block && block.processFailures > 10) {
            await collection.deleteOne({ chain, [key]: value }); 
            return true;
        }

        return block?.processed; 
    } catch (error) {
        console.error(error); 
        return null;
    }
}