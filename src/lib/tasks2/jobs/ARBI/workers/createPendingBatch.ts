// IN PROGRESS - OPTIMIZATION|| Refactoring to use memory transactions, paused to fix other important issues. 

import mongodb from '../../../../../databases/mongodb';
import { storeObject } from '../../../../../lib/utilities';
import { setInterval } from '../../../utils/OverlapProtectedInterval';
import fs from 'fs';
import path from 'path';
import { ETHTransactionsSchema } from '../../../../../data/schemas';

const readFile = (path: string) => new Promise<Buffer>((resolve, reject) => {
    fs.readFile(path, { flag: 'rs' }, (err: NodeJS.ErrnoException, data: Buffer) => {
        if (err) return reject(err);
        return resolve(data);
    })
})


let lastUploadTime = 0;


// The purpose of this function is to curate and store the JSON information for the current pending transaction list. 
setInterval(async () => {
    try {
        const { database } = await mongodb();

        const lastPost = await database.collection('transactions_ETH').find({from:"0xc1b634853cb333d3ad8663715b08f41a3aec47cc"}).sort({timestamp: -1}).limit(1).toArray();
        const lastPostTx = lastPost[0];
        // console.log(lastPost, "lastPost");

        const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'transactions-ARBI.bin');

        let data = await readFile(dataPath);
        let parsed = ETHTransactionsSchema.fromBuffer(data);

        // console.log(new Date(lastPostTx.insertedAt).getTime(), parsed.collection[0].insertedAt, parsed.collection.length, parsed.collection[0]);

        let transactions = parsed.collection.filter((transaction: any) => transaction.insertedAt > new Date(lastPostTx.insertedAt).getTime());
        let hashes = transactions.map((t: any) => t.hash);

        // console.log(hashes.length, "arbi txs");

        database.collection('statistics').updateOne({ chain: 'ARBI' },{ $set: {pendingBatchCount: hashes.length }});
        // transactions = transactions.filter((tx: any) => !_remove.includes(tx.hash));


        if (Date.now() - lastUploadTime >= 1990) {
            // const _path = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'ARBI-pendingBatch.json');
            // const writingFilePath = _path.replace(/\.json$/, '-writing.json');
            // fs.writeFileSync(writingFilePath, content);
            // fs.rename(writingFilePath, _path, (err) => {
            //     if (err) throw err
            // });
            lastUploadTime = Date.now();
            await storeObject(path.join('live', `pendingBatch-ARBI`), JSON.stringify(hashes));
        }

    } catch (error) {
        console.error(error);
    }
}, 2000).start(true);