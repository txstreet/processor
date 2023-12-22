import mongodb from "../../../../databases/mongodb"
import { Request, Response, Router } from 'express';
import getSubscriber from '../subscriber';
import { readNFSFile } from "../../../../lib/utilities";
import path from 'path'; 

const router = Router();

// The maximum amount of unprocessed blocks allowed in the database before a request is considered 'rate-limited'. 
const MAX_DB_REQUESTS_BEFORE_RATELIMITED = 100;

// The amount of time a request is allowed to stay open waiting on a block. 
const TIMEOUT_FOR_REQUEST = 1000 * 15; 

router.get('/:chain/:id', async (request: Request, response: Response) => {
    let chain = request.params.chain;
    
    if(!chain) return response.json({ success: false, code: -1, message: 'Chain not provided in request.' }); 
    chain = chain.toUpperCase(); 

    if(!['ETH', 'RINKEBY', 'BTC', 'LTC', 'BCH', 'XMR', 'ARBI'].includes(chain))
        return response.json({ success: false, code: -1, message: 'Invalid chain specified' }); 

    // It is assumed that if a number is passed for the `id` parameter then a height is being requests. 
    let isHeight = !isNaN(Number(request.params.id)); 
    if(request.params.id.toLowerCase().includes("0x")) 
        isHeight = false; 
    
    console.log('Is height:', isHeight, request.params.id);

    const id = isHeight ? Number(request.params.id) : request.params.id; 
    if(!id) return response.json({ success: false, code: -1, message: 'Block id not provided in request.' });
    if(isHeight && id <= 0) return response.json({ success: false, code: -1, message: 'Block id (height) is invalid' });

    // Rather or not this request returns the data or a link to the data. 
    // const verbose = request.query.verbose === "true" ? true : false; 

    let timeout = Number(request.query.timeout); 
    if(isNaN(timeout)) timeout = null; 

    const { database } = await mongodb();
    const collection = database.collection('blocks'); 

    // Validation of requests that are requesting a block based on a height. 
    if(isHeight) { 
        // Obtain the highest known block so that we can make sure `height` isn't overshot. 
        const highestBlock = (await collection.find({ chain }, { height: 1 }).sort({ height: -1 }).limit(1).toArray())[0]; 
        const topHeight = highestBlock?.height || 0; 
        if(id > topHeight)
            return response.json({ success: false, code: -1, message: `Block id (height) is higher than known head.` })
    } else {
        // TODO: Hash validation. 
    }

    // Check to see rather or not this request has already been entered into the database, if so obtain that data. 
    const existingBlock: any = await collection.findOne({ [isHeight ? 'height' : 'hash']: id }); 

    // If the block request already exists and has been processed, we simply process the request. 
    if(existingBlock && existingBlock.processed && existingBlock.lastTransactionFetch > Date.now() - 1209600000) {
        const firstPart = existingBlock.hash[existingBlock.hash.length - 1];
        const secondPart = existingBlock.hash[existingBlock.hash.length - 2]; 
        const directory = process.env.DATA_DIR || path.join('/mnt', 'disks', 'txstreet_storage'); 
        const filePath = path.join(directory, "blocks", chain, firstPart, secondPart, existingBlock.hash);
        const foundData = await readNFSFile(filePath);  

        if(!foundData) {
            return response.json({ success: false, code: 1, message: `File not found in storage` })
        } else {
            return response.json({ success: true, data: JSON.parse(foundData) });
        }
    }
    else{
        return response.json({ success: false, code: 2, message: `Block is not servicable` })
    }
    //     // If the block requests already exists, but has not been processed yet. 
    //     else if(existingBlock && (!existingBlock.processed || existingBlock.lastTransactionFetch <= Date.now() - 1209600)) {
    //         // Check the requests position in the queue to be processed to determine rather or not the client is 
    //         // "rate-limited" or will keep an open-request waiting for data. The queue position is determined by 
    //         // querying for all processed:false blocks that have a lower insertedAt field. See below (other) 'isRateLimited'
    //         // declaration for more information on 'rate-limiting' in this context. 
    //         let isRateLimited = await collection.find({ processed: false, insertedAt: { $lt: existingBlock.insertedAt } })
    //             .limit(MAX_DB_REQUESTS_BEFORE_RATELIMITED)
    //             .count(true) >= MAX_DB_REQUESTS_BEFORE_RATELIMITED; 

    //         // If the request can not be processed in a timely manner, tell the client the server is too busy. 
    //         if(isRateLimited) {
    //             return response.json({ success: false, code: 2, message: `The server is currently too busy to process this request.` }); 
    //         } 
    //     } 
    //     // If the block request doesn't already exist. 
    //     else if(!existingBlock) {
    //         // Check to see if we should inform the client that this request is being rate-limited. 
    //         // Because of the type of request, this is decided based on the current workload of the processor applications, in this case 
    //         // by determining the amount of blocks that the processor needs to handle, if that amount is over MAX_DB_REQUESTS_BEFORE_RATELIMITED 
    //         // then this request will not back it back to the client in a timely manner. 
    //         // NOTE: This is not real rate-limiting, as we still process the request and cache the data for future requests that need to access it. 
    //         let isRateLimited = await collection.find({ processed: false })
    //             .limit(MAX_DB_REQUESTS_BEFORE_RATELIMITED)
    //             .count(true) >= MAX_DB_REQUESTS_BEFORE_RATELIMITED; 

    //         // If the request can not be processed in a timely manner, tell the client the server is too busy. 
    //         if(isRateLimited) {
    //             return response.json({ success: false, code: 2, message: `The server is currently too busy to process this request.` }); 
    //         } 
    //     }

    // // Rate-limiting has not been deemed necessary, so create/register a callback for this request. 
    // // Obtain a reference to the subscriber instance, which is used to resolve a request whenever a block/transaction 'request'
    // // has finished being processed by moderating the REDIS feed. 
    // const subscriber = getSubscriber(chain); 

    // // Register a callback that will resolve this request.
    // subscriber.subscribeToBlock(id, timeout || TIMEOUT_FOR_REQUEST, async (error: string, timeout: boolean, hash: string) => {
    //     if(error && !timeout)
    //         return response.json({ success: false, code: 3, message: error }); 
    //     if(error && timeout)
    //         return response.json({ success: false, code: 4, message: 'The request has timed out.' });

    //     const firstPart = hash[hash.length - 1];
    //     const secondPart = hash[hash.length - 2]; 
    //     const directory = process.env.DATA_DIR || path.join('/mnt', 'disks', 'txstreet_storage'); 
    //     const filePath = path.join(directory, "blocks", chain, firstPart, secondPart, hash);
    //     const foundData = await readNFSFile(filePath, 'utf8');  

    //     if(!foundData || foundData.length === 0) {
    //         return response.json({ success: false, code: 1, message: `File not found in storage` })
    //     } else {
    //         return response.json({ success: true, data: JSON.parse(String(foundData)) });
    //     }
    // });

    // // If the request is not already in the database, insert it so that we can queue the processing of this block. 
    // // This must be done after `subscriber.subscribeToBlock` which is why it's not in the above else/if block. 
    // if(!existingBlock) {
    //     await collection.insertOne({ [isHeight ? 'height' : 'hash']: id, chain, processed: false, insertedAt: new Date(), processMetadata: true, processTransactions: true, processFailures: 0, locked: false })
    // } else {
    //     await collection.updateOne({ [isHeight ? 'height': 'hash' ]: id, chain }, { $set: { processed: false, processTransactions: true }}); 
    // }
});

export default router; 