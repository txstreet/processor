import { ProjectedEthereumBlock, ProjectedXMRBlock } from '../../types';

export default (latestBlock: ProjectedEthereumBlock | ProjectedXMRBlock) => {
    return latestBlock.height;
}