import { BlockchainWrapper } from '../../lib/node-wrappers';
// import mongodb from '../../databases/mongodb';
// import redis from '../../databases/redis'
import { initHooks, default as callChainHooks } from '../../lib/chain-implementations'; 

let initialized = false;

export default async (wrapper: BlockchainWrapper, transactions: any[]): Promise<any> => {
    try {
        if(!initialized){
            console.log("initalizing " + wrapper.ticker + " hooks...");
            await initHooks(wrapper.ticker);
            console.log("initalized " + wrapper.ticker + " hooks!");
            initialized = true;
        }
        const tasks: any[] = [];
        transactions.forEach((transaction: any) => {
            if(!transaction) return; 
            const task = new Promise(async (resolve) => {
                // if(transaction.to && typeof transaction.to === 'string') {
                    await callChainHooks(wrapper.ticker, transaction); 
                // }
                resolve(1); 
            });
            tasks.push(task); 
        })

        await Promise.all(tasks); 
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}