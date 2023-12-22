import ChainImplementation from '../../implementation'; 

import mongodb from '../../../../databases/mongodb'; 

class DefaultHousing extends ChainImplementation {
    public mapAddressToHouse: any = {};

    async init(): Promise<ChainImplementation> {
        try {
            if(process.env.USE_DATABASE === "false")
                return this;
            const { database } = await mongodb(); 
            const collection = database.collection('houses');
            const results = await collection.find({ chain: this.chain, name: { $ne: [] } }).toArray();  
            for(let i = 0; i < results.length; i++) {
                let doc = results[i]; 
                if(doc.contracts)
                    doc.contracts.forEach((address: string) => this.mapAddressToHouse[address] = doc.name); 
            }
            console.log("initialized default housing");
        } catch (error) {
            console.error(error);
        } finally {
            return this; 
        }
    }

    async validate(transaction: any): Promise<boolean> {
        return this.mapAddressToHouse[transaction.to] != null; 
    }

    async execute(transaction: any): Promise<boolean> {
        transaction.house = this.mapAddressToHouse[transaction.to]; 
        return true; 
    }
}

export default new DefaultHousing('LTC'); 