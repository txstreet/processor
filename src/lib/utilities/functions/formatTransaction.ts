import { findNftOwner } from "..";
//@ts-ignore
import txStreetIds from "@txstreet/txstreet-token-ids";
import zoomersJson from '../../../lib/json/zoomers.json';
import zoomerIdsJson from '../../../lib/json/zoomerIds.json';

const zoomerIds: any = zoomerIdsJson;
const zoomers: any = zoomersJson;

export default (chain: string, data: any) => {
    var obj: any = {};
    if (chain === "ETH" || chain == "RINKEBY" || chain === "ARBI") {
        obj.tx = (typeof data.hash === "undefined" ? data.tx : data.hash);
        if (data.to) obj.to = data.to;
        if (data.from) obj.fr = data.from;
        if (typeof data.extras !== "undefined" && data.extras && Object.keys(data.extras).length > 0) obj.e = data.extras;
        if (data.house && data.house != "0" && data.house != "0.0") obj.h = data.house;
        obj.g = data.gas;
        if (data.input == "0x" && data.gas > 21000) {
            //adjusted gas
            obj.ag = 21000;
        }
        obj.tot = +(data.value > 0 ? Number(data.value) / Math.pow(10, 18) : 0).toFixed(6);
        obj.gp = data.gasPrice || data.maxFeePerGas;
        obj.n = data.nonce;
        obj.an = data.fromNonce;
        obj.t = data.timestamp;
        obj.ia = data.insertedAt;
        if (data.blockHash) obj.bh = data.blockHash;
        if (data.deletedHashes && data.deletedHashes.length) obj.dh = data.deletedHashes || [];

        obj.ty = Number(data.type) || 0;
        if (data.maxFeePerGas) obj.mfpg = Number(data.maxFeePerGas);
        if (data.maxPriorityFeePerGas) obj.mpfpg = Number(data.maxPriorityFeePerGas);
        try {
            let nft: any = findNftOwner(obj.fr, true);
            if (nft) {
                obj.char = nft;
                let split = nft.split("-");
                obj.nftChar = {
                    collectionSlug: split.slice(0, -1).join("-"),
                    tokenId: split[split.length - 1]
                }

                if (obj.nftChar.collectionSlug === "moonheads") {
                    obj.char = txStreetIds.getName(Number(split[1]));
                }
                if (obj.nftChar.collectionSlug === "moonheads-zoomers") {
                    let realId = zoomerIds[obj.nftChar.tokenId];
                    let zoomer = zoomers[realId];
                    if (zoomer.attributes) {
                        for (let i = 0; i < zoomer.attributes.length; i++) {
                            const attr = zoomer.attributes[i];
                            if (attr.trait_type === "Clan") obj.char = attr.value.toLowerCase();
                        }
                    }
                }
            }
        } catch (error) {
            console.error(error);
            delete obj.char;
            delete obj.nftChar;
        }
    } else if (chain === "BTC" || chain === "LTC" || chain === "BCH") {
        obj.tx = data.hash;
        if (Object.keys(data.extras || {}).length > 0) obj.e = data.extras;
        if (data.house && data.house != "0" && data.house != "0.0") obj.h = data.house;
        if (data.fee && data.size)
            obj[chain === "LTC" ? "lpb" : "spb"] = parseFloat((data.fee / data.size).toFixed(2));
        obj.s = Number(data.size);
        obj.rs = Number(data.rsize);
        obj.tot = (data.total > 0 ? Number(data.total.toFixed(5)) : 0);

        obj.t = data.timestamp;
        obj.ia = data.insertedAt;

        if (data.from && data.from.length && data.from.length <= 10) obj.fr = data.from;
        if (data.to && data.to.length && data.to.length <= 10) obj.to = data.to;
        if (data.blockHash) obj.bh = data.blockHash;
        if (data.vin) obj.inputs = data.vin;
        if (data.vout) obj.outputs = data.vout;
    } else if (chain === "XMR") {
        obj.tx = data.hash || data.tx;
        obj.s = Number(data.size);
        obj.aByte = parseFloat((data.fee / data.size).toFixed(2));
        obj.f = Number(data.fee);


        obj.t = data.timestamp;
        obj.ia = data.insertedAt;

        if (data.blockHash) obj.bh = data.blockHash;
        if (data.paymentId) obj.pid = data.paymentId;
    }

    return obj;
}
