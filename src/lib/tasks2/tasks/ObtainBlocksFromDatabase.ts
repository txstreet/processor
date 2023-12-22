import mongodb from '../../../databases/mongodb';
import OverlapProtectedInterval from "../utils/OverlapProtectedInterval";
import DropoutContainer from '../containers/Dropout';
import { setTimeout } from 'timers';

export default class ObtainBlocksFromDatabase extends OverlapProtectedInterval {
    _lastKnownItemTimestamp: number = 0; 
    _done: boolean = false; 
    _firstExecution: boolean = true; 

    constructor(chain: string, blocks: DropoutContainer<any>) {
        super(async () => {
            try { 
                // Initialize the database. 
                const { database } = await mongodb(); 
                // Create a reference to the database transactions collection. 
                const collection = database.collection(`blocks`); 

                let divider = 1;
                switch(chain) {
                    case 'ETH':
                    case 'ARBI':
                    case 'XMR':
                    case 'BTC':
                    case 'BCH':
                    case 'LTC':
                        divider = 1000;
                        break;
                }

                const where: any = {
                    chain,
                    hash: { $ne: null },
                    height: { $ne: null }, 
                    processed: true, 
                    timestamp: { $gt: this._lastKnownItemTimestamp === 0 ? Math.floor((Date.now() - (((1000 * 60) * 60) * 24)) / divider) : this._lastKnownItemTimestamp } };

                let project: any = {};
                switch(chain) {
                    case 'ETH':
                        project = { _id: 0, value: 1, hash: 1, from: 1, baseFeePerGas: 1, gasUsed: 1, gasLimit: 1, difficulty: 1, size: 1, height: 1, timestamp: 1, gasUsedDif: 1, transactions: 1 };
                        break;
                    case 'ARBI':
                        project = { _id: 0, value: 1, hash: 1, from: 1, gasUsed: 1, gasLimit: 1, difficulty: 1, size: 1, height: 1, timestamp: 1, transactions: 1 };
                        break;
                    case 'XMR': 
                        project = { _id: 0, hash: 1, timestamp: 1, height: 1, difficulty: 1, transactions: 1, size: 1 }
                        break;
                        case 'BTC':
                        case 'BCH':
                        case 'LTC': 
                        project = { _id: 0, hash: 1, timestamp: 1, height: 1, difficulty: 1, transactions: 1, size: 1 }
                        break;
                }


                let results = await collection.find(where).project(project).toArray();
                // Make sure we atleast have 250 blocks. 
                if(results.length < 250 && this._firstExecution) {
                    // Find earliest known height. 
                    let earliest = results.sort((a: any, b: any) => b.height - a.height)[results.length - 1]; 
                    if(!earliest) 
                        earliest = (await collection.find({ chain, hash: { $ne: null }, height: { $ne: null } },  project).sort({ height: -1 }).limit(1).toArray())[0];
                    let earliestHeight: number = earliest.height;
                    const remainder = 250 - results.length;
                    let _results = await collection.find({ chain, height: { $lt: earliestHeight } }).project(project).sort({ height: -1 }).limit(remainder).toArray();
                    results = results.concat(_results); 
                }

                // TODO Optimize into a $project
                for(let i = 0; i < results.length; i++) {
                    if(!results[i].transactions)
                        results[i].transactions = [];
                    let txcount = results[i].transactions.length; 
                    delete results[i].transactions;
                    results[i].transactions = txcount;
                    if(!results[i].gasUsedDif)
                        results[i].gasUsedDif = 0.0; 
                }

                if(results.length > 0) {
                    const latest = results.sort((a: any, b: any) => a.height - b.height)[results.length - 1]; 
                    this._lastKnownItemTimestamp = latest.timestamp; 
                    blocks.insert(results);
                }
                this._done = true; 
                if(this._firstExecution)
                    this._firstExecution = false; 
            } catch (error) {
                console.error(error); 
                console.error(error);
            }
        }, 250); 
    }

    waitForFirstCompletion = () => new Promise((resolve) => {
        const checkFlag = (): void => {
            if(this._done) return resolve(1);
            setTimeout(() => checkFlag(), 50);
        }
        checkFlag(); 
    })
}