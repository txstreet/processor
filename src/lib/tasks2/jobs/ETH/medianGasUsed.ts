import { median } from '../../../../lib/utilities';
import { ProjectedEthereumBlock } from '../../types';
 
 export default async (blocks: ProjectedEthereumBlock[]): Promise<number> => {
    return median(blocks.map((block: ProjectedEthereumBlock) => block.gasUsed), true);
 }