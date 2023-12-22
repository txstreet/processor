import axios from 'axios';

var moonheads: { [key: string]: any } = {}; 

const updateLookupTable = async () => {
    try {
        const response = await axios.get('https://api.moonheads.io/api/getCharacters');
        if(response.status === 200) {
            response.data.forEach((data: any) => {
                let address = data.address.toLowerCase(); 
                let tokenId = data.tokenId; 
                let name = data.name; 
                if(moonheads[address] && moonheads[address].tokenId != tokenId) {
                    // It's been changed.
                    // Do something here, if we want. 
                } else if(!moonheads[address]) {
                }
                moonheads[address] = { tokenId, name }; 
            });
        }
    } catch (error) { /* silent failure*/ }
}

updateLookupTable();
setInterval(updateLookupTable, (1000 * 60)); 

export default (address: string) : string | null => {
    address = (address || '').toLowerCase(); 
    const moonhead = moonheads[address]; 
    if(!moonhead) return null; 
    return moonhead; 
}
