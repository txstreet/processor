// import fs from 'fs';
import redis from "../../../databases/redis";

export default async (path: string, encoding: string|null = null): Promise<string> => {
    // const config: any = { flag: 'rs' };
    // if(encoding) config.encoding = encoding; 
    // const data = await fs.promises.readFile(path, config); 
    // return data;

    let response = await redis.getAsync(path);

    return String(response);
    // return JSON.parse(response);

    // The below commented code is used to read via FileDescriptor
    /*
    let parts = path.split('/');
    const filename = parts[parts.length - 1]; 
    delete parts[parts.length -1 ];
    let directory = parts.join('/'); 
    const output = await execPromise(`cd ${directory} && find -name ${filename}`); 
    console.log(`Command output: ${output}`)
    const fileDescriptor = await fs.promises.open(path, 'rs');
    const stats = await fileDescriptor.stat(); 
    const buffer = Buffer.alloc(stats.size);
    await fileDescriptor.read(buffer, 0, buffer.length, 0);
    fileDescriptor.close().catch(error => console.error(error));
    return encoding ? buffer.toString(encoding as BufferEncoding) : buffer; 
    */ 
} 