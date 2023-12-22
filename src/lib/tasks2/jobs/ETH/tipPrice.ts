import { ProjectedEthereumBlock } from '../../types';

export default (latestBlock: ProjectedEthereumBlock) => {
    console.log("block", latestBlock);
    // const prevBaseFee = Number(latestBlock.baseFeePerGas);
    // const used = Number(latestBlock.gasUsed);
    // const limit = Number(latestBlock.gasLimit); 
    
    // const elasticity = 2;
    // const denominator = 8;
    // const target = limit / elasticity;
    // let baseFee = prevBaseFee;
    // if (used > target) {
    //   const usedDelta = used - target;
    //   const baseDelta = Math.max(
    //    prevBaseFee * usedDelta / target / denominator,
    //     1
    //   );
    //   baseFee = prevBaseFee + baseDelta;
    // } else if (used < target) {
    //   const usedDelta = target - used;
    //   const baseDelta = prevBaseFee * usedDelta / target / denominator;
    //   baseFee = prevBaseFee - baseDelta;
    // }
    return 1;
}