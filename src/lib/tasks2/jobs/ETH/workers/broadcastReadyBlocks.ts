import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import { setInterval } from '../../../utils/OverlapProtectedInterval';
import { formatBlock, formatTransaction, storeObject } from '../../../../../lib/utilities';
// import calculateBlockStats from './calculateBlockStats';
import fs from 'fs';
import path from 'path';
const dataDir = path.join(process.env.DATA_DIR as string || '/mnt/disks/txstreet_storage');


setInterval(async () => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('blocks');
        const blocks = await collection.find({ chain: 'ETH', processed: true, txsChecked: true, broadcast: false, hash: { $ne: null } }).sort({ height: 1 }).limit(1).toArray();
        if (blocks.length < 1) return;
        const block = blocks[0];
        if (!block) return;
        console.log(`Found unprocessed block ${block.hash}`);
        await checkBlock(database, block);
    } catch (error) {
        console.error(error);
    }
}, 500).start(true);


const storeBlock = async (database: any, block: any) => {
    try {
        const remainingTxs = await database.collection('transactions_ETH').find({ confirmed: false, blockHash: block.hash, dropped: { $exists: false } }).count();
        if (remainingTxs > 0) {
            let remainingFull = await database.collection('transactions_ETH').find({ confirmed: false, blockHash: block.hash, dropped: { $exists: false } }).limit(20).toArray();
            for (let i = 0; i < remainingFull.length; i++) {
                const tx = remainingFull[i];
                if(tx.locked && Date.now() - tx.lockedAt > 3000){
                    await database.collection('transactions_ETH').updateOne({ hash: tx.hash }, { $set: { locked: false, processed: false } });
                }
            }
            console.log(`Block ${block.hash} is still waiting on ${remainingTxs} transactions to be processed.`);
            return false;
        }


        if (!block.transactions)
            block.transactions = [];

        block.txFull = {};
        const transactions = await database.collection('transactions_ETH').find({ hash: { $in: block.transactions }, confirmed: true }).toArray();
        if(block.transactions && block.transactions.length > 0 && transactions.length === 0){
            for (let i = 0; i < block.transactions.length; i++) {
                const hash = block.transactions[i];
                await database.collection('transactions_ETH').updateOne({ hash }, { $set: { blockHash: block.hash, blockHeight:block.height, blockNumber: block.number, confirmed: true, processed: false, locked: false, processFailures: 0, lastInsert: new Date(), insertedAt: new Date() }, $unset: { dropped: "" } }, { upsert: true });
            }
            return false;
        }
        // const transactions = await database.collection('transactions_ETH').find({ hash: { $in: block.transactions }, confirmed: true, dropped: { $exists: false } }).toArray();
        // if (block.transactions && block.transactions.length > 0 && transactions.length !== block.transactions.length) {
        //     const hashes = transactions.map((tx: any) => tx.hash);
        //     const missing = block.transactions.filter((hash: string) => hashes.indexOf(hash) == -1);
        //     // console.log(missing);
        //     for (let i = 0; i < missing.length; i++) {
        //         // if(i > 25) continue;
        //         const hash = missing[i];
        //         // await new Promise(resolve => setTimeout(resolve, 10));
        //         try {
        //             const existing = await database.collection('transactions_ETH').findOne({ hash });
        //             if (existing === null) {
        //                 database.collection('transactions_ETH').insertOne({ hash, chain: "ETH", processed: false, blockHash: block.hash, blockHeight:block.height, blockNumber: block.number, confirmed: true, lastInsert: new Date(), insertedAt: new Date(), processFailures: 0, locked: false });
        //             } else {
        //                 if (!existing.lastInsert || (Date.now() - Date.parse(existing.lastInsert)) / 1000 > 10)
        //                     await database.collection('transactions_ETH').updateOne({ hash }, { $set: { blockHash: block.hash, blockHeight:block.height, blockNumber: block.number, confirmed: true, processed: false, locked: false, processFailures: 0, lastInsert: new Date(), insertedAt: new Date() }, $unset: { dropped: "" } })
        //             }
        //         } catch (e) { console.log(e); }
        //     }
        //     return false;
        // }

        transactions.forEach((transaction: any) => {
            const formatted = formatTransaction('ETH', transaction);
            block.txFull[formatted.tx] = formatted;
        });

        console.log(`Stored Block:`, block.hash, 'TxFull', Object.values(block.txFull).length, 'Transactions:', transactions.length, 'Block transactions:', block.transactions?.length);

        const formattedBlock: any = formatBlock('ETH', block);
        formattedBlock.note = 'broadcastReadyBlocks';
        const fileContents = JSON.stringify(formattedBlock);

        const firstPart = block.hash[block.hash.length - 1];
        const secondPart = block.hash[block.hash.length - 2];
        // try { await fs.promises.mkdir(path.join(dataDir, 'blocks', 'ETH', firstPart, secondPart), { recursive: true }); } catch (err) { }
        await storeObject(path.join('blocks', 'ETH', firstPart, secondPart, block.hash), fileContents);
        // await calculateBlockStats(block, transactions);
        await database.collection('blocks').updateOne({ chain: 'ETH', hash: block.hash }, { $set: { stored: true, broadcast: false } });
        block.stored = true;
        block.broadcast = false;
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

const checkBlock = async (database: any, block: any, depth: number = 0) => {
    if (depth > 1) return true;

    try {
        // If the block is not stored, make sure all transactions are processed and then store it. 
        if (!block.stored) {
            console.log("Block not stored - " + block.hash);
            if (!(await storeBlock(database, block)))
                return false;
        }

        // Validate that the block's parent is stored, if it exists
        let parent = null;
        if (block.parentHash && depth === 0)
            parent = await database.collection('blocks').findOne({ chain: 'ETH', hash: block.parentHash });

        if (parent && !parent.processed) {
            console.log("Parent is not proccessed.");
            return false;
        }

        if (parent) {
            if (!await checkBlock(database, parent, depth + 1))
                return false;
        }

        // If the previous block passed all checks (or doesn't exist, sanity, depth limit). 
        if (block.stored && parent && parent.stored || block.stored && !parent) {
            let uncles = await database.collection('blocks').find({ chain: 'ETH', hash: { $in: block.uncles || [] } });
            let unclesStored = true;
            for (let i = 0; i < uncles.length; i++) {
                let uncle = uncles[i];
                if (!uncle.processed) {
                    unclesStored = false;
                    break;
                }

                if (!uncle.stored) {
                    if (!(await storeBlock(database, uncle))) {
                        unclesStored = false;
                        break;
                    }
                }
            }

            // If uncles aren't stored, the block isn't ready, stop.
            if (!unclesStored)
                return false;

            if (!block.height) block.height = block.number;
            redis.publish('block', JSON.stringify({ chain: 'ETH', height: block.height, hash: block.hash }));
            await database.collection('blocks').updateOne({ chain: 'ETH', hash: block.hash }, { $set: { broadcast: true, note: 'broadcast-ready-block' } });
            return true;
        } else {
            console.log("Block isn't ready, either block or parent is not stored");
            return false;
        }
    } catch (error) {
        console.error(error);
        return false;
    }
}