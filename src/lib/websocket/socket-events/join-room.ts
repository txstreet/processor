import SocketIO from 'socket.io';
import { lastBlocks, lastBlocksFull } from '../redis/handlers/block'; 
import { lastHouseTxs } from '../redis/handlers/pendingTx';
import { chainConfig } from "../../../data/chains";

export default async (socket: SocketIO.Socket, room: string) => {
    socket.join(room); 
    const parts = room.split('-'); 
    const chain = parts[0];
    const channel = parts[1]; 
    if(chainConfig[chain] && channel == 'blocks') {
        let isRollup = chainConfig?.[chain]?.rollup;
        const blocks = isRollup ? lastBlocksFull[chain] : lastBlocks[chain] || []; 
        socket.emit('latestblocks', blocks); 
    }

    if(chainConfig[chain] && channel == 'transactions') {
        const houseTransactions = lastHouseTxs[chain]; 
        if(!houseTransactions) {
            return;
        }

        const data: any = []; 
        Object.keys(houseTransactions).forEach(house => {
            data.push({ house, txs: houseTransactions[house] })
        });
    }

}