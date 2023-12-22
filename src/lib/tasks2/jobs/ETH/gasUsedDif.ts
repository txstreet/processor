/**
 * This file is not used as a worker_thread because the results are required by the medianFee-usd statistic to accurately 
 * be calculated, because of this we will export an async function that allows medianFee-usd to wait for completion. 
 */
import { median} from "../../../../lib/utilities";
import { ProjectedEthereumBlock } from '../../types';

// The last value calculated during the execution of this task. 
let lastExecutionResult: number = 0; 

export default async (blocks: ProjectedEthereumBlock[]): Promise<number> => {
    try {
        // Filter the blocks array to remove any blocks that do not have a calculated gas-used difference.
        let results = blocks.filter((block: ProjectedEthereumBlock) => block.gasUsedDif); 
  
        // Morph the transactions array into an array of universal gas prices, so a median can be obtained.
        const _median = median(results.map((block: ProjectedEthereumBlock) => block.gasUsedDif), true);  

        // Update the value of the last exectuin result. 
        lastExecutionResult = _median;
    } catch (error) {
        console.error(error); 
    } finally {
        // In the event of successful calculation, the last-known value has already been updated.
        // In the event of an error, we will use the previously set last-known value.
        return lastExecutionResult;
    }
}