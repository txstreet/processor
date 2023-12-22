import mongodb from "../../../databases/mongodb"
import { Request, Response, Router } from 'express';
import Web3 from "web3";
//@ts-ignore
import txStreetTokens from "@txstreet/txstreet-token-ids";
import zoomersJson from '../../../lib/json/zoomers.json';
import zoomerIdsJson from '../../../lib/json/zoomerIds.json';

const zoomerIds : any = zoomerIdsJson;
const zoomers : any = zoomersJson;

const web3 = new Web3;
const nftRouter = Router();

nftRouter.get('/inventory/:address', async (request: Request, response: Response) => {
    try {
        let address = String(request.params.address).toLowerCase();
        if (!address)
            return response.json({ success: false, code: 0, message: `Address not provided with request.` });

        const { database } = await mongodb();
        const collection = database.collection(`nft_owners`);
        const results = await collection.find({ address }).project({ _id: 0, tokenId: 1, collectionSlug: 1, collectionAddress: 1 }).toArray();
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.collectionSlug === "moonheads")
                result.localChar = txStreetTokens.getName(result.tokenId);

            if (result.collectionSlug === "moonheads-zoomers") {
                let realId = zoomerIds[result.tokenId];
                let zoomer = zoomers[realId];
                if (zoomer.attributes) {
                    for (let i = 0; i < zoomer.attributes.length; i++) {
                        const attr = zoomer.attributes[i];
                        if (attr.trait_type === "Clan") result.localChar = attr.value.toLowerCase();
                    }
                }
                console.log(result.localChar);
            }
        }
        return response.json({ success: true, nfts: results });
    } catch (error) {
        console.error(error);
        return response.json({ success: false, code: 0, message: `Unknown error handling request.` });
    }
});

nftRouter.get('/getCharacter/:address', async (request: Request, response: Response) => {
    try {
        let address = String(request.params.address).toLowerCase();
        if (!address)
            return response.json({ success: false, code: 0, message: `Address not provided with request.` });

        const { database } = await mongodb();
        const collection = database.collection(`nft_user_characters`);
        const result = await collection.find({ address }).project({ _id: 0, tokenId: 1, collectionSlug: 1, collectionAddress: 1 }).toArray();
        if (result.length) {
            const key = result[0].collectionSlug + "-" + result[0].tokenId;
            return response.json({ success: true, result: key });
        }
        return response.json({ success: false, code: 1, message: `No set character found.` });
    } catch (error) {
        console.error(error);
        return response.json({ success: false, code: 0, message: `Unknown error handling request.` });
    }
});

nftRouter.post('/setCharacter', async (request: Request, response: Response) => {
    try {
        let address = String(request.params.address);
        if (!address)
            return response.json({ success: false, code: 0, message: `Address not provided with request.` });

        if (!request.body || !request.body.address || !request.body.message || !request.body.signature) {
            return response.json({ success: false, code: 1, message: `Missing body parameters.` });
        }

        try {
            let result = await changeCharacter(request.body.address, request.body.message, request.body.signature);
            response.json({ success: true, result });
        } catch (err) {
            console.log(err);
            response.json({ success: false, code: 0, message: `Unknown error handling request.` });
        }

        // const { database } = await mongodb();
        // const collection = database.collection(`nft_owners`); 
        // const results = await collection.find({address}).project({ _id: 0, tokenId: 1, collectionSlug: 1, collectionAddress: 1 }).toArray(); 
        // return response.json({ success: true, nfts: results }); 
    } catch (error) {
        console.error(error);
        return response.json({ success: false, code: 0, message: `Unknown error handling request.` });
    }
});


async function changeCharacter(address: string, message: string, signature: string) {
    //get id from message
    let slugAndId = String(message.substring(message.lastIndexOf(" ") + 1)).split("-");
    if (slugAndId.length < 2) return false;
    let slug = slugAndId.slice(0, -1).join("-");
    let id = Number(slugAndId[slugAndId.length - 1]);
    let addressLower = address.toLowerCase();

    //check to see if address owns this nft
    let owned = await ownsCharacter(addressLower, slug, id);
    if (!owned) return false;
    //check to see if the signature is valid
    try {
        let confAddress = web3.eth.accounts.recover(message, signature);
        if (confAddress.toLowerCase() != addressLower) return false;
    } catch (err) {
        console.log(err);
        return false;
    }

    let result = await changeDbCharacter(addressLower, slug, id, signature);
    return Boolean(result);
}


async function ownsCharacter(address: string, slug: string, id: number) {
    const { database } = await mongodb();
    const collection = database.collection(`nft_owners`);
    try {
        const result = await collection.find({ address, collectionSlug: slug, tokenId: id }).project({ _id: 1 }).toArray();
        if (result.length === 1) return true;
        return false;
    } catch (err) {
        console.error(err);
        return false;
    }
}


async function changeDbCharacter(address: string, slug: string, id: number, signature: string) {
    const { database } = await mongodb();
    const collection = database.collection(`nft_user_characters`);

    try {
        await collection.updateOne({ address }, { $set: { tokenId: id, collectionSlug: slug, signature, updated: new Date() } }, { upsert: true });
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}


export default nftRouter;