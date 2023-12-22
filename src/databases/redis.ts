import * as redis from 'redis';
import { promisify } from "util";

let client: any = null; 

if(process.env.USE_DATABASE === "true") {
    client = redis.createClient({
        url: process.env.REDIS_URI,
    });
    client.getAsync = promisify(client.get).bind(client);
    client.setAsync = promisify(client.set).bind(client);
    
}

export default client; 