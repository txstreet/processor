import redis from '../../../databases/redis'; 
import { XMRWrapper } from '../../../lib/node-wrappers';
import mongodb from '../../../databases/mongodb';

export default async (chain: string): Promise<void> => {
    try {
        const node = new XMRWrapper(process.env.XMR_NODE as string);

        const { database } = await mongodb();
        const collection = database.collection('transactions_' + chain || '');

        const mempoolSizeStat = await database.collection("statistics").find({chain}).project({"mempool-size": 1}).toArray();
        if(!mempoolSizeStat?.[0]?.['mempool-size']){
            console.log("mempoolSizeStat not found", mempoolSizeStat);
            return;
        }
    
        const mempoolSizeStatValue = mempoolSizeStat[0]['mempool-size'];

        const mempoolResults = await node.rpc('get_transaction_pool');//.map((entry: any) => entry.id_hash);
        const mempool = Object.values(mempoolResults.transactions).map((a: any) => a.id_hash);

        let doDelete = true;
        //mempool length is abnormally small, so dont process it because it would delete transactions we dont want to delete
        if(mempool.length < mempoolSizeStatValue * 0.75){
            doDelete = false;
            console.log(`Mempool size ${mempool.length} much smaller than stat ${mempoolSizeStatValue}`);
        }
        const mempoolTxKeys = mempool.reduce((acc:any,curr:string)=> (acc[curr]=true,acc),{});

        const transactions  = await collection.find({ confirmed: false, processed: true, dropped: { $exists: false } }).project({ _id: 1, hash: 1 }).toArray(); 
        const deleteHashes: string[] = []; 
        
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
    } catch (error) {
        console.error(error);
    }
}