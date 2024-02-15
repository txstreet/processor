// @ts-strict-ignore
import { BlockchainWrapper } from '../../lib/node-wrappers';
import config from '../../lib/utilities/config';
import axios from 'axios';

export default async (wrapper: BlockchainWrapper, transactions: any[], returnSingle = false, useBulkApi = true): Promise<any> => {
    try {
        if (useBulkApi) {
            const hashes: string[] = transactions.map((request: any) => request.hash);
            const response = await axios.post(`${config.ethBulkUrl}/transaction-receipts`, { hashes });

            response.data.forEach((result: any) => {
                for (let i = 0; i < transactions.length; i++) {
                    const transaction = transactions[i];
                    if (transaction.hash === result.hash) transaction.receipt = result.receipt;
                }
            });
        } else {
            let receiptTasks: any[] = [];
            transactions.forEach((transaction) => {
                receiptTasks.push(wrapper.getTransactionReceipt(transaction.hash));
            });
            let receiptResults = (await Promise.all(receiptTasks));
            for (let i = 0; i < receiptResults.length; i++) {
                const receiptResult = receiptResults[i];
                for (let j = 0; j < transactions.length; j++) {
                    const transaction = transactions[j];
                    if (transaction.hash === receiptResult.hash) {
                        transaction.receipt = receiptResult.receipt;
                    }
                }
            }
        }

        if (returnSingle) return transactions[0];
        return transactions;
    } catch (error) {
        console.error(error);
        return false;
    }
}
