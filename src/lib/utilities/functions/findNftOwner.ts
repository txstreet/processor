import readNFSFile from "./readNFSFile";
import path from 'path';
import mongodb from "../../../databases/mongodb";

var nftOwners: { [key: string]: any } = {};
var userCharacters: { [key: string]: any } = {};
var initialized = false;

const init = () => {
    if(initialized) return;
    updateUserCharacters();
    setInterval(updateUserCharacters, (1000 * 60));
    initialized = true;
}

const updateUserCharacters = async () => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('nft_user_characters');
        const results = await collection.find({}).project({_id: 0, address: 1, collectionSlug: 1, tokenId: 1}).toArray();
        if(results.length){
            userCharacters = {};
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                userCharacters[result.address] = result.collectionSlug + "-" + result.tokenId;
            }
        }
    }
    catch (error){
        console.log(error);
    }
}


//array of collections with priority on top
const priority = [
    "moonheads",
    "moonheads-zoomers",
    "cryptopunks",
    "boredapeyachtclub",
    "mutant-ape-yacht-club"
]

export default (address: string, returnSingle: boolean = false): any => {
    init();
    address = (address || '').toLowerCase();
    const userNft = userCharacters[address];
    if(userNft)
        return userNft;
    const nfts = nftOwners[address];
    if (!nfts) return null;
    if(returnSingle){
        for (let i = 0; i < priority.length; i++) {
            const collection = priority[i];
            if(nfts[collection]){
                //return string, randomized nft of priority collection
                return collection + "-" + nfts[collection][Math.floor(Math.random() * nfts[collection].length)];
            }
        }

        //not in priority list, format it anyways
        const collections = Object.keys(nfts);
        if(collections.length)
            return collections[0] + "-" + nfts[collections[0]][Math.floor(Math.random() * nfts[collections[0]].length)];

        return null;
    }
    //return object with all nft ownership
    return nfts;
}

