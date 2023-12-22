import { average } from '../../../../lib/utilities';
import { ProjectedEthereumBlock, ProjectedXMRBlock } from '../../types';

export default (blocks: ProjectedEthereumBlock[] | ProjectedXMRBlock[]) => {
    let lastTime = 0;
    let lastHeight = 0; 
    let array: any[] = []; 
    blocks.forEach((block: any) => {
        if(lastTime != 0) {
            // Do not skip blocks. 
            if(block.height - lastHeight === 1) {
                array.push(block.timestamp - lastTime); 
            }
        }
        lastTime = block.timestamp;
        lastHeight = block.height; 
    })

    let avg = average(array, true); 
    return Math.round(avg); 
}