import path from 'path';
import BCHPendingList from '../../../containers/BCHPendingList';
import { Worker } from 'worker_threads';

export default async () => {
    const keys = Object.keys(process.env);
    const workerData: any = {}; 
    keys.forEach((key: string) => workerData[key] = process.env[key]); 

    try {
        const pendingTxList = new BCHPendingList(); 
        await pendingTxList.init();

        new Worker(path.join(__dirname, 'calculateStats.js'), { workerData })
        new Worker(path.join(__dirname, 'blockchainInfo.js'), { workerData })
        new Worker(path.join(__dirname, 'mempoolInfo.js'), { workerData })
        new Worker(path.join(__dirname, 'calculatePendingTransactionsList.js'), { workerData })
    } catch (error) {
        console.error(error); 
    }
}