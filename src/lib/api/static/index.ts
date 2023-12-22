import express, { Request, Response, Router } from 'express';
import path from 'path'; 
import { readNFSFile } from '../../../lib/utilities';

const directory = process.env.DATA_DIR || path.join('/mnt', 'disks', 'txstreet_storage'); 

// Initialize router.
const staticRouter = Router();

staticRouter.use("/f/", express.static(path.join(directory, 'f')));

const fileCache: { [key: string]: string } = {}; 
const cacheExpire: { [key: string]: number } = {}; 

setInterval(() => {
    let keys = Object.keys(cacheExpire);
    let now = Date.now();
    for(let i = 0; i < keys.length; i++) {
        let key = keys[i];
        if(now >= cacheExpire[key]) {
            delete fileCache[key]; 
            delete cacheExpire[key];
        }
    }
}, 100);

staticRouter.get('/live/:file', async (request: Request, response: Response) => {
    let file = request.params.file; 
    if(!file) 
        return response.status(400).send(`file||data missing`); 
        try {
            let data: any = fileCache[file]; 
            if(data != null) {
                console.log(`Live request served from memory cache.`);
                return response.set('content-type', 'application/json').send(data); 
            }
            const filePath = path.join(directory, 'live', file);
            data = await readNFSFile(filePath); 

            // Sanity
            if(!data || !data.length) {
                response.set('Cache-Control', 'no-store, max-age=0');
                response.set('Expires', '0'); 
                return response.status(404).send(false); 
            }

            // This will throw an error if the JSON data is not valid, hitting the catch
            // and telling cloudflare to not cache the data. 
            JSON.parse(data); 

            fileCache[filePath] = data;  
            cacheExpire[filePath] = Date.now() + 2000; 
            return response.set('content-type', 'application/json').send(data); 
        } catch (error) {
            console.error(error); 
            response.set('Cache-Control', 'no-store, max-age=0');
            response.set('Expires', '0'); 
            return response.status(404).send(false); 
        }
});

// Assign request handlers.
staticRouter.get('/blocks/:ticker/:hash', async (request: Request, response: Response) => {
	let ticker = request.params.ticker;
	let hash = request.params.hash;
    let verbose: boolean = request?.query?.verbose ? request?.query?.verbose === 'true' : true;

	if(!ticker)
        return response.json({ success: false, code: -1, message: 'Ticker not provided in request.' }); 
    if(!hash)
        return response.json({ success: false, code: -1, message: 'Hash not provided in request.' }); 

    ticker = ticker.toUpperCase();

    const sendError = () => {
        response.set('Cache-Control', 'no-store, max-age=0');
        response.set('Expires', '0'); 
        return response.status(404).send(false); 
    }

    try {
        const firstPart = hash[hash.length - 1];
        const secondPart = hash[hash.length - 2]; 
        const filePath = path.join(directory, 'blocks', ticker, firstPart, secondPart, hash);
        const key: string = filePath + verbose;

        let data: any = fileCache[key];
        if(data != null) {
            console.log(`Static request served from memory cache.`);
            return response.set('content-type', 'application/json').send(data); 
        }
        data = await readNFSFile(filePath); 
        // Sanity
        if(!data || !data.length) {
            return sendError();
        }

        // This will throw an error if the JSON data is not valid, hitting the catch
        // and telling cloudflare to not cache the data. 
        const parsed = JSON.parse(data);
        if(!parsed) console.error("Cannot get: " + filePath);
        delete parsed.note;
        delete parsed.tx;
        if(!verbose){
            delete parsed.txFull;
            parsed.verbose = false;
        }
    
        fileCache[key] = parsed;
        cacheExpire[key] = Date.now() + 2000; 

        return response.set('content-type', 'application/json').send(parsed); 
    } catch (error) {
        console.error(error); 
        return sendError(); 
    }
});

export default staticRouter;