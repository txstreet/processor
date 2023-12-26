import redis from "../../databases/redis";
// import Web3 from 'web3';
import { providers } from "ethers";

function getQuickNodeEndpoint(chain: string) {
    // const provider = new Web3.providers.WebsocketProvider(process.env['QUICKNODE_' + chain]);
    const envKey = 'QUICKNODE_' + chain;
    const url = process.env[envKey];

    if (!url) {
      console.error(`${envKey} not configured`);
      return;
    }

    return new providers.JsonRpcProvider({
      url,
      headers: { "x-qn-api-version": 1 },
    });
}

class tokenManager {
    public chain;
    public quicknode;
    constructor(chain: string) {
        this.chain = chain;
        this.quicknode = getQuickNodeEndpoint(chain);
        console.log(chain + " token manager initialized");
    }

    async getToken(contract: string) {
        const key = this.chain + "-token-" + contract;
        let cached: any = await redis.getAsync(key);
        if (!cached) {
            let tokenInfo = await this.quickNodeFetch(contract);
            if (tokenInfo.contract) {
                tokenInfo.contract.address = contract;
                redis.setAsync(key, JSON.stringify(tokenInfo.contract), 'EX', 3600 * 168); //1 week
                return tokenInfo.contract;
            }
            else {
                return false;
            }
        }
        else {
            return JSON.parse(cached);
        }
    }

    async quickNodeFetch(contract: string) {
        if (!this.quicknode) {
          return {};
        }

        const result = await this.quicknode.send("qn_getTokenMetadataByContractAddress", {
            //@ts-ignore
            contract
        });
        return result || {};
    }
}

export default tokenManager;

