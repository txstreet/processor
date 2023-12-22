import { formatTransaction, storeObject } from "../../../../../lib/utilities";
import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import path from 'path'; 
import { BTCTransactionsSchema } from "../../../../../data/schemas";
import { ProjectedBTCTransaction } from "../../../types";
import fs from 'fs';

const cache: any = {};

let lastBlock: any = false;

const getLastBlock = async (height: number = 0) => {
    const { database } = await mongodb();
    const collection = database.collection(`blocks`);
    let results = await collection.find({chain: "LTC", broadcast: true, height: {$gte: height}}).sort({height:-1}).limit(1).toArray();
    if(results.length){
        lastBlock = results[0];
    } else {
        setTimeout(() => {
            getLastBlock(height);
        }, 5000);
    }
}

redis.subscribe('block');
redis.events.on('block', (data) => {
    const { chain } = data;
    if(chain !== 'LTC') return; 
    getLastBlock(data.height);
    interval.force(); 
});

const readFile = (path: string) => new Promise<Buffer>((resolve, reject) => {
    fs.readFile(path, (err: NodeJS.ErrnoException, data: Buffer) => {
        if(err) return reject(err);
        return resolve(data); 
    })
})

const interval = setInterval(async () => {
    try {
        const { database } = await mongodb();
        const collection = database.collection(`transactions_LTC`);
        const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'LTC-pendingTransactions.bin'); 
        let data = await readFile(dataPath);
        let parsed = BTCTransactionsSchema.fromBuffer(data);
        console.log("LTC PENDING " + parsed.collection.length);
        let pTransactions = parsed.collection.sort((a: ProjectedBTCTransaction, b: ProjectedBTCTransaction) =>  b.fee - a.fee);

        let hashes: string[] = pTransactions.map((tx: ProjectedBTCTransaction) => tx.hash); 
        let needed: string[] = [];

        // Determine missing items in cache. 
        hashes.forEach((hash: string) => {
            if(!cache[hash])
                needed.push(hash); 
        })

        // Cache needed items. 
        let results = await collection.find({ hash: { $in: needed }}).project({ hash: 1, extras: 1, total: 1 }).toArray(); 
        results.forEach((result: any) => {
            cache[result.hash] = result; 
        })

        // Assign cache. 
        for(let i = 0; i < pTransactions.length; i++) {
            let cached = cache[pTransactions[i].hash]; 
            Object.assign(pTransactions[i], cached); 
        }

        //make sure last block is set
        if(!lastBlock) await getLastBlock();
        //loop through all and remove mweb transactions that are older than last block. temporary until we can validate they were included
        for (let i = pTransactions.length - 1; i >= 0; i--) {
            let tx = pTransactions[i];
            if(lastBlock.timestamp && tx?.extras?.mweb){
                let difference = lastBlock.timestamp - (tx.insertedAt / 1000);
                if(difference > 0) pTransactions.splice(i, 1);
            }
        }

        // Remove unused cached items
        Object.keys(cache).forEach((key: string) => {
            if(!hashes.includes(key))
                delete cache[key]; 
        })

        await storeObject(path.join('live', `pendingTxs-LTC`), JSON.stringify(pTransactions.map((tx: any) => formatTransaction('LTC', tx)))); 
    } catch (error) {
        console.error(error); 
    }
}, 3000).start(true);