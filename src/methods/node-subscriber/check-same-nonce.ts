// Check if a transaction of the same nonce is in the database. 
// If so, check to see rather or not this transaction has higher fees/gas. 
// If it does, add the old transaction to deletedHashes
// Otherwise, stop processing the transaction. 
import { BlockchainWrapper } from '../../lib/node-wrappers';
import mongodb from '../../databases/mongodb'; 

export default async (wrapper: BlockchainWrapper, transaction: any): Promise<any> => {
    try {
        if(process.env.USE_DATABASE !== "true") 
            return transaction;
             
        const { database } = await mongodb(); 
        const collection = database.collection(`transactions_${wrapper.ticker}`);

        try {
            let results = await collection.find({ from: { $eq: transaction.from }, nonce: transaction.nonce }).toArray() 
            if(!results.length) return transaction;
    
            let deletedHashes: string[] = [];
            
            // If this is set to true we need to check something in the code/database.
            // let lowerFee: boolean = false;
            let hasConfirmation: boolean = false;
            results.forEach((result: any) => {
                if(result.blockHash) hasConfirmation = true;
                if(result.hash === transaction.hash) return; 
                // let used = result.maxFeePerGas || result.gasPrice 
                // let curr = transaction.maxFeePerGas || transaction.gasPrice 
                // if(curr > used) deletedHashes.push(result.hash); 
                // else if(curr === used) {
                    // This condition can likely be removed later, but is needed due to a data-fault that we had.
                    // It has since been fixed. 
                    if(!result.receipt) {
                        deletedHashes.push(result.hash)
                    }
                // }
                // else if (curr < used) {
                //     lowerFee = true; 
                // }
            })

            if(hasConfirmation)
                return transaction;

            if(deletedHashes.length) {
                transaction.deletedHashes = deletedHashes; 
                await collection.updateMany({ hash: { $in: deletedHashes } }, { $set: { dropped: true } });

                //TODO delete from pending list
            }

            // return lowerFee ? null : transaction
            return transaction;
        } catch (error) {
            console.error(error);
            return transaction // Don't block execution, resolve. 
        }
    } catch (error) {
        console.error(error); 
        return transaction;
    }
}