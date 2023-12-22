import { median } from "../../../../lib/utilities";
import { ProjectedEthereumTransaction } from "../../types";

// The last value calculated during the execution of this task. 
let lastExecutionResult: number = 0; 

export default async (transactions: ProjectedEthereumTransaction[]) => {
    try {
        // Filter the transactions array to remove any transactions that do not have a universal gas price.
        let filtered = transactions.filter((transaction: ProjectedEthereumTransaction) => transaction.maxFeePerGas || transaction.gasPrice > 0); 

        // Morph the transactions array into an array of universal gas prices, so a median can be obtained.
        const _median = median(filtered.map((transaction: ProjectedEthereumTransaction) => transaction.maxFeePerGas || transaction.gasPrice), true);  
        
        // Update the lastExecutionResult. 
        lastExecutionResult = _median;
    } catch (error) {
        console.error(error); 
    } finally {
        return lastExecutionResult;
    }
}