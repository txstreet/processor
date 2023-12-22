// Check if a transaction of the same nonce is in the database. 
// If so, check to see rather or not this transaction has higher fees/gas. 
// If it does, add the old transaction to deletedHashes
// Otherwise, stop processing the transaction. 
import { BlockchainWrapper } from '../../lib/node-wrappers';
import mongodb from '../../databases/mongodb'; 

export default async (wrapper: BlockchainWrapper, transactions: any[]): Promise<any[]> => {
    try {
        const { database } = await mongodb(); 
        const collection = database.collection(`transactions_${wrapper.ticker}`);

        const tasks: Promise<any>[] = []; 

        transactions.forEach((transaction: any) => {
            tasks.push(new Promise(async (resolve) => {
                try {
                    let results = await collection.find({ from: { $eq: transaction.from }, nonce: transaction.nonce }).toArray() 
                    if(!results.length) return resolve(true); 
            
                    let deletedHashes: string[] = [];
                    
                    // If this is set to true we need to check something in the code/database.
                    let adminCheck: boolean = false;
                    let hasConfirmation: boolean = false;
                    results.forEach((result: any) => {
                        if(result.blockHash) hasConfirmation = true;
                        let usedTime = result.timestamp;
                        let currTime = transaction.timestamp;
                        if(currTime < usedTime) return;
                        let used = result.maxFeePerGas || result.gasPrice 
                        let curr = transaction.maxFeePerGas || transaction.gasPrice 
                        if(curr >= used) deletedHashes.push(result.hash); 
                        else adminCheck = true;
                    })

                    if(hasConfirmation){
                        return resolve(true);
                    }

                    if(deletedHashes.length) {
                        transaction.deletedHashes = deletedHashes; 
                        await collection.updateMany({ hash: { $in: deletedHashes } }, { $set: { dropped: true } });
                    }
            
                    if(adminCheck) 
                        console.warn(`Unexpected occurance in check-same-nonce for transaction`, transaction.hash, `on chain`, wrapper.ticker); 

                    return resolve(true); 
                } catch (error) {
                    console.error(error);
                    return resolve(true); // Don't block execution, resolve. 
                }
            }));
        })
        await Promise.all(tasks); 
        return transactions; 
    } catch (error) {
        console.error(error); 
        return transactions;
    }
}