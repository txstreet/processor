// IN PROGRESS - OPTIMIZATION|| Refactoring to use memory transactions, paused to fix other important issues. 

import mongodb from '../../../../../databases/mongodb';
import { formatTransaction, storeObject } from '../../../../../lib/utilities';
import { setInterval } from '../../../utils/OverlapProtectedInterval';
import fs from 'fs';
import path from 'path';
import { ETHTransactionsSchema } from '../../../../../data/schemas';
import { ProjectedEthereumTransaction } from '../../../types';
import axios from 'axios';
import updateAccountNonces from '../../../../../methods/tx-processor/update-account-nonces';
import * as Wrappers from '../../../../../lib/node-wrappers';

const ethWrapper = new Wrappers.ETHWrapper(process.env.ETH_NODE as string);

const readFile = (path: string) => new Promise<Buffer>((resolve, reject) => {
    fs.readFile(path, (err: NodeJS.ErrnoException, data: Buffer) => {
        if (err) return reject(err);
        return resolve(data);
    })
})

// to, house, maxPriorityFeePerGas, nonce
// delete timestamp/insertedAt

// Used to hold transaction-specific data. 
const cache: { [key: string]: any } = {}

let lastUploadTime = 0;


// The purpose of this function is to curate and store the JSON information for the current pending transaction list. 
setInterval(async () => {
    try {
        const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'ETH-pendingTransactions.bin');
        const { database } = await mongodb();

        let data = await readFile(dataPath);
        let parsed = ETHTransactionsSchema.fromBuffer(data);

        for (let i = 0; i < parsed.collection.length; i++) {
            const entry = parsed.collection[i];
            if(entry.extras && typeof entry.extras === "string") entry.extras = JSON.parse(entry.extras);
            if(entry.pExtras && typeof entry.pExtras === "string") entry.pExtras = JSON.parse(entry.pExtras);
        }

        let transactions = parsed.collection.sort((a: ProjectedEthereumTransaction, b: ProjectedEthereumTransaction) => (b.maxFeePerGas || b.gasPrice) - (a.maxFeePerGas || a.gasPrice));
        let transactionMap: any = {};
        let hashes = transactions.map((t: any) => t.hash);
        let uniqueAccounts: string[] = [...new Set(transactions.map((transaction: ProjectedEthereumTransaction) => transaction.from))] as string[]

        // console.log("TRANSACTIONS: " + transactions.length);

        // Test Cache 
        let cachedHashes = Object.keys(cache);
        let requestHashes: string[] = [];
        transactions.forEach((transaction: ProjectedEthereumTransaction) => {
            transactionMap[transaction.hash] = true;
            if (!cache[transaction.hash])
                requestHashes.push(transaction.hash);
        })
        cachedHashes.forEach((hash: string) => {
            if (!transactionMap[hash])
                delete cache[hash];
        })

        let qResult = await database.collection('transactions_ETH').find({ hash: { $in: requestHashes } }).project({ _id: 0, hash: 1, to: 1, house: 1, nonce: 1 }).toArray();

        qResult.forEach((doc: any) => {
            cache[doc.hash] = { to: doc.to, house: doc.house, nonce: doc.nonce };
        })
        // Edn Test Cache


        //TMP
        let _remove = await database.collection('transactions_ETH').find({ hash: { $in: hashes }, blockHash: { $ne: null } }).project({ hash: 1 }).toArray();
        _remove = _remove.map((tx: any) => tx.hash);

        transactions = transactions.filter((tx: any) => !_remove.includes(tx.hash));
        transactions = transactions.map((transaction: any) => ({ ...transaction, ...cache[transaction.hash] }));
        // End TMP

        transactions = await updateAccountNonces(ethWrapper, transactions);

        // The amount of transactions added by an account. 
        const addedByAddress: any = {};

        // The array of transactions to store. 
        var pendingList: any[] = [];
        const addedByHash: any = {};

        // ???
        const toMove: any = {};

        const pushAndCheckToMove = (transaction: any): boolean => {
            if (addedByHash[transaction.hash]) return;
            if (transaction.from)
                transaction.from = transaction.from.toLowerCase();

            // Add this transaction to the list to be sent out. 
            pendingList.push(transaction);
            addedByHash[transaction.hash] = true;

            // Increase the amount of transactions added by an address/account.
            if (!addedByAddress[transaction.from])
                addedByAddress[transaction.from] = 0;
            addedByAddress[transaction.from]++;

            // If there are transactions remaining in toMove
            if (toMove[transaction.from]?.length) {
                // The next transaction to 'process'
                const nextToAdd = toMove[transaction.from][0];
                // The next nonce is the currentTransactionCount + the amount of transactions added. 
                const nextNonce = (addedByAddress[transaction.from] || 0) + (transaction.fromNonce || 0);
                if (nextNonce === nextToAdd.nonce) {
                    // Remove the transaction from toMove
                    toMove[transaction.from].shift();
                    // Recursively call pushAndCheckToMove 
                    return pushAndCheckToMove(nextToAdd);
                }
            }

            // No transactions left to add from this address.
            return true;
        }

        // Iterate over the list of pending transactions.
        for (let i = 0; i < transactions.length; i++) {
            // if (pendingList.length >= 3000 * 4) break;
            const transaction = transactions[i];
            if (addedByHash[transaction.hash]) continue;
            transaction.from = transaction.from.toLowerCase()
            if (!addedByAddress[transaction.from])
                addedByAddress[transaction.from] = 0;
            // The next nonce is the currentTransactionCount + the amount of transactions added. 
            const nextNonce = (addedByAddress[transaction.from] || 0) + (transaction.fromNonce || 0);

            if (nextNonce === transaction.nonce) {
                pushAndCheckToMove(transaction);
            } else {
                if (!toMove[transaction.from])
                    toMove[transaction.from] = [];
                toMove[transaction.from].push(transaction);
            }
        }

        Object.keys(toMove).forEach((key) => {
            const arr = toMove[key];
            if (toMove[key].length) {
                toMove[key] = arr.sort((a: any, b: any) => a.nonce - b.nonce);
                pushAndCheckToMove(toMove[key][0]);
            }
        });

        if (pendingList.length > 3000)
            pendingList.splice(3000, pendingList.length - 3000);


        let count = 0;
        pendingList = pendingList.map((transaction: any) => {
            // transaction.fromNonce = accounts[transaction.from.toLowerCase()]
            transaction.type = transaction.maxFeePerGas ? 2 : 0;
            const formatted = formatTransaction("ETH", transaction)
            if (formatted.an == null) {
                count++;
            }
            return formatted;
        });

        if (count > 0) console.log(`Found ${count} accounts without a fromNonce in pending transaction creation`);

        // pendingList = pendingList.sort((a: any, b: any) => b.gp - a.gp);
        const content = JSON.stringify(pendingList);

        if (Date.now() - lastUploadTime >= 1990) {
            const _path = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'ETH-pendingTransactions.json');
            const writingFilePath = _path.replace(/\.json$/, '-writing.json');
            fs.writeFileSync(writingFilePath, content);
            fs.rename(writingFilePath, _path, (err) => {
                if (err) throw err
            });
            lastUploadTime = Date.now();
            await storeObject(path.join('live', `pendingTxs-ETH`), content);
        }

    } catch (error) {
        console.error(error);
    }
}, 2000).start(true);