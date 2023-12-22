import SocketIO from 'socket.io';
import mongodb from '../../../databases/mongodb';
import io from '../../../entry/websocket-server'

interface FetchStatsConfig {
    // The key of the stat (i.e 'tps')
    key: string;
    // Should this request return historical data?
    history?: boolean;
    // The interval to return history data in milliseconds, or use format... (30s, 30m, 30h, 30d, 30w)
    // Supplying '5s' here means we want the stat updates that are applied every 5 seconds. 
    // This is being changed to allow for custom values. 
    // WIP: Leave as undefined 
    historyInterval?: string;
    // The maximum duration of history to return in milliseconds, or use format... (30s, 30m, 30h, 30d, 30w)
    // Supplying '15m' here means to return the last 15 minutes of stat updates. 
    // WIP, leave as undefined.  
    historyDuration?: string;
    // Rather or not this request should return the current value of the stat.
    returnValue?: boolean;
    // Rather or not this request should subscribe you for real-time updates to this stat. 
    subscribe?: boolean;
}

const intervals = ["1d", "1h", "5m", "5s"];

const maxHistoryLength = 1000;

const tickers = JSON.parse(process.env.TICKERS);

let stats: any = {};
let lastKnownTimestamps: any = {};


//interval to keep history lengths around maxHistoryLength
setInterval(() => {
    for (const ticker in stats) {
        const intervals = stats[ticker];
        for (const interval in intervals) {
            const keys = intervals[interval];
            for (const key in keys) {
                stats[ticker][interval][key] = stats[ticker][interval][key].sort((a: any, b: any) => a.timestamp - b.timestamp);
                stats[ticker][interval][key].splice(0, stats[ticker][interval][key].length - maxHistoryLength);     
            }
        }
    }
}, 1000 * 60 * 60 * 12);

const watchStatistics = async() => {
    let lastUpdate = Date.now();
    const { database } = await mongodb();

    setInterval(() => {
        const diff = Date.now() - lastUpdate;
        if(diff > 60000){
            console.log("stream not update in a while");
            process.exit(1);
        }
    }, 1000);

    console.log(`CREATING STATISTICS STREAM`);
    const statistics = database.collection('statistics');

    //get the documents keys for easy lookup from the stream results
    const documentKeys: {[key:string]:string} = {};
    const results = await statistics.find({}).project({chain: 1}).toArray();
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        documentKeys[result._id] = result.chain;
    }

    const pipeline = [{ $match: { "operationType":"update" } }];
    const stream = statistics.watch(pipeline);

    stream.on('end', function() {
        console.log('stream ended!');
        process.exit(1);
    });
    stream.on('error', (err: any) => {
        console.log(new Date() + ' error: ' + err);
        process.exit(1);
        // startStream();
    });
    stream.on('change', (next: any) => {
        // console.log(next);
        if (next.operationType !== 'update') return console.log('not update');
        lastUpdate = Date.now();
        const chain = String(documentKeys[next.documentKey._id]).replace("-nohistory", "");
        if(!tickers.includes(chain)) return console.log("bad chain", chain);
        
        const timestamp = new Date().getTime();
        const state = next.updateDescription.updatedFields;

        Object.keys(state).forEach((key: string) => {
            if(!stats?.[chain]?.["5s"]) {
                // console.log(stats);
                return;
            }
            stats[chain]["5s"][key] = [{ timestamp, value: state[key] }];
            io.to(`${chain}-stat-${key}`).emit('stat-updates', chain, key, state[key]);
        });
    });
}

const watchHistory = async() => {
    let lastUpdate = Date.now();
    const { database } = await mongodb();

    setInterval(() => {
        const diff = Date.now() - lastUpdate;
        if(diff > 60000){
            console.log("stream not update in a while");
            process.exit(1);
        }
    }, 1000);

    console.log(`CREATING STATISTICS HISTORY STREAM`);
    const statisticsHistory = database.collection('statistics_history');

    const pipeline = [
        { $match: {  "operationType":"insert" } }
    ]
    const stream = statisticsHistory.watch(pipeline);
    stream.on('end', function() {
        console.log('stream ended!');
        process.exit(1);
    });
    stream.on('error', (err: any) => {
        console.log(new Date() + ' error: ' + err)
        process.exit(1);
    });
    stream.on('change', (next: any) => {
        // Sanity checks. 
        if (next.operationType !== 'insert') return console.log('not insert');
        if (!next.fullDocument) return console.log('not full document');
        lastUpdate = Date.now();
        const ticker = next.fullDocument.chain;
        const interval = next.fullDocument.interval;
        if (!tickers.includes(ticker)) return console.log('bad ticker');
        if (!intervals.includes(interval)) return console.log('bad interval');

        const timestamp = new Date(next.fullDocument.created).getTime();
        const state = next.fullDocument.changeState;

        if (lastKnownTimestamps[ticker][interval] > timestamp)
            return;
        lastKnownTimestamps[ticker][interval] = timestamp;

        Object.keys(state).forEach((key: string) => {
            if (!stats[ticker][interval][key])
                stats[ticker][interval][key] = [];
            stats[ticker][interval][key].push({ timestamp, value: state[key] });
            // io.to(`${ticker}-stat-${key}`).emit('stat-updates', ticker, key, state[key]);
        });

        Object.keys(stats[ticker][interval]).forEach((key: string) => {
            stats[ticker][interval][key] = stats[ticker][interval][key].sort((a: any, b: any) => a.timestamp - b.timestamp);
        })
    });
}

const initNoHistory = async (ticker: string) => {
    const { database } = await mongodb();
    const result = await database.collection('statistics').findOne({ chain: `${ticker}-nohistory` });
    if (result) {
        // console.log('Found nohistory', result);
        const timestamp = new Date();
        Object.keys(result).forEach((key: string) => {
            stats[ticker]["5s"][key] = [{ timestamp, value: result[key] }];
        });
    }    
}

const initHistory = async (ticker: string, interval: string) => {
    stats[ticker][interval] = {};
    lastKnownTimestamps[ticker][interval] = 0;
    try {
        const { database } = await mongodb();
        const collection = database.collection('statistics_history');
        let results = await collection.find({ chain: ticker, interval }).sort({created: -1}).limit(maxHistoryLength).toArray();
        results.forEach((doc: any) => {
            const timestamp = new Date(doc.created).getTime()
            Object.keys(doc.changeState).forEach((key: string) => {
                if (!stats[ticker][interval][key])
                    stats[ticker][interval][key] = [];
                stats[ticker][interval][key].push({ timestamp, value: doc.changeState[key] });
            });
            if (timestamp > lastKnownTimestamps[ticker][interval])
                lastKnownTimestamps[ticker][interval] = timestamp;
        })

        Object.keys(stats[ticker][interval]).forEach((key: string) => {
            stats[ticker][interval][key] = stats[ticker][interval][key].sort((a: any, b: any) => a.timestamp - b.timestamp);
        })

        if(interval === "5s"){
            results = await database.collection('statistics').find({ chain: ticker }).toArray();
            results.forEach((doc: any) => {
                delete doc._id;
                delete doc.chain;

                const timestamp = new Date();
                Object.keys(doc).forEach((key: string) => {
                    if (!stats[ticker][interval][key])
                        stats[ticker][interval][key] = [];
                    stats[ticker][interval][key].push({ timestamp, value: doc[key] });
                });
                if (timestamp > lastKnownTimestamps[ticker][interval])
                    lastKnownTimestamps[ticker][interval] = timestamp;
            })
        }

    } catch (error) {
        console.error(error);
    }
}

const convert = (string: string) => {
    string = (string || '').toLowerCase();
    if (string.length <= 0) return 0;
    let value = parseInt(string);
    if (string.includes('s'))
        return parseInt(string) * 1000;
    if (string.includes('m'))
        return parseInt(string) * (1000 * 60);
    if (string.includes('h'))
        return parseInt(string) * ((1000 * 60) * 60);
    if (string.includes('d'))
        return parseInt(string) * (((1000 * 60) * 60) * 24);
    if (string.includes('w'))
        return parseInt(string) * ((((1000 * 60) * 60) * 24) * 7);
    return value;
}

// const keyExists = (ticker: string, key: string) :boolean => {
//    for (const interval in stats[ticker]) {
//        if(stats[ticker][interval][key]) return true;
//    }
//    return false;
// }

export default async (socket: SocketIO.Socket, chain: string, identifier: string, config: FetchStatsConfig) => {
    if (!tickers.includes(chain))
        return socket.emit('fetch-stat', identifier, 'Invalid chain supplied to request: ' + chain);

    const { key, history, historyInterval = '5s', historyDuration = '15m', returnValue, subscribe } = config;
    if (!key)
        return socket.emit('fetch-stat', identifier, `You must provide a stat-key with your request.`);
    if (!stats[chain]?.[historyInterval]?.[key]){
        return socket.emit('fetch-stat', identifier, `Key (${key} in ${historyInterval} in ${chain}) is unknown, please use a valid statistical identifier.`);
    }
        if (!history && !subscribe && !returnValue)
        return socket.emit('fetch-stat', identifier, `You must either request history, a return value, or subscribe to a stat.`);
    if (!intervals.includes(historyInterval.toLowerCase()))
        return socket.emit('fetch-stat', identifier, `Supported historyIntervals are ${intervals.toString()}'.`);

    const statLedger = stats[chain]?.[historyInterval]?.[key] || [];
    const statLedger5s = stats[chain]?.["5s"]?.[key] || [];
    const response: any = {};


    if (subscribe) {
        socket.join(`${chain}-stat-${key}`);
        response.subscribed = true;
    }

    if (returnValue && statLedger5s.length) {
        let value = statLedger5s[statLedger5s.length - 1].value
        if (socket.rooms.has(`${chain}-stat-${key}`)) {
            socket.emit('stat-updates', chain, key, value);
        } else {
            response.value = value;
        }
    }

    if (history) {
        const durationInMillis = convert(historyDuration);
        const ledger = statLedger.filter((item: any) => item.timestamp > Date.now() - durationInMillis);
        response.history = ledger.map((item: any) => ({ value: item.value, time: Math.round(item.timestamp / 1000) }));
    }

    return socket.emit('fetch-stat', identifier, null, response);
}

(async() => {
    for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        stats[ticker] = {};
        lastKnownTimestamps[ticker] = {};
        for (let j = 0; j < intervals.length; j++) {
            const interval = intervals[j];
            console.log("starting", ticker, interval);
            await initHistory(ticker, interval);
            console.log("done", ticker, interval);
        }
        await initNoHistory(ticker);
    }
    watchStatistics();
    watchHistory()
})();

