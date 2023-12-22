import { formatTransaction, storeObject } from "../../../../../lib/utilities";
import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import path from 'path'; 
import { BTCTransactionsSchema } from "../../../../../data/schemas";
import { ProjectedBTCTransaction } from "../../../types";
import fs from 'fs';

const cache: any = {}; 

redis.subscribe('block');
redis.events.on('block', (data) => {
    const { chain } = data;
    if(chain !== 'BTC') return; 
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
        const collection = database.collection(`transactions_BTC`);
        const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'BTC-pendingTransactions.bin'); 
        let data = await readFile(dataPath);
        let parsed = BTCTransactionsSchema.fromBuffer(data);
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

        // Remove unused cached items
        Object.keys(cache).forEach((key: string) => {
            if(!hashes.includes(key))
                delete cache[key]; 
        })

        await storeObject(path.join('live', `pendingTxs-BTC`), JSON.stringify(pTransactions.map((tx: any) => formatTransaction('BTC', tx)))); 
    } catch (error) {
        console.error(error); 
    }
}, 3000).start(true);