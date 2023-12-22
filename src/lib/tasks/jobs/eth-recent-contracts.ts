import { storeObject } from '../../../lib/utilities';
import mongodb from '../../../databases/mongodb';
import Bottleneck from 'bottleneck';
import axios from 'axios';
import path from 'path';

const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 201
});

export default async (chain: string, label: string, timeFrom: number): Promise<void> => {
    try {
        const { database } = await mongodb();
        const txCollection = database.collection(`transactions_${chain}`);

        const time = Date.now(); 
        const results = await txCollection.aggregate([
            { $match: { contract: true, insertedAt: { $gte: new Date(timeFrom) } } },
            { $group: { _id: "$to", txCount: { $sum: 1 } } },
            { $sort: { txCount: -1 } },
            { $limit: 100 },
            { $lookup: { from: 'contracts_ETH', localField: '_id', foreignField: 'contract', as: 'contracts' } },
            { $project: { _id: 1, txCount: 1, contract: { $first: "$contracts" } } },
            { $project: { 
                _id: 1,
                txCount: 1,
                contract: 1,
                nameless: 1,
                lastChecked: 1,
                weightedTransactions: {
                    $add: [
                        "$txCount", 
                        { $ifNull: ["$contract.weight", 0] }
                    ]
                } 
            } },
            { $sort: { weightedTransactions: - 1 } },
            { $limit: 10 }
        ]).toArray();
        console.log('Took', Date.now() - time, 'ms on label', label, 'returned', results.length); 

        // ForEach results where .contact is null, obtain information from etherscan
        let etherscanTasks: any[] = []; 
        for(let i = 0; i < results.length; i++) {
            const result = results[i];
            if(!result.contract || result.nameless || (result?.lastChecked && Date.now() - result.lastChecked > 300000)) {
                const promise = limiter.schedule(async () => {
                    try {
                        let response = await axios.get(`https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${result._id}&apiKey=${process.env.ETHERSCAN_API_KEY}`);
                        if(response.status === 200) {
                            const data = response.data;
                            if(data.status === '1' && data.message === "OK" && data.result && data.result[0]) {
                                const contract: any = {
                                    contract: result._id, 
                                    name: data.result[0].ContractName,
                                    lastChecked: Date.now(),
                                    compilerVersion: data.result[0].CompilerVersion, 
                                    swarmSource: data.result[0].SwarmSource,
                                    deployedOn: 0, 
                                    deployedWith: null,
                                    weight: 0,
                                }

                                response = await axios.get(`https://api.etherscan.io/api?module=account&action=txlist&address=${result._id}&startblock=0&endblock=99999999&page=1&sort=asc&apikey=${process.env.ETHERSCAN_API_KEY}`);
                                if(response.status === 200 && response.data.status == '1' && response.data.message === 'OK' && response.data.result && response.data.result.length) {
                                    contract.deployedOn = response.data.result[0].timeStamp; 
                                    contract.deployedWith = response.data.result[0].hash; 
                                }

                                
                                if(!contract.name || contract.name.length === 0) {
                                    contract.name = result._id; 
                                    contract.nameless = true;
                                    contract.lastChecked = Date.now(); 
                                } else if(result.nameless && contract.name.length !== 0) {
                                    contract.nameless = false;
                                }

                                contract.lastUpdated = new Date();
                                result.contract = contract; 
                                await database.collection(`contracts_${chain}`).updateOne({ contract: result._id }, { $set: contract }, { upsert: true}); 
                                return contract; 
                            } else {
                                return null;
                            }
                        } else {
                            return null;
                        }
                    } catch (error) {
                        console.error(error); 
                    }
                }); 
                etherscanTasks.push(promise); 
            } 
        }

        await Promise.all(etherscanTasks);
        
        // Assign weight -.001 $dec to all results
        let incTasks: any[] = [];
        let bulk: any[] = [];

        for(let i = 0; i < results.length; i++) {
            let result = results[i]; 
            let weight = i <= 3 ? -0.03 : i <= 6 ? -0.02 : -0.01;
            bulk.push({
                updateOne: { 
                    filter: { contract: result._id },
                    update: { $inc: { weight }, $set: { lastUpdated: new Date() } }
                }
            })
        }

        if(bulk.length > 0) 
            await database.collection(`contracts_${chain}`).bulkWrite(bulk); 

        // Find all results where contract $nin results.map(d=>_id) and $inc .001
        const exclude = results.map((result: any) => result._id); 
        await database.collection(`contracts_${chain}`).updateMany({ contract: { $nin: exclude }, weight: { $lte: -0.01 } }, { $inc: { weight: 0.01 }});

        let values = results.map((result: any) => ({
            hash: result._id,
            transactions: result.txCount,
            weightedTransactions: result.weightedTransactions,
            contract: {
                name: result.contract.name,
                // compilerVersion: result.contract.compilerVersion,
                // swarmSource: result.contract.swarmSource,
                weight: result.contract.weight,
                deployedOn: result.contract.deployedOn,
                deployedWith: result.contract.deployedWith
                // added: result.contract.added
            }
        }))

        values = values.sort((a: any, b: any) => b.weightedTransactions - a.weightedTransactions); 
        // values.forEach((v: any) => delete v.weightedTransactions); 
        await storeObject(path.join('live', `trending-contracts-${chain}-${label}`), JSON.stringify(values)); 
    } catch (error) {
        console.error(error); 
    }
}