import { ProjectedXMRTransaction } from '../../types';

export default (transactions: ProjectedXMRTransaction[]) => {
    const array = transactions.map((transaction: any) => transaction.size); 
    const sum = array.reduce((a: number, b: number) => a + b, 0);
    return Number((sum / 300).toFixed(2)); 
}