import ChainImplementation from '../../implementation'; 

class CashFusion extends ChainImplementation {

    async init(): Promise<ChainImplementation> {
        return this;
    }

    async validate(transaction: any): Promise<boolean> {
        return true;
    }

    async execute(transaction: any): Promise<boolean> {
        for(let i = 0; i < transaction.asmArrays.length; i++) {
            const asmArray = transaction.asmArrays[i];
            const op_return = asmArray[0] === "OP_RETURN";
            if(!op_return) continue 

            const code = asmArray[1]; 
            if(code === "46555a00") {
                if(!transaction.extras)
                    transaction.extras = {};
                transaction.extras.houseTween = "shuffle"; 
                transaction.house = "cashfusion"; 
                break;
            }
        }
        return true; 
    }
}

export default new CashFusion('BCH'); 