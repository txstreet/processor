import mongodb from "../../../../databases/mongodb"
import { Request, Response, Router } from 'express';
import getSubscriber from '../subscriber';
import { formatTransaction } from '../../../../lib/utilities'
const router = Router();

// The amount of time a request is allowed to stay open waiting on a tx. 
const TIMEOUT_FOR_REQUEST = 1000 * 6; 

//max concurrrent pending requests
const MAX_CONCURRENT = 20;

router.get('/:chain/:id', async (request: Request, response: Response) => {
    let chain = request.params.chain;
    if(!chain) return response.json({ success: false, code: -1, message: 'Chain not provided in request.' }); 
    chain = chain.toUpperCase(); 

    if(!['ETH', 'RINKEBY', 'BTC', 'LTC', 'BCH', 'XMR', 'ARBI'].includes(chain))
        return response.json({ success: false, code: -1, message: 'Invalid chain specified' }); 

    // It is assumed that if a number is passed for the `id` parameter then a height is being requests. 
    const id = String(request.params.id); 
    if(!id || id.length > 100) return response.json({ success: false, code: -1, message: 'Txid not provided in request.' });

    let timeout = Number(request.query.timeout); 
    if(isNaN(timeout)) timeout = null; 

    const { database } = await mongodb();
    const collection = database.collection('transactions_' + chain); 

    // Check to see rather or not this request has already been entered into the database, if so obtain that data. 
    const existingTx: any = await collection.findOne({ hash: id }); 

    // If the block request already exists and has been processed, we simply process the request. 
    if(existingTx && existingTx.processed) {
        if(existingTx.dropped) {
            return response.json({ success: false, code: 5, message: "Transaction has been dropped" }); 
        }
        const formatted = formatTransaction(chain, existingTx); 
        return response.json({ success: true, data: formatted }); 
    }


    // Obtain a reference to the subscriber instance, which is used to resolve a request whenever a block/transaction 'request'
    // has finished being processed by moderating the REDIS feed. 
    const subscriber = getSubscriber(chain);
    
    if(Object.keys(subscriber.txSubs).length > MAX_CONCURRENT)
        return response.json({ success: false, code: 2, message: `The server is currently too busy to process this request.` }); 

    // Register a callback that will resolve this request.
    subscriber.subscribeToTx(id, timeout || TIMEOUT_FOR_REQUEST, async (error: string, timeout: boolean, data: any) => {
        if(error && !timeout)
            return response.json({ success: false, code: 3, message: error }); 
        if(error && timeout)
            return response.json({ success: false, code: 4, message: 'The request has timed out.' });
        return response.json({ success: true, data });
    });

    // If the request is not already in the database, insert it so that we can queue the processing of this block. 
    // This must be done after `subscriber.subscribeToBlock` which is why it's not in the above else/if block. 
    if(!existingTx) {
        await collection.insertOne({ hash: id, chain, processed: false, confirmed: false, lastInsert: new Date(), insertedAt: new Date(), processFailures: 0, locked: false })
    }
});

export default router; 