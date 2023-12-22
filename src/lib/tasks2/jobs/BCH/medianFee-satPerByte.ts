import { ProjectedBTCTransaction, ProjectedXMRTransaction } from "../../types";
import { median } from '../../../../lib/utilities';

export default (transactions: ProjectedBTCTransaction[]) => {
    const array = transactions.filter((transaction: any) => transaction.fee > 0 && transaction.size > 0)
        .map((transaction: any) => transaction.fee / transaction.size);
    return median(array, true); 
}