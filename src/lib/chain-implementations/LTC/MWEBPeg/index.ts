import ChainImplementation from '../../implementation'; 
// import redis from '../../../../databases/redis'; 
// import mongodb from "../../../../databases/mongodb";

class MWEBPeg extends ChainImplementation {

    async init(): Promise<ChainImplementation> {
        try {

        } catch (error) {
            console.error(error);
        } finally {
            return this; 
        }
    }

    async validate(transaction: any): Promise<boolean> {
        // console.log(transaction);
        if(!transaction.vkern || !transaction.vkern.length) return false;
        return true;
    }

    async execute(transaction: any): Promise<boolean> {
        if (!transaction.extras)
            transaction.extras = {};

        let pegout = false;
        let isPeg = false;
        let peginValue = 0;
        let pegoutValue = 0;
        for (let i = 0; i < transaction.vkern.length; i++) {
            const vkern = transaction.vkern[i];
            if(Number(vkern.pegin) > 0) {
                pegout = false;
                isPeg = true;
                peginValue += Number(vkern.pegin);
            }
            if(vkern.pegout.length){
                pegout = true;
                isPeg = true;
                for (let j = 0; j < vkern.pegout.length; j++) {
                    const pegoutObj = vkern.pegout[j];
                    pegoutValue += pegoutObj.value || 0;
                }
            }
        }
        if(isPeg){
            transaction.extras.houseContent = pegout ? "MWEB Pegout - " + (pegoutValue || 0) + " LTC" : "MWEB Pegin - " + (peginValue || 0) + " LTC";
            transaction.extras[pegout?'mwebpegout':'mwebpegin'] = pegout?pegoutValue:peginValue;
        }
        // transaction.mweb = true;
        // transaction.extras.mweb = true;
        return true;  
    }
}

export default new MWEBPeg('LTC'); 