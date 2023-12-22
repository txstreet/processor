import dotenv from 'dotenv';
dotenv.config();
import SocketIO from 'socket.io'; 
import http from 'http'; 
import fs from 'fs';
import path from 'path'; 
import Express, { Response } from 'express'; 
import redis from '../lib/websocket/redis'; 
import mongodb from '../databases/mongodb'; 
import { lastBlocks  } from '../lib/websocket/redis/handlers/block';
import { lastHouseTxs  } from '../lib/websocket/redis/handlers/pendingTx';
import { formatTransaction } from '../lib/utilities';
const app = Express(); 


const server = http.createServer(app); 

const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ['Content-Type', 'Accept']
    }
});  

const eventHandlers: any = {}; 
const handlersPath: string = path.join(__dirname, '..', 'lib', 'websocket', 'socket-events'); 
var handlersloaded = false;
const loadEvents = async(): Promise<boolean> => {
    if(handlersloaded) return true; 
    console.log("Loading events..."); 
    const filenames = fs.readdirSync(handlersPath); 
    console.log("Found files:", filenames); 
    for(let i = 0; i < filenames.length; i++) {
        const filename = filenames[i];
        if(filename.includes('.map')) continue;
        if(!filename.includes('.js')) continue; 
        let realname = filename.replace('.js', ''); 
        const handlerPath = path.join(__dirname, '..', 'lib', 'websocket', 'socket-events', filename); 
        const handler = await import(handlerPath);
        eventHandlers[realname] = handler.default; 
        console.log("Loaded event", filename); 
    }
    handlersloaded = true;
    return true; 
}

const redisHandlers: any = {}; 
const redisPath = path.join(__dirname, '..', 'lib', 'websocket', 'redis', 'handlers'); 
const filenames = fs.readdirSync(redisPath); 
filenames.forEach(async filename => {
    if(!filename.includes('.js')) return; 
    if(filename.includes('.map')) return; 
    const realname = filename.replace('.js', '');
    const handlerPath = path.join(__dirname, '..', 'lib', 'websocket', 'redis','handlers', filename);  
    const handler = await import(handlerPath);
    redisHandlers[realname] = handler.default; 
    redis.subscribe(realname);
})

const start = async () => {
    const { database } = await mongodb(); 
    // await initStats(); 
    const blockTasks: any[] = [];
    const houseTasks: any[] = [];
    const allHouses = await database.collection('houses').find({}).toArray(); 
    const tickers = JSON.parse(process.env.TICKERS as string); 

    const blockTask = (ticker: string) => new Promise(async (resolve) => {
        const where = { chain: ticker };
        const project: any = { _id: 0, hash: 1 }; 
        const collection = database.collection('blocks'); 
        const blocks = await collection.find(where, project).sort({ height: -1, number: -1 }).limit(5).toArray(); 
        const hashes = blocks.map((block: any) => {
            return block.hash
        }); 
        lastBlocks[ticker] = hashes; 
        return resolve(true);
    });

    const houseTask = async (ticker: string) => {
        console.log("Finding house info for ticker:", ticker); 
        const houses = allHouses.filter((house: any) => house.chain === ticker); 
        const collection = database.collection('transactions_' + ticker); 

        for(let i = 0; i < houses.length; i++) {
            const house = houses[i];
            const txs = await collection.find({ house: house.name }).sort({ insertedAt: -1 }).limit(5).toArray(); 

            if(!lastHouseTxs[ticker])
                lastHouseTxs[ticker] = {}; 
        
            if(!lastHouseTxs[ticker][house.name])
                lastHouseTxs[ticker][house.name] = [];
                
            lastHouseTxs[ticker][house.name] = txs.map((tx: any) => formatTransaction(ticker, tx)); 
        }
        console.log("Finished finding house info for ticker:", ticker); 
        return true; 
    }

    for(let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        blockTasks.push(blockTask(ticker)); 
        houseTasks.push(houseTask(ticker));
    }

    await Promise.all(blockTasks);
    await Promise.all(houseTasks);
    await loadEvents();

    io.on('connection', async (socket: SocketIO.Socket ) => {
        try { 
            await loadEvents(); 
        } catch (error) {
            console.error(error); 
            socket.disconnect(); 
            return; 
        }
        
        Object.keys(eventHandlers).forEach(event => {
            socket.on(event, (a, b, c, d, e) => {
                eventHandlers[event](socket, a, b, c, d, e);
            }); 
        });
    });

    app.get('/healthcheck', (request: any, response: Response) => {
        response.status(200).send("OK"); 
    });

    server.listen(process.env.WEBSOCKET_PORT || 80, () => console.log('Server listening on port 80'));
    // if(process.env.SSL_ENABLED.toUpperCase() === "TRUE")
    //     server.listen(80, () => console.log('Server listening on port 443'));
}

start(); 


export default io;