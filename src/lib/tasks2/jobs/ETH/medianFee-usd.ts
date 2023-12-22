import { median } from "../../../../lib/utilities";
import { ProjectedEthereumTransaction } from "../../types";

// The last value calculated during the execution of this task. 
let lastExecutionResult: number = 0; 

export default async (transactions: ProjectedEthereumTransaction[], pricePerIncrement: number, gasUsedDif: number): Promise<number> => {
    try {
        // Filter the transactions array to remove any transactions that do not have a universal gas price.
        let filtered = transactions.filter((transaction: ProjectedEthereumTransaction) => transaction.gas > 21000); 

        // Morph the transactions array into an array of universal gas prices, so a median can be obtained.
        const _median = median(filtered.map((transaction: ProjectedEthereumTransaction) => {
            let paid = pricePerIncrement * (transaction.gasPrice || transaction.maxFeePerGas) * transaction.gas;
            if(transaction.gas > 42000) paid *= gasUsedDif / 100; 
            return paid;
        }), true);  
        
        // Update the last execution result.
        lastExecutionResult = _median;
    } catch (error) {
        console.error(error); 
    } finally {
        return lastExecutionResult;
    }
};