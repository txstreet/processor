import dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../../.env' });

import minimist from 'minimist'; 
Object.assign(process.env, minimist(process.argv.slice(2)));

import mongodb from '../databases/mongodb';
// @ts-ignore-nextline
import deepEqual from 'deepequal'; 

if(!process.env.chain)
    throw '--chain not specified';
if(!process.env.interval)
    throw '--interval not specified'; 

const isCron = process.env.cron == "true"; 
const chain = process.env.chain;
const expires = (process.env.expires || '').toLowerCase();
let millisToAdd = 0;
if(expires.includes('s'))
    millisToAdd = parseInt(process.env.expires) * 1000; 
if(expires.includes('m'))
    millisToAdd = parseInt(process.env.expires) * (1000 * 60); 
if(expires.includes('h'))
    millisToAdd = parseInt(process.env.expires) * ((1000 * 60) * 60); 
if(expires.includes('d'))
    millisToAdd = parseInt(process.env.expires) * (((1000 * 60) * 60) * 24); 
if(expires.includes('w'))
    millisToAdd = parseInt(process.env.expires) * ((((1000 * 60) * 60) * 24) * 7); 

let interval = (process.env.interval || '').toLowerCase(); 
let intervalMillis = 0; 
if(interval.includes('s'))
    intervalMillis = parseInt(process.env.interval) * 1000; 
if(interval.includes('m'))
    intervalMillis = parseInt(process.env.interval) * (1000 * 60); 
if(interval.includes('h'))
    intervalMillis = parseInt(process.env.interval) * ((1000 * 60) * 60); 
if(interval.includes('d'))
    intervalMillis = parseInt(process.env.interval) * (((1000 * 60) * 60) * 24); 
if(interval.includes('w'))
    intervalMillis = parseInt(process.env.interval) * ((((1000 * 60) * 60) * 24) * 7); 

const run = async () => {
    try {
        const { database } = await mongodb(); 
        const cStatistics = database.collection('statistics'); 
        const cHistory = database.collection('statistics_history'); 
        const cSnapshots = database.collection('statistics_history_snapshots'); 
        const currentTime = Date.now(); 

        let lastAggregatedResult = (await cSnapshots.find({ chain, interval }).sort({ createdAt: -1 }).limit(1).toArray())[0]; 
        if(!lastAggregatedResult) lastAggregatedResult = {}; 

        const currentHistory = await cStatistics.findOne({ chain }); 
        // console.log('currentHistory:', currentHistory);
        delete currentHistory._id; 
        const changeState: any = {}; 
        Object.keys(currentHistory).forEach((key: string) => {
            if(key.indexOf('bonfire') !== -1) return;

            const prev = lastAggregatedResult[key];
            const curr = currentHistory[key]; 
            if(!deepEqual(prev, curr)) {
                changeState[key] = curr; 
                lastAggregatedResult[key] = curr; 
            }
        });

        if(Object.keys(changeState).length > 0) {
            await cHistory.insertOne({ chain, interval, created: new Date(currentTime), expires: process.env.expires ? new Date(currentTime + millisToAdd) : null, changeState }); 
            await cSnapshots.updateOne({ chain, interval }, { $set: currentHistory }, { upsert: true }); 
        }
        console.log(`Finished calculating stat-history ledger for interval: ${interval}`);
        return true;
    } catch (error) {
        console.error(error);
        return true;
    }
}


(async () => {
    if(!isCron) {
        const execute = async () => {
            try { 
                await run();
            } catch (e) {
            } finally {
                setTimeout(() => execute(), intervalMillis); 
            }
        }
        execute();
    } else {
        console.log("running");
        await run();
        console.log("exiting");
        process.exit();
    }
})();