import mongodb from '../../databases/mongodb';
import { formatTransaction, formatBlock, storeObject } from '../../lib/utilities';

import fs from 'fs';
import path from 'path';

// The purpose of this function is to curate and store the JSON information for this block.
// This includes the task of querying for the txFull object and other information.
export default async (chain: string, block: any): Promise<any> => {
    try {        
        const { database } = await mongodb(); 

        // Obtain the txFull list from the database by querying all the transactions.
        const transactions = await database.collection('transactions_' + chain || '').find({
            hash: { $in: block.transactions },
            confirmed: true,
            // dropped: { $exists: false }
        }).toArray();


        // Format the txFull array
        block.txFull = {}; 
        // Array for holding onto gas differences. 
        const differences: any[] = [];
        transactions.forEach((transaction: any) => {
            let adjustedGas = transaction.gas;
            // if(transaction.input == "0x" && transaction.gas > 21000)
            //     adjustedGas = 21000; 
            if(transaction.receipt && adjustedGas > 21000)
                differences.push(transaction.receipt.gasUsed / transaction.gas); 
            const formatted = formatTransaction(chain, transaction);
            block.txFull[formatted.tx] = formatted;
        })

        await database.collection('blocks').updateOne(
            { chain, hash: block.hash },
            { $set: { gasUsedDif: (differences.reduce((a: any, b: any) => a + b, 0) / differences.length) * 100 } }
        );

        console.log(`Created block json containing ${Object.values(block.txFull).length} txFull items.`);

        // Encode the file content.
        const formattedBlock: any = formatBlock(chain, block);
        formattedBlock.note = 'transaction-processor'; 
        const fileContents = JSON.stringify(formattedBlock);

        await storeObject(path.join('blocks', chain, block.hash), fileContents);
        return block; 
    } catch (error) {
        console.error(error);
        return null;
    }
}

