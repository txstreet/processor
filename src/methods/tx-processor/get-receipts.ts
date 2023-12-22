import { BlockchainWrapper } from '../../lib/node-wrappers';
import axios from 'axios';

export default async (wrapper: BlockchainWrapper, transactions: any[], returnSingle = false, bulkApi = Boolean(process.env.USE_BULK_API)): Promise<any> => {
    try {
        let hashes: string[] = transactions.map((request: any) => request.hash);

        if (bulkApi) {
            const url = new URL(process.env.ETH_NODE);
            let response = await axios.post(`http://${url.hostname}/transaction-receipts`, { hashes });
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
