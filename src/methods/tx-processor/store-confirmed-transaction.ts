import { BlockchainWrapper } from '../../lib/node-wrappers';
import mongodb from '../../databases/mongodb';

export default async (wrapper: BlockchainWrapper, transactions: any[]): Promise<boolean> => {
    try {

        // Initialize the database.
        const { database } = await mongodb();
        const collection = database.collection('transactions_' + wrapper.ticker || ''); 
        
        // Create an array of instructions for the database. 
        const instructions: any[] = [];

        // Iterate over the transactions to create the bulkWrite instrucctions. 
        transactions.forEach((transaction: any) => {
            delete transaction._id; 
            instructions.push({
                updateOne: {
                    filter: { hash: transaction.hash }, 
                    update: {
                        $set: { ...transaction, locked: false, confirmed: true, processFailures: 0, lastProcessed: Date.now(), timestamp: Date.now(), note: '[txp]: store-confirmed-tx' },
                    }
                }
            })
        });

        // Wait for the query to complete.
        if(instructions.length > 0) {
            await collection.bulkWrite(instructions, { ordered: false });
        }

        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}