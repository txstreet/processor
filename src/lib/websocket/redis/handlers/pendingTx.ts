import io from '../../../../entry/websocket-server'

export const lastHouseTxs: any = {}; 

export default async (data: any): Promise<any> => {
    const { chain, node } = data; 
	if(!node) return; 
    const room = `${chain}-transactions`
	
	if(data.house) {
		if(!lastHouseTxs[chain])
			lastHouseTxs[chain] = {}; 

		if(!lastHouseTxs[chain][data.house])
			lastHouseTxs[chain][data.house] = [];
			
		if(lastHouseTxs[chain][data.house].length >= 5)
			lastHouseTxs[chain][data.house].shift(); 

		lastHouseTxs[chain][data.house].push(data);
	}

	io.to(room).emit('tx', data); 
}


