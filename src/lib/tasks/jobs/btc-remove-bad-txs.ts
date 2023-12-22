import redis from '../../../databases/redis'; 
import { BTCWrapper, LTCWrapper, BCHWrapper } from '../../../lib/node-wrappers'; 
import mongodb from '../../../databases/mongodb';

const wrappers: any = {
    BTCWrapper, LTCWrapper, BCHWrapper
}

export default async (chain: string): Promise<void> => {
    try {
        const node = new wrappers[chain + "Wrapper"]({ username: 'user', password: 'pass', host: process.env[chain + "_NODE"], port: chain === "LTC" ? Number(process.env.LTC_NODE_PORT) || 9332 : Number(process.env[chain + "_NODE_PORT"]) || 8332 });

        const { database } = await mongodb();
        const collection = database.collection('transactions_' + chain || ''); 

        const mempoolSizeStat = await database.collection("statistics").find({chain}).project({"mempool-size": 1}).toArray();
        if(!mempoolSizeStat?.[0]?.['mempool-size']){
            console.log("mempoolSizeStat not found", mempoolSizeStat);
            return;
        }
        
        const mempoolSizeStatValue = mempoolSizeStat[0]['mempool-size'];

        node.rpc.getrawmempool(false, async (err: string, result: any) => {
            if(err) return console.error('err:', err);

            let doDelete = true;
            //mempool length is abnormally small, so dont process it because it would delete transactions we dont want to delete
            if(result.result.length < mempoolSizeStatValue * 0.75){
                doDelete = false;
                console.log(`Mempool size ${result.result.length} much smaller than stat ${mempoolSizeStatValue}`);
            }

            const mempoolTxKeys = result.result.reduce((acc:any,curr:string)=> (acc[curr]=true,acc),{});

            //get txs from database
            const transactions  = await collection.find({ confirmed: false, processed: true, dropped: { $exists: false } }).project({ _id: 1, hash: 1 }).toArray(); 
            const deleteHashes: string[] = []; 

            //first run over db txs to see if they also exist in mempool
            const writeInstructions: any[] = [];
            transactions.forEach((transaction: any) => {
                const existsInMempool = Boolean(mempoolTxKeys[transaction.hash]);

                if(!existsInMempool) {
                    deleteHashes.push(transaction.hash); 
                    writeInstructions.push({
                        updateOne: {
                            filter: { _id: transaction._id },
                            update: { $set: { dropped: true } }
                        }
                    });
                }
                if(existsInMempool){
                    delete mempoolTxKeys[transaction.hash];
                }
            });
            if(writeInstructions.length && doDelete) {
                console.log(`Removed ${writeInstructions.length} bad transactions`);
                await collection.bulkWrite(writeInstructions, { ordered: false });
                redis.publish('removeTx', JSON.stringify({ chain, hashes: deleteHashes }));
            }

            //TODO add mempool txs to db
            console.log("db is missing txs: ", Object.keys(mempoolTxKeys).length);
            // for (const hash in mempoolTxKeys) {
            //     //get tx data from node
            //     console.log("adding: " + hash);
            //     //add to db if it doesn't exist
            // }

        });
    } catch (error) {
        console.error(error);
    }
}