import { ProjectedEthereumBlock } from '../../types';

export default (latestBlock: ProjectedEthereumBlock) => {
    return latestBlock.gasLimit / 2;
}