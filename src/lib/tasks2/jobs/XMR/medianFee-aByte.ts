import { ProjectedXMRTransaction } from "../../types";
import { median } from '../../../../lib/utilities';

export default (transactions: ProjectedXMRTransaction[]) => {
    const array = transactions.filter((transaction: any) => transaction.fee && transaction.size)
        .map((transaction: any) => transaction.fee / transaction.size);
    return median(array, true); 
}