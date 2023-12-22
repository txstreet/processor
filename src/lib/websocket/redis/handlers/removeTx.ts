import io from '../../../../entry/websocket-server'

export default async (data: any): Promise<any> => {
    const { chain, hashes } = data; 
    const room = `${chain}-transactions`
    if(hashes.length)
        io.to(room).emit('deleteTxs', hashes); 
}