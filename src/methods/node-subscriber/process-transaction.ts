import { BlockchainWrapper } from '../../lib/node-wrappers';
import { waitForTime } from '../../lib/utilities';
import claimTransaction from './claim-transaction';
import storeTransaction from './store-transaction';
import updateAccountNonces from '../tx-processor/update-account-nonces';
import checkSameNonce from './check-same-nonce';
import checkBlocksForTx from './check-blocks-for-tx';
import Bottleneck from 'bottleneck';
import callChainHooks from '../../lib/chain-implementations'; 
const limiter = new Bottleneck({
    maxConcurrent: 4
}); 


let hack = true; 

// Generic workflow for processing a transaction to submit a processing request. 
// Works with all blockchains based on their BlockchainNode implementation. 
export default async (wrapper: BlockchainWrapper, transaction: any): Promise<any> => {
    try { 
        // If we are unable to claim this transaction, do not continue. 
        if(!(await claimTransaction(wrapper.ticker, transaction.hash))) {
            return;
        }

        // Short delay to allow time for the transaction to be dropped.
        await waitForTime(100);

        // Processed is set to true whenever a the process of obtaining a transaction is considered completed.
        // This may be set to true as soon as an event supplies the transaction data, or may be held onto as 
        // false to allow for deffered checking of the mempool to prevent 'processing' dropped transactions. 
        if(!transaction.processed) {
            let nodeTransaction = await wrapper.getTransaction(transaction.hash, 2);
            if(!nodeTransaction) return; 
            transaction = { ...transaction, ...nodeTransaction, processed: true }; 
        }

        // Check the database to make sure that the transaction isn't inlcuded in a block anywhere.
        if(await checkBlocksForTx(wrapper, transaction)) 
            return; 

            
        if((wrapper as any).getTransactionCount && !transaction.fromNonce) {
            transaction = await updateAccountNonces(wrapper, [transaction], true); 
            transaction = await checkSameNonce(wrapper, transaction);
            if(!transaction) return; 
        }
        await callChainHooks(wrapper.ticker, transaction); 

        if((wrapper as any).getPendingExtras) {
            if(["BTC", "LTC", "BCH"].includes(wrapper.ticker)) {
                let extras: any = await limiter.schedule(() => (wrapper as any).getPendingExtras(transaction));
                transaction = { ...transaction, ...extras }; 
            } else {
                let extras = await (wrapper as any).getPendingExtras(transaction); 
                transaction = { ...transaction, ...extras }; 
            }
        }
        
        // Store the transaction
        await storeTransaction(wrapper, transaction); 

        if(process.env.USE_DATABASE !== "true") 
            console.log("Tx Processed:", transaction); 
    } catch (error) {
        console.error(error);
    }
}
