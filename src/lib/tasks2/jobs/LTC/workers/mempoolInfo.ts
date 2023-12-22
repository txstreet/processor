import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import { LTCWrapper } from '../../../../../lib/node-wrappers'; 

let lastExecutionResults = {
    'mempool-size': 0,
    'mempool-bytes': 0,
}; 

setInterval(async () => {
    try {
        const wrapper = new LTCWrapper(
            { username: 'user', password: 'pass', host: process.env.LTC_NODE as string, port: Number(process.env.LTC_NODE_PORT) || 9332 },
            { host: process.env.LTC_NODE as string, port: Number(process.env.LTC_NODE_ZMQPORT) || 28332 }); 

        const promise = () => new Promise((resolve, reject) => {
            wrapper.rpc.getMemPoolInfo((err: any, resp: any) => {
                if(err) return reject(err); 
                if(!resp || !resp.result) return reject('Missing result');

                return resolve({
                    bytes: resp.result.bytes,
                    size: resp.result.size
                })
            });
        });

        const results: any = await promise();
        if(results) {
            lastExecutionResults['mempool-size'] = results.size;
            lastExecutionResults['mempool-bytes'] = results.bytes;
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
                await collection.updateOne({ chain: 'LTC' }, { $set: lastExecutionResults }); 
                redis.publish('stats', JSON.stringify({ chain: "LTC", ...lastExecutionResults })); 
            } else {
                console.log('=========================')
                console.log(lastExecutionResults);
            }
        } catch (error) {
            console.error(error); 
        }
    }
}, 5000).start(true);
