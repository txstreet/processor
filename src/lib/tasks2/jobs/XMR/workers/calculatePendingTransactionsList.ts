import { formatTransaction, storeObject } from "../../../../../lib/utilities";
import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import path from 'path'; 

redis.subscribe('block');
redis.events.on('block', (data) => {
    const { chain } = data;
    if(chain !== 'XMR') return; 
    interval.force(); 
});

const interval = setInterval(async () => {
    try {
        const { database } = await mongodb(); 
        const collection = database.collection(`transactions_XMR`); 
        let transactions = await collection.find({ confirmed: false, processed: true, blockHash: { $eq: null }, dropped: { $exists: false }}).sort({ fee: -1 }).limit(3000).toArray();
        transactions = transactions.map((transaction: any) => formatTransaction('XMR', transaction)); 
        await storeObject(path.join('live', `pendingTxs-XMR`), JSON.stringify(transactions)); 
    } catch (error) {
        console.error(error); 
    }
}, 15000);