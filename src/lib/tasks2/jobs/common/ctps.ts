import { ProjectedEthereumBlock, ProjectedXMRBlock } from '../../types';

export default (blocks: ProjectedEthereumBlock[] | ProjectedXMRBlock[]) => {
    let transactions = 0;
    blocks.forEach((block: ProjectedEthereumBlock | ProjectedXMRBlock) => transactions += block.transactions);
    return Number((transactions / 3600).toFixed(2));
}