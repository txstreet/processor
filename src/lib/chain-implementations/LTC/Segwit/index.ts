import ChainImplementation from '../../implementation';
// import redis from '../../../../databases/redis'; 
// import mongodb from "../../../../databases/mongodb";

class Segwit extends ChainImplementation {

    async init(): Promise<ChainImplementation> {
        try {

        } catch (error) {
            console.error(error);
        } finally {
            return this;
        }
    }

    async validate(transaction: any): Promise<boolean> {
        if(transaction.vsize === transaction.rsize) return false;
        // for (let outputIndex = 0; outputIndex < transaction.outputs.length; outputIndex++) {
        //     const output = transaction.outputs[outputIndex];
        //     if (output.ismweb) {
        //         return false;
        //     }
        // }
        for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex++) {
            const input = transaction.inputs[inputIndex];
            if (input.ismweb) {
                return false;
            }
        }
        return true;
        // return false;
    }

    async execute(transaction: any): Promise<boolean> {
        if (!transaction.extras)
            transaction.extras = {};
        transaction.extras.sw = true;
        return true;
    }
}

export default new Segwit('LTC'); 