import { ProjectedBTCTransaction } from '../../types';

export default (transactions: ProjectedBTCTransaction[]) => {
    const array = transactions.map((transaction: any) => transaction.rsize); 
    const sum = array.reduce((a: number, b: number) => a + b, 0);
    return Number((sum / 300).toFixed(2)); 
}