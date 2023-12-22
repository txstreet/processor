import ChainImplementation from '../../implementation'; 
// import redis from '../../../../databases/redis'; 
// import mongodb from "../../../../databases/mongodb";

class MWEB extends ChainImplementation {

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
        // for(let outputIndex = 0; outputIndex < transaction.outputs.length; outputIndex++) {
        //     const output = transaction.outputs[outputIndex];
        //     if(output.ismweb) {
        //         return true;
        //     }
        // }
        for(let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex++) {
            const input = transaction.inputs[inputIndex];
            if(input.ismweb) {
                return true;
            }
        }
        return false;
    }

    async execute(transaction: any): Promise<boolean> {
        if (!transaction.extras)
            transaction.extras = {};
        transaction.mweb = true;
        transaction.extras.mweb = true;
        console.log(transaction);
        return true;  
    }
}

export default new MWEB('LTC'); 