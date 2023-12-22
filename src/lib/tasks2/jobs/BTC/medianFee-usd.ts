import { ProjectedBTCTransaction } from "../../types";
import { median } from '../../../../lib/utilities';

export default (pricePerIncrement: number, transactions: ProjectedBTCTransaction[]) => {
    const array = transactions.filter((transaction: any) => transaction.fee > 0)
        .map((transaction: any) => pricePerIncrement * transaction.fee);
    return median(array, true);  
}