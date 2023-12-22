import { ProjectedBTCTransaction, ProjectedEthereumTransaction, ProjectedXMRTransaction } from '../../types';

export default (transactions: ProjectedEthereumTransaction[] | ProjectedXMRTransaction[] | ProjectedBTCTransaction[]) => {
    return Number((transactions.length / 300).toFixed(2));
}