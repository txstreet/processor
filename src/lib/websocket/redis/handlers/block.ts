import io from '../../../../entry/websocket-server'

export const lastBlocks: any = {};
export const lastBlocksFull: any = {};
// let lastBlockHeights: any = {};
// let hashesForLastHeight: any = {};


// function sortBlocks(){
//     for (const chain in lastBlocks) {
//             const blockChain = lastBlocks[chain];
            
//     }
//     for (const chain in lastBlocksFull) {
//         const blockChain = lastBlocks[chain];
        
// }
// }

export default async (data: any): Promise<any> => {
    const { chain, height, hash, block } = data;
    const room = `${chain}-blocks`;

    if(lastBlocks[chain] && hash && lastBlocks[chain].includes(hash)) return;
    if(lastBlocksFull[chain]){
        // if(chain === "ARBI") console.log(lastBlocksFull[chain]);
        for (let i = 0; i < lastBlocksFull[chain].length; i++) {
            const lastBlock = lastBlocksFull[chain][i];
            if(lastBlock.hash === block.hash) return;
        }
    }

    // const lastBlockHeight = lastBlockHeights[chain] || 0;
    // if (height > lastBlockHeight) {
    //     if (!hashesForLastHeight[chain])
    //         hashesForLastHeight[chain] = [hash];
    // }
    // else if (height === lastBlockHeight) {
    //     if(hashesForLastHeight[chain] && hashesForLastHeight[chain].includes(hash)) return;
    //     hashesForLastHeight[chain].push(hash);
    // }
    // lastBlockHeights[chain] = height;
    if (!lastBlocks[chain])
        lastBlocks[chain] = [];
    if (!lastBlocksFull[chain])
        lastBlocksFull[chain] = [];
    if (lastBlocks[chain].length == 5)
        lastBlocks[chain].shift();
    if (lastBlocksFull[chain].length == 100)
        lastBlocksFull[chain].shift();
    if (hash) lastBlocks[chain].push(hash);
    if (block) lastBlocksFull[chain].push(block);

    io.to(room).emit('block', block || hash);
    // } else if (height === lastBlockHeight) {
    //     if (hashesForLastHeight[chain].includes(hash))
    //         return;
    //     hashesForLastHeight[chain].push(hash);
    //     if (!lastBlocks[chain])
    //         lastBlocks[chain] = [];
    //     if (lastBlocks[chain].length == 5)
    //         lastBlocks[chain].shift();
    //     lastBlocks[chain].push(hash);
    //     io.to(room).emit('block', block || hash);
    // }
}
