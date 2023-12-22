import io from '../../../../entry/websocket-server'

export default async (data: any): Promise<any> => {
    const { chain, hash } = data; 
    const room = `${chain}-transactions`
    io.to(room).emit('successTxs', [hash]); 
    
}