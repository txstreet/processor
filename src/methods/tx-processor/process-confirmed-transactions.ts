import { BlockchainWrapper } from '../../lib/node-wrappers';
import { waitForTime } from '../../lib/utilities';
import unlockFailedTransactions from './unlock-failed-transactions';
import removeBadTransactions from './remove-bad-transactions';
import getConfirmedBatch from './get-confirmed-batch';
import storeConfirmedTransaction from './store-confirmed-transaction';
import checkBlockConfirmations from './check-block-confirmations';
import checkHousing from './check-housing';
import updateAccountNonces from './update-account-nonces';
import callChainHooks from '../../lib/chain-implementations';
import getContactCodes from './get-contact-codes';
import getReceipts from './get-receipts';
import axios from 'axios';
import redis from '../../databases/redis';

export default async (wrapper: BlockchainWrapper): Promise<any> => {
    try {
        // Obtain the batch that we're going to do work on.
        let transactionRequests = await getConfirmedBatch(wrapper);

        // If there were no transactions, provide a small delay to allow for more inserts.
        // Since pending transactions come directly from the mempool, this delay can be relatively small.
        if (transactionRequests.length < 1) {
            await waitForTime(30 + Math.floor(Math.random() * 70));
            return true;
        }

        console.log(`BATCH STARTED -- ${transactionRequests.length} requests`);

        // Create an array of Promises that will be used to asynchronously fulfill obtaining transaction data
        // from the node. 
        const tasks: Promise<any>[] = [];

        // Iterate over the transaction requests and create a task for each one. 
        transactionRequests.forEach((transactionRequest: any) => {
            // Our task is only going to allow for resolves, even on failures, this way Promise.all can be used
            // later with async/await.
            const task = new Promise(async (resolve) => {
                try {
                    // If the data supplied with the transactionRequest isn't detected as a transaction
                    // obtain the transaction from the node.

                    if (!wrapper.isTransaction(transactionRequest)) {
                        const nodeTransaction = await wrapper.getTransaction(transactionRequest.hash, 2);
                        if (!nodeTransaction) return resolve({ bad: true });
                        transactionRequest = { ...transactionRequest, ...nodeTransaction };
                    }

                    return resolve(transactionRequest);
                } catch (error) {
                    console.error(error);
                    return resolve({ failed: true });
                }
            });

            // Add it to the list of tasks, by not awaiting it here it allows asynchronous execution to be awaited later.
            tasks.push(task);
        });

        // Since all of our Promises only resolve, we can get away with Promise.all here without any tricks.
        transactionRequests = await Promise.all(tasks);

        if (wrapper.ticker === "ETH") {
            transactionRequests = await getContactCodes(wrapper, transactionRequests);
            transactionRequests = await getReceipts(wrapper, transactionRequests);
        }

        // Find all requests that have failed. 
        const failures = transactionRequests.filter((result: any) => result.failed);

        // Find all requests that have bad transactions.
        const badTransactions = transactionRequests.filter((result: any) => result.bad);

        // Find all requests that have completed successfully. 
        var transactions = transactionRequests.filter((result: any) => !result.failed && !result.bad);

        // if (wrapper.ticker === "ETH") {
        //     //set the nonce for all successful transaction confirms
        //     transactions.forEach(async transaction => {
        //         const key = (wrapper as any).ticker + "-nonce-" + transaction.from;
        //         let cached: any = await redis.getAsync(key);
        //         let oldNonce = Number(cached) || 0;
        //         redis.setAsync(key, Math.max(transaction.nonce, oldNonce), 'EX', 3600);
        //     });
        // }

        // Unlock all failed transactions, this is in it's own try/catch to not stop execution flow.
        try {
            await unlockFailedTransactions(wrapper, failures.map((result: any) => result.hash));
            if (failures.length) console.log("Unlocked failed transactions");
        } catch (error) {
            console.error(error);
        }

        // Delete all bad transactions from the database and broadcast the hashes through redis. 
        try {
            await removeBadTransactions(wrapper, badTransactions.map((result: any) => result.hash));
            if (badTransactions.length) console.log("Removed bad transactions");
        } catch (error) {
            console.error(error);
        }

        // Houses
        await checkHousing(wrapper, transactions);

        if ((wrapper as any).getTransactionCount) {
            transactions = await updateAccountNonces(wrapper, transactions, false, true);
        }

        // Update all successful transactions with the appropriate transaction data. 
        await storeConfirmedTransaction(wrapper, transactions);

        // By using a Set here we can remove all duplicate hashes.  
        let blockHashes = [...new Set(transactions.map((transaction: any) => transaction.blockHash))]
        await checkBlockConfirmations(wrapper, blockHashes);

        // Cleanup
        transactions.length = 0;
        badTransactions.length = 0;
        failures.length = 0;
        tasks.length = 0;
        transactionRequests.length = 0;

        console.log(`BATCH COMPLETED`);

        return true;
    } catch (error) {
        console.warn(`BATCH ABANDONED`);
        console.error(error);
        return false;
    }
}