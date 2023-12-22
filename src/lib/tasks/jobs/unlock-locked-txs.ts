import mongodb from '../../../databases/mongodb';

export default async (chain: string): Promise<void> => {
    try {
        const { database } = await mongodb(); 
        const txCollection = database.collection('transactions_' + chain || ''); 
        let where: any = { locked: true, processed: false, lockedAt: { $lte: Date.now() - 5000 }, processFailures: { $lte: 5 } };
        let update = { $set: { locked: false } } 
        await txCollection.updateMany(where, update, { ordered: false }); 
        where.processed = true;
        where.confirmed = false; 
        await txCollection.updateMany(where, update, { ordered: false }); 
    } catch (error) {   
        console.error(error);
    }
}