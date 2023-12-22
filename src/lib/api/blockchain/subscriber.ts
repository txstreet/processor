// import redis from "./databases/redis";
import mongodb from "../../../databases/mongodb";
import { formatTransaction } from '../../../lib/utilities'

const subscribers: any = {};

// redis.subscribe('block');
// // redis.subscribe('pendingTx');

// redis.on('message', (channel: string, messageStr: string) => {
//     const message = JSON.parse(messageStr);
//     // console.log('channel', channel, 'message:', messageStr);
//     if (channel === 'block') {
//         const { chain, hash, height } = message;
//         console.log('chain:', chain);
//         const subscriber = subscribers[chain];
//         console.log('subscriber:', subscriber);
//         if (subscriber)
//             subscriber.resolveBlock(hash, height);
//     }

//     // if(channel === 'pendingTx') {
//     //     const hash = message.tx; 
//     //     const chain = message.chain.toUpperCase(); 
//     //     const subscriber = subscribers[chain]
//     //     // console.log(hash, message);
//     //     if(subscriber){
//     //         console.log(hash, message);
//     //         subscriber.resolveTx(hash);
//     //     }
//     // }
// });

class Subscriber {
    public chain: string;
    // public blockSubs: any = {};
    // public blockSubTimes: any = {};
    public txSubs: any = {};
    public txSubTimes: any = {};
    public checkingTxs: boolean = false;

    constructor(chain: string) {
        this.chain = chain.toUpperCase();
        if (subscribers[this.chain])
            throw 'Subscriber already exists for chain';
        subscribers[this.chain] = this;

        // setInterval(() => {
        //     const now = Date.now();
        //     for (const timestamp in this.blockSubTimes) {     
        //         if (now >= Number(timestamp)) {
        //             const ids = this.blockSubTimes[timestamp];
        //             ids.forEach((id: string | number) => {
        //                 this.blockSubs[id].forEach((callback: any) => callback('Timeout', true, null));
        //                 delete this.blockSubs[id];
        //             });
        //             delete this.blockSubTimes[timestamp];
        //         }
        //     }
        // }, 100);


        setInterval(() => {
            const now = Date.now();
            for (const timestamp in this.txSubTimes) {                    
                if (now >= Number(timestamp)) {
                    const ids = this.txSubTimes[timestamp];
                    delete this.txSubTimes[timestamp];
                    if(ids && ids.length)
                        ids.forEach((id: string | number) => {
                            if(this.txSubs[id] && this.txSubs[id].length)
                                this.txSubs[id].forEach((callback: any) => callback('Timeout', true, null));
                            delete this.txSubs[id];
                        });
                }
            }
        }, 100);

        setInterval(() => this.checkTxSubs(), 100)
    }

    async checkTxSubs() {
        if(this.checkingTxs || !Object.keys(this.txSubs).length) return;
        this.checkingTxs = true;
        try {
            const { database } = await mongodb();
            const collection = database.collection('transactions_' + this.chain);
            for (const hash in this.txSubs) {
                const tx: any = await collection.findOne({ hash, processed: true });
                if (tx) {
                    const formatted = formatTransaction(this.chain, tx); 
                    this.resolveTx(formatted);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            this.checkingTxs = false;
        } catch (err) {
            console.log(err);
            this.checkingTxs = false;
        }
    }

    // public subscribeToBlock(id: string | number, timeout: number, callback: (error: string, timeout: boolean, data: any) => any): void {
    //     const timestamp = Date.now() + timeout;
    //     if (!this.blockSubTimes[timestamp])
    //         this.blockSubTimes[timestamp] = [];
    //     this.blockSubTimes[timestamp].push(id);
    //     if (!this.blockSubs[id])
    //         this.blockSubs[id] = [];
    //     this.blockSubs[id].push(callback);
    //     console.log('Subscribed to id:', id);
    // }

    public subscribeToTx(id: string | number, timeout: number, callback: (error: string, timeout: boolean, data: any) => any): void {
        const timestamp = Date.now() + timeout;
        if (!this.txSubTimes[timestamp])
            this.txSubTimes[timestamp] = [];
        this.txSubTimes[timestamp].push(id);

        if (!this.txSubs[id])
            this.txSubs[id] = [];
        this.txSubs[id].push(callback);
    }

    // resolveBlock(hash: string, height: number) {
    //     console.log('Reolve called');
    //     const callbacks = (this.blockSubs[height] || []).concat(this.blockSubs[hash] || []);
    //     console.log('Callbacks:', callbacks.length);
    //     delete this.blockSubs[height];
    //     delete this.blockSubs[hash];
    //     callbacks.forEach((callback: any) => {
    //         // callback(null, false, `https://beta-storage.txstreet.com/cache-${hash}-${this.chain}.json`); 
    //         callback(null, false, hash);
    //     });
    // }

    resolveTx(data: any) {
        const callbacks = (this.txSubs[data.tx] || []);
        delete this.txSubs[data.tx];
        callbacks.forEach((callback: any) => {
            callback(null, false, data);
        });
    }
}

export default (chain: string): Subscriber => {
    chain = chain.toUpperCase();
    if (!subscribers[chain])
        new Subscriber(chain);
    return subscribers[chain];
}

