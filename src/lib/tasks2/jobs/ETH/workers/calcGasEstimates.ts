
import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import getGasEstimate from '../gasEstimate'; 

setInterval(async () => {
    try {
        const { database } = await mongodb();
        const { baseFee, blockHeight, gasUsedDif, gasLimit } = await database.collection('statistics')
            .findOne({ chain: 'ETH' }, { baseFee: 1, blockHeight: 1, gasUsedDif: 1, gasLimit: 1 });

        const blockGasEstimates = await getGasEstimate(baseFee, blockHeight, gasUsedDif, gasLimit);
        const value = JSON.stringify(blockGasEstimates);
        if(process.env.UPDATE_DATABASES === "true") {
            await database.collection('statistics').updateOne({ chain: "ETH" }, { $set: { blockGasEstimates: value } }); 
        }
    } catch (error) {
        /* ignored */
        console.log(error);
    }
}, 2500).start(true); 