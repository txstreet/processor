import mongodb from "../../../../databases/mongodb"
import { Request, Response, Router } from 'express';
import { formatTransaction } from "../../../../lib/utilities";

const router = Router();

router.get('/:chain/:address', async (request: Request, response: Response) => {
    try {
        const chain = request.params.chain ? request.params.chain.toUpperCase() : null;
        let address = request.params.address;
        if(!chain)
            return response.json({ success: false, code: 0, message: `Chain not provided with request.` }); 
        if(!address)
            return response.json({ success: false, code: 0, message: `Address not provided with request.` }); 
        if(chain === "ETH") address = address.toLowerCase(); 

        const where = { $or: [ {from: address }, { to: address } ] }; 
        const { database } = await mongodb();
        const collection = database.collection(`transactions_${chain}`); 
        const results = await collection.find(where).sort({ timestamp: -1 }).limit(100).toArray(); 
        return response.json({ success: true, transactions: results.map((any: any) => formatTransaction(chain, any)) }); 
    } catch (error) {
        console.error(error); 
        return response.json({ success: false, code: 0, message: `Unknown error handling request.` }); 
    }
}); 

export default router;