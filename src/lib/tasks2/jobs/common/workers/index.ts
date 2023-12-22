import path from 'path';
import { Worker } from 'worker_threads';

export default async (chain: string) => {
    const workerData: any = { chain }; 
    try {
        console.log('Starting...');
        new Worker(path.join(__dirname, 'deleteBlocksAndConfTxs.js'), { workerData }); 
    } catch (error) {
        console.error(error); 
    }
}