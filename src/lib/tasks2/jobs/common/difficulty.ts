import { ProjectedEthereumBlock, ProjectedXMRBlock } from '../../types';

export default (latestBlock: ProjectedEthereumBlock | ProjectedXMRBlock): string | number => {
    return latestBlock.difficulty;
}