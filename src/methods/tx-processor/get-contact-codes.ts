import { BlockchainWrapper } from '../../lib/node-wrappers';
import redis from '../../databases/redis';
import axios from 'axios';


export default async (wrapper: BlockchainWrapper, transactions: any[], returnSingle = false, bypassCache = false, bulkApi = Boolean(process.env.USE_BULK_API)): Promise<any> => {
    //Still need to write a version for outisde of the bulk api
    if (!bulkApi) return transactions;
    let calls = 0;
    let cachedCount = 0;
    try {
        var accounts: { [key: string]: boolean } = {}
        var accountValues: { [key: string]: boolean } = {}

        let cachedTasks: Promise<boolean>[] = [];
        transactions.forEach(async (transaction: any) => {
            cachedTasks.push(new Promise<boolean>(async (resolve) => {
                try {
                    transaction.to = transaction.to.toLowerCase();
                    const key = (wrapper as any).ticker + "-is-contract-" + transaction.from;
                    if (!bypassCache && !accounts[transaction.to] && !accountValues[transaction.to]) {
                        let cached: any = await redis.getAsync(key);
                        if (cached) {
                            cachedCount++;
                            accountValues[transaction.to] = Boolean(cached);
                        }
                    }
                    accounts[transaction.to] = true;
                    return resolve(true);
                } catch (error) {
                    console.error(error);
                    return resolve(false);
                }
            }));
        });
        await Promise.all(cachedTasks);

        // if (bulkApi) {
        const url = new URL(process.env.ETH_NODE);
        let response = await axios.post(`http://${url.hostname}/contract-codes`, { contracts: Object.keys(accounts) });
        response.data.forEach((result: any) => {
            accountValues[result.contract] = result.code;
            const key = (wrapper as any).ticker + "-is-contract-" + result.contract;
            redis.setAsync(key, result.code, 'EX', 3600 * 12);
        });
        // } else {

        //     //create requests for accounts that aren't cached
        //     let requests: { [key: string]: any }[] = [];
        //     // let requestsArr: Promise<number>[] = [];
        //     for (const account in accounts) {
        //         if (typeof accountValues[account] !== "undefined") continue;
        //         let request = wrapper.getTransactionCount(account);
        //         calls++;
        //         requests.push({ account, result: request });
        //         // requestsArr.push(request);
        //         // await new Promise(r => setTimeout(r, 5));
        //     }
        //     // await Promise.all(requestsArr);

        //     for (let i = 0; i < requests.length; i++) {
        //         const request = requests[i];
        //         setAccountValue(accountValues, request.account, request.result);
        //     }
        // }


        transactions.forEach(async (transaction: any) => {
            transaction.contract = Boolean(accountValues[transaction.to] || false);
        });

        // console.log(calls + " nonce calls", cachedCount + " cached");
        if (returnSingle) return transactions[0];
        return transactions;
    } catch (error) {
        console.error(error);
        return false;
    }
}
