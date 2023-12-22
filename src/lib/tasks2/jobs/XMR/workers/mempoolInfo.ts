import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import { XMRWrapper } from '../../../../../lib/node-wrappers'; 

let lastExecutionResults = {
    'mempool-size': 0,
    'mempool-bytes': 0,
    'mempool-fees': 0,
}; 

setInterval(async () => {
    try {
        const wrapper = new XMRWrapper(process.env.XMR_NODE); 
        const results = await wrapper.rpc('get_transaction_pool_stats'); 
        if(results && results.pool_stats) {
            lastExecutionResults['mempool-size'] = results.pool_stats.txs_total;
            lastExecutionResults['mempool-bytes'] = results.pool_stats.bytes_total;
            lastExecutionResults['mempool-fees'] = results.pool_stats.fee_total;
        }
    } catch (error) {
        console.error(error); 
    } finally {
        // Wrapping a try/catch inside of a finally looks a little messy, but it's required to prevent a critical failure in the event
        // of a database error. We do this in finally so that we can make sure to update values that have successfully updated in the event
        // of an error.
        try {
            const { database } = await mongodb();
            const collection = database.collection('statistics');

            if(process.env.UPDATE_DATABASES.toLowerCase() == "true") {
                // TODO: Optimize to not re-insert data to lower bandwidth consumption. 
                await collection.updateOne({ chain: 'XMR' }, { $set: lastExecutionResults }); 
                redis.publish('stats', JSON.stringify({ chain: "XMR", ...lastExecutionResults })); 
            } else {
                console.log('=========================')
                console.log(lastExecutionResults);
            }
        } catch (error) {
            console.error(error); 
        }
    }
}, 5000).start(true);
