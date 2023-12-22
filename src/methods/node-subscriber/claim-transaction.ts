import redis from '../../databases/redis'; 

// This function is used to ensure that multiple nodes cannot process the same transaction
// by using REDIS with the EX (Expire) and NX(Not Exists) arguments we can ensure that
// another node has not already begun processing this hash.
export default async (chain: string, hash: string): Promise<Boolean> => {
    try {
        if(process.env.USE_DATABASE !== "true") 
            return true;
        return await redis.setAsync(`${chain}-tx-${hash}`, '1', 'NX', 'EX', 60 * 1); 
    } catch (error) {
        console.error(error);
    }
    return false;
}