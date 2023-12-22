import mongodb from '../../../databases/mongodb';
import OverlapProtectedInterval from "../utils/OverlapProtectedInterval";
import DropoutContainer from '../containers/Dropout';
import { setTimeout } from 'timers';

export default class ObtainRollupBlocksFromDatabase extends OverlapProtectedInterval {
    _lastKnownItemTimestamp: number = 0; 
    _done: boolean = false; 
    _firstExecution: boolean = true; 

    constructor(chain: string, blocks: DropoutContainer<any>, transactions: DropoutContainer<any>) {
        super(async () => {
            try { 
                // Initialize the database. 
                const { database } = await mongodb(); 
                // Create a reference to the database transactions collection. 
                const collection = database.collection(`blocks`); 

                const where: any = {
                    chain,
                    hash: { $ne: null },
                    height: { $ne: null }, 
                    processed: true, 
                    lastInserted: { $gt: this._lastKnownItemTimestamp === 0 ? Math.floor((Date.now() - (((1000 * 60) * 60) * 2))) : this._lastKnownItemTimestamp } };

                let project: any = {};
                switch(chain) {
                    case 'ARBI':
                        project = { _id: 0, value: 1, hash: 1, from: 1, gasUsed: 1, gasUsedDif: 1, gasLimit: 1, difficulty: 1, size: 1, height: 1, timestamp: 1, transactions: 1, transactionsFull: 1, lastInserted: 1, insertedAt: 1 };
                        break;
                }


                let results = await collection.find(where).project(project).toArray();
                // console.log("db results:" + results.length, this._lastKnownItemTimestamp);
                // Make sure we atleast have 250 blocks. 
                // console.log(results.length,  "ARBI BLOCKS");
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

                let transactionResults: any = [];

                // TODO Optimize into a $project
                for(let i = 0; i < results.length; i++) {
                    if(!results[i].transactions)
                        results[i].transactions = [];
                    let txcount = results[i].transactions.length; 
                    delete results[i].transactions;
                    results[i].transactions = txcount;
                    if(!results[i].gasUsedDif)
                        results[i].gasUsedDif = 0.0; 
                    //now add the transactions from the block
                    if(results[i].transactionsFull){
                        results[i].transactionsFull.forEach((transaction: any) => {
                            transaction.insertedAt = new Date(results[i].insertedAt).getTime();
                            transaction.timestamp = results[i].timestamp * 1000;
                            transaction.gasUsed = transaction?.receipt?.gasUsed;
                        });
                        transactionResults = transactionResults.concat(results[i].transactionsFull);
                    }
                }

                if(results.length > 0) {
                    // console.log("inserting blocks:"+ results.length);
                    const latest = results.sort((a: any, b: any) => a.lastInserted - b.lastInserted)[results.length - 1]; 
                    this._lastKnownItemTimestamp = latest.lastInserted; 
                    blocks.insert(results);
                    if(transactionResults.length > 0){
                        // console.log("inserting txs:"+ transactionResults.length);
                        transactions.insert(transactionResults);
                    }
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