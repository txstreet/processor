// /**
//  * This method is used by blockchains that implement transaction counts, namely
//  * Ethereum and Rinkeby at the time of documenting. It's purpose is to assign a
//  * transaction count to the transaction data and update a cached collection in the
//  * database for all counts. 
//  */
// import { BlockchainWrapper } from "../../lib/node-wrappers"
// import redis from '../../databases/redis'; 

// export default async (wrapper: BlockchainWrapper , transaction: any): Promise<any> => {
//     const key = (wrapper as any).ticker + "-nonce-" + transaction.from;
//     let cached: any = await redis.getAsync(key);
//     if(cached){
//         console.log(cached, "cached");
//         transaction.fromNonce = Number(cached);
//         return transaction;
//     }

//     if(!(wrapper as any).getTransactionCount) 
//         return transaction;
//     try {
//         transaction.fromNonce = (await (wrapper as any).getTransactionCount(transaction.from)) || 0; 
//         redis.setAsync(key, transaction.fromNonce, 'EX', 3600); 
//         return transaction; 
//     } catch (error) {
//         return transaction;
//     }
// }