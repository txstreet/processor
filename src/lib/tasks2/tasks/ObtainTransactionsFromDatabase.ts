import mongodb from '../../../databases/mongodb';
import OverlapProtectedInterval from "../utils/OverlapProtectedInterval";
import DropoutContainer from '../containers/Dropout';
import { setTimeout } from 'timers';

export default class ObtainTransactionsFromDatabase extends OverlapProtectedInterval {
    _lastKnownItemTimestamp: number = 0; 
    _done: boolean = false; 

    constructor(chain: string, transactions: DropoutContainer<any>) {
        super(async () => {
            try { 
                // Initialize the database. 
                const { database } = await mongodb(); 
                // Create a reference to the database transactions collection. 
                const collection = database.collection(`transactions_${chain}`);

                const where = {
                    processed: true, 
                    insertedAt: { $gt: this._lastKnownItemTimestamp === 0 ? new Date(Date.now() - (((1000 * 60) * 60) * 1)) : new Date(this._lastKnownItemTimestamp) } };

                let project: any = {};
                switch(chain) {
                    case 'ETH':
                        project = { _id: 0, processed: 1, insertedAt: 1, gas: 1, gasPrice: 1, maxFeePerGas: 1, dropped: 1, hash: 1, from: 1, timestamp: 1 };
                        break;
                    case 'XMR': 
                        project = { _id: 0, hash: 1, processed: 1, fee: 1, size: 1, dropped: 1, timestamp: 1, insertedAt: 1 }
                        break;
                    case 'BTC': 
                    case 'LTC': 
                    case 'BCH': 
                        project = { _id: 0, hash: 1, processed: 1, fee: 1, size: 1, dropped: 1, timestamp: 1, insertedAt: 1, rsize: 1 }
                        break;
                }

                let results = await collection.find(where).project(project).toArray();

                if(results.length > 0) {
                    // Use $project to do this
                    for(let i = 0; i < results.length; i++) {
                        results[i].insertedAt = results[i].insertedAt.getTime()
                        if(!results[i].timestamp)
                            results[i].timestamp = null;
                    }

                    transactions.insert(results); 
                    const latest = results.sort((a: any, b: any) => a.insertedAt - b.insertedAt)[results.length - 1]; 
                    this._lastKnownItemTimestamp = latest.insertedAt; 
                }
                this._done = true;
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