import { median } from '../../../../lib/utilities';
import { ProjectedEthereumBlock, ProjectedXMRBlock } from '../../types';

export default (blocks: ProjectedEthereumBlock[] | ProjectedXMRBlock[]) => {
    return median(blocks.map((block: any) => block.transactions), true);
}