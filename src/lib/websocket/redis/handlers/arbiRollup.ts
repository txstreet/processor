import io from '../../../../entry/websocket-server'

export const rollupTxs: any = {}; 

export default async (data: any): Promise<any> => {
    const hash = data.hash;
	if(rollupTxs[hash]) return;
    const room = `ARBI-blocks`
	
    setTimeout(() => {
        delete rollupTxs[hash];
    }, 60000 * 60);

	io.to(room).emit('arbiRollup', hash); 
}


