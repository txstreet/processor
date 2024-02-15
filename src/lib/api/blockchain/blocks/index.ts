// @ts-strict-ignore
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
        const filePath = path.join("blocks", chain, existingBlock.hash);
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
});

export default router; 
