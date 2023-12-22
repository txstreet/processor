import SocketIO from 'socket.io';
import { lastHouseTxs } from '../redis/handlers/pendingTx';

export default async (socket: SocketIO.Socket, chain: string, identifier: string) => {
    const valid = JSON.parse(process.env.TICKERS);

    if(!valid.includes(chain)) 
        return socket.emit('get-recent-house-txs', identifier, 'Invalid chain supplied to request.', null);

    const houseTransactions = lastHouseTxs[chain]; 
    if(!houseTransactions) 
        return socket.emit('get-recent-house-txs', identifier, `No recent transactions available for chain (${chain})`, null);

    const data: any = []; 
    Object.keys(houseTransactions).forEach(house => {
        data.push({ house, txs: houseTransactions[house] })
    });

    return socket.emit('get-recent-house-txs', identifier, null, data);
}




