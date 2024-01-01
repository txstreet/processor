// import fs from 'fs';
import redis from "../../../databases/redis";

export default async (path: string, encoding: string|null = null): Promise<string> => {
    let response = await redis.getAsync(path);

    return String(response);
} 
