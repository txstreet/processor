import { BlockchainWrapper } from '../../lib/node-wrappers';
import { waitForTime } from '../../lib/utilities';
import getPendingBatch from './get-pending-batch';
import unlockFailedTransactions from './unlock-failed-transactions';
import removeBadTransactions from './remove-bad-transactions';
import storePendingTransaction from './store-pending-transaction';
import checkHousing from './check-housing';
import updateAccountNonces from './update-account-nonces';
import getReceipts from './get-receipts';
import getContactCodes from './get-contact-codes';

import checkSameNonce from './check-same-nonce';

// Takes the batch of pending transactions that have not been processed yet and verifies
// rather or not they exist, removing them from the database if not. If the transaction does
// exist we need to inform the client using redis.
export default async (wrapper: BlockchainWrapper): Promise<any> => {
    try {
        const transactionRequests = await getPendingBatch(wrapper);

        // If there were no transactions, provide a small delay to allow for more inserts.
        // Since pending transactions come directly from the mempool, this delay can be relatively small.
        if (transactionRequests.length < 1) {
            await waitForTime(30 + Math.floor(Math.random() * 70));
            return true;
        }

        console.log(`Got pending batch of ${transactionRequests.length} transactions.`);

        // Create an array of Promises that will be used to asynchronously fulfill obtaining transaction data
        // from the node. 
        const tasks: Promise<any>[] = [];

        // Iterate over the transaction requests and create a task for each one. 
        transactionRequests.forEach((transactionRequest: any) => {
            // Our task is only going to allow for resolves, even on failures, this way Promise.all can be used
            // later with async/await.
            const task = new Promise(async (resolve) => {
                try {
                    if (!transactionRequest.hash) {
                        return resolve({ request: transactionRequest, failed: true });
                    }

                    let transaction = null;
                    if (wrapper.isTransaction(transactionRequest))
                        transaction = transactionRequest;
                    else transaction = await wrapper.getTransaction(transactionRequest.hash, 2);

                    if (!transaction)
                        return resolve({ request: transactionRequest, failed: true });

                    // Assign transaction.node for ease-of-access. 
                    transaction.node = transactionRequest.node;

                    // Even though this is the processor for pending transactions, sometimes a user-request may come in where
                    // the transaction is confirmed, even though there's not a block for it to be included by to be processed.
                    // In this event, we still want the confirmed data (receipts, fees, etc) but don't care about processing a block. 
                    if (wrapper.isTransactionConfirmed(transaction)) {
                        if (wrapper.ticker === "ETH") {
                            transaction = await updateAccountNonces(wrapper, [transaction], true, true, false);
                            transaction = await getReceipts(wrapper, [transaction], true, false);
                            transaction = await getContactCodes(wrapper, [transaction], true, false);
                        }
                    }

                    return resolve({ request: transactionRequest, transaction });
                } catch (error) {
                    console.error(error);
                    return resolve({ request: transactionRequest, failed: true });
                }
            });

            // Add it to the list of tasks, by not awaiting it here it allows asynchronous execution to be awaited later.
            tasks.push(task);
        });

        // Since all of our Promises only resolve, we can get away with Promise.all here without any tricks.
        const results = await Promise.all(tasks);

        // Find all requests that have failed. 
        const failures = results.filter((result: any) => result.failed);

        // Find all requests that have bad transactions.
        const badTransactions = results.filter((result: any) => result.transaction == null);

        // Find all requests that have completed successfully. 
        var transactions = results.filter((result: any) => result.transaction).map((result: any) => result.transaction);

        // Unlock all failed transactions, this is in it's own try/catch to not stop execution flow.
        try {
            await unlockFailedTransactions(wrapper, failures.map((result: any) => result.request.hash));
        } catch (error) {
            console.error(error);
        }

        // Delete all bad transactions from the database and broadcast the hashes through redis. 
        try {
            await removeBadTransactions(wrapper, badTransactions.map((result: any) => result.request.hash));
        } catch (error) {
            console.error(error);
        }

        // Houses
        await checkHousing(wrapper, transactions);

        // Check to see if this wrapper implementation has a getTransactionCount function implemented. 
        if ((wrapper as any).getTransactionCount) {
            // Get list of accounts that need their txCount updated. 
            // var accounts: string[] = [... new Set(transactions.map(transaction => transaction.from))];
            transactions = await updateAccountNonces(wrapper, transactions);
            transactions = await checkSameNonce(wrapper, transactions);
        }

        // Update all successful transactions with the appropriate transaction data. 
        await storePendingTransaction(wrapper, transactions);

        // Cleanup
        transactions.length = 0;
        badTransactions.length = 0;
        failures.length = 0;
        results.length = 0;
        tasks.length = 0;
        transactionRequests.length = 0;

        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}


// chain, procesed, locked, processFailures, hash, from, insertedAt