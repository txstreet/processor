import { formatBlock, storeObject  } from '../../lib/utilities';
import fs from 'fs';
import path from 'path';
const dataDir = path.join(process.env.DATA_DIR as string || '/mnt/disks/txstreet_storage');

// This is only used in the event there's no transactions in the block, otherwise
// please see the transaction-processor project for proper storage. 
export default async (chain: string, block: any): Promise<any> => {
    try {        
        if(!block) return; 
  
        // Encode the file content.
        const formatted: any = formatBlock(chain, block);
        formatted.note = 'block-processor'; 
        var content = JSON.stringify(formatted);

        // Create the file. 
        const firstPart = block.hash[block.hash.length - 1];
        const secondPart = block.hash[block.hash.length - 2]; 
        try { await fs.promises.mkdir(path.join(dataDir, 'blocks', chain, firstPart, secondPart), { recursive: true }); } catch (err) {}
        await storeObject(path.join('blocks', chain, firstPart, secondPart, block.hash), content);

        return block; 
    } catch (error) {
        console.error(error); 
        return null;
    }
}