import fs from 'fs';
import path from 'path'; 
import mongodb from '../../../databases/mongodb';


// TODO: Create .json file and store it in spaces
export default async(chain: string, wikiname: string): Promise<void> => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('houses'); 
        const dir = path.join(process.env.WIKI_DIR as string, wikiname, 'houses'); 
        const files = fs.readdirSync(dir).filter((file: string) => file.includes('.json'));
        console.log(files);
        const tasks: Promise<any>[] = [];
        const writeInstructions: any[] = [];
        files.forEach((filename: string) => {
            console.log(filename);
            tasks.push(new Promise(async (resolve) => {
                const data = (await import(path.join(dir, filename))).default; 
                if(data.contracts) 
                    data.contracts = data.contracts.map((item: any) => item.address);
                writeInstructions.push({
                    updateOne: {
                        filter: { name: data.name, chain },
                        update: { $set: { popupLength: 75, priority: 0, side: 0, dataSources: ['wiki'], ...data  } },
                        upsert: true 
                    }
                })

                resolve(true);
            }));
        })

        await Promise.all(tasks); 

        if(writeInstructions.length > 0) 
            await collection.bulkWrite(writeInstructions); 

        console.log("Housing data updated");

    } catch (error) {
        console.error(error);
    }
}