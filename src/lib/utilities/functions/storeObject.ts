
// import fs from 'fs';
import path from 'path'; 
import redis from "../../../databases/redis";

const dataDir = process.env.DATA_DIR || '/mnt/disks/txstreet_storage'

export default async (relativePath: string, contents: string, expireSeconds = 21600) => {
    const finalPath = path.join(dataDir, relativePath);
    // const rand = (Math.random() + 1).toString(36).substring(7);
    // const writingFilePath = finalPath + "." + rand;
    // await fs.promises.writeFile(writingFilePath, contents);
    // await fs.promises.rename(writingFilePath, finalPath);

    await redis.setAsync(finalPath, contents, "EX", expireSeconds);
}
