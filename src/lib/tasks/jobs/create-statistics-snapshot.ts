import mongodb from '../../../databases/mongodb';


export default async(): Promise<any> => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('statistics'); 
        const results = await collection.find({}).toArray(); 
        results.forEach((statSheet: any) => {
            const collection = database.collection(process.env.DB_COLLECTION_STATISTIC_SNAPSHOTS || '');
            collection.insertOne({ chain: statSheet.chain, timestamp: Date.now(), snapshot: statSheet }); 
        }); 
    } catch (error) {
        console.error(error);
    }
}