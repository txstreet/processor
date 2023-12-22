import { ProjectedXMRTransaction } from "../../types";
import { median } from '../../../../lib/utilities';

export default (transactions: ProjectedXMRTransaction[]) => {
    const array = transactions.filter((transaction: any) => transaction.fee > 0 && transaction.size > 0)
        .map((transaction: any) => {
            let value = transaction.fee * 0.000000000001;
            return value;   
        });
    return median(array, false); 
}