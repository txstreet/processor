import path from 'path';
import { Worker } from 'worker_threads';
import XMRPendingList from '../../../containers/XMRPendingList';

export default async () => {
    const keys = Object.keys(process.env);
    const workerData: any = {}; 
    keys.forEach((key: string) => workerData[key] = process.env[key]); 

    try {
        const pendingTxList = new XMRPendingList(); 
        await pendingTxList.init();

        new Worker(path.join(__dirname, 'calculateStats.js'), { workerData })
        new Worker(path.join(__dirname, 'blockchainInfo.js'), { workerData })
        new Worker(path.join(__dirname, 'mempoolInfo.js'), { workerData })
        new Worker(path.join(__dirname, 'calculatePendingTransactionsList.js'), { workerData })
    } catch (error) {
        console.error(error); 
    }
}