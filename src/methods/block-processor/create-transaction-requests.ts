import { BlockchainWrapper } from '../../lib/node-wrappers';
import mongodb from '../../databases/mongodb';

// The purpose of this method is to create transaction requests in the database.
// Since transactions are multi-stage objects, assigning the blockHeight to the transaction
// opens it up to queries in the transaction-processor to be processed as a confirmed transaction. 

// TODO: Adjust this function to account for non mempool-inclusive transactions.
export default async (wrapper: BlockchainWrapper, blockHash: string, blockHeight: number, transactions: any[]): Promise<boolean> => {
    try {
        if(!transactions) return; 
        
        // Initialize database. 
        const { database } = await mongodb();
        const collection = database.collection('transactions_' + wrapper.ticker || '');

        // Set of instructions to be executed on the database in bulk.
        const writeInstructions: any[] = []; 

        // Default values to set whenever a document is created(upserted) in the database.
        const $setOnInsert = { processed: true, confirmed: Boolean(blockHash), locked: false, node: true, insertedAt: new Date(), processFailures: 0 };

        // In the event the transactions[] contains full transactions. 
        if(typeof transactions[0] === 'object') {
            transactions.forEach((transaction: any) => {
                writeInstructions.push({
                    updateOne: {
                        filter: { hash: transaction.hash },
                        update: { 
                            $set: { ...transaction, blockHash, blockHeight, note: '[block-processor]: line31' },
                            $unset: { dropped: "" },
                            $setOnInsert
                        },
                        upsert: true
                    }
                })
            })
        } 
        // In the event the transaction[] contains hashes.
        else if(typeof transactions[0] === 'string') {
            transactions.forEach((hash: string) => {
                writeInstructions.push({
                    updateOne: {
                        filter: { hash },
                        update: { 
                            $set: { blockHash, blockHeight, note: '[block-processor]: line47' },
                            $unset: { dropped: "" },
                            $setOnInsert
                        },
                        upsert: true
                    }
                })
            })
        }
        
        // If there are any instructions to be writter, submit them to the database.
        // Set ordered to false to improve write performance.
        if(writeInstructions.length > 0)  {
            await collection.bulkWrite(writeInstructions, { ordered: false }); 
            await database.collection(`blocks`).updateOne({ chain: wrapper.ticker, hash: blockHash }, { $set: { processTransactions: false, lastTransactionFetch: Date.now() } });
        }

        console.log(`Transaction requests created for hash: ${blockHash}, height: ${blockHeight}`)
        return true;
    } catch (error) {
        console.error(error); 
        return false;  
    }
}