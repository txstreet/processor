import { BlockchainWrapper } from '../../lib/node-wrappers';
import mongodb from '../../databases/mongodb';
import redis from '../../databases/redis';
import { formatTransaction } from '../../lib/utilities';

export default async (wrapper: BlockchainWrapper, transactions: any[]): Promise<boolean> => {
    try {
        // Initialize the database.
        const { database } = await mongodb();
        const collection = database.collection('transactions_' + wrapper.ticker || ''); 
        
        // Create an array of instructions for the database. 
        const instructions: any[] = [];

        // Iterate over the transactions to create the bulkWrite instructions. 
        transactions.forEach((transaction: any) => {
            redis.publish('pendingTx', JSON.stringify({ chain: wrapper.ticker, ...formatTransaction(wrapper.ticker, transaction) }));
            instructions.push({
                updateOne: {
                    filter: { hash: transaction.hash }, 
                    update: {
                        $set: { ...transaction, locked: false, processed: true, processFailures: 0, lastProcessed: Date.now(), insertedAt: new Date(), lastInsert: new Date(), note: '[txp]: store-pending-tx' },
                    }
                }
            })
        });

        // Wait for the query to complete.
        if(instructions.length > 0)
            await collection.bulkWrite(instructions, { ordered: false });

        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}