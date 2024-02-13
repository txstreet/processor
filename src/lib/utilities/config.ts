import { ETHWrapper, ETHBesuWrapper } from '../node-wrappers';
import { chainConfig } from '../../data/chains';
import minimist from 'minimist';

const fs = require("fs");

const blockchainImpls = ['BTC', 'LTC', 'BCH', 'XMR', 'ETH', 'RINKEBY'];
for (const name in chainConfig) {
  if (!blockchainImpls.includes(name)) {
    blockchainImpls.push(name);
  }
}
console.log("Valid chains:", blockchainImpls);

class Config {
  public mongodbUri:      string;
  public mongodbDatabase: string;
  public redisUri:        string;
  public ethBulkUrl:      string;
  public dataDir:         string;
  public envChains:       string[];

  private ethNodeUrl:     string;
  private ethBesuNodeUrl: string | null;

  constructor(env = process.env) {
    this.mongodbUri      = env.MONGODB_URI;
    this.mongodbDatabase = env.MONGODB_DATABASE;
    this.redisUri        = env.REDIS_URI;
    this.ethNodeUrl      = env.ETH_NODE;
    this.ethBesuNodeUrl  = env.ETH_BESU_NODE;
    this.ethBulkUrl      = env.ETH_BULK_URL;
    this.dataDir         = env.DATA_DIR;
    this.envChains       = filterValidChains(chainsFromEnv(env.CHAINS || ""));

    if (!/^mongodb:/.test(this.mongodbUri)) {
      throw new Error("Invalid $MONGODB_URI");
    }

    if (!/\w/.test(this.mongodbDatabase)) {
      throw new Error("Invalid $MONGODB_DATABASE");
    }

    if (!/^redis:/.test(this.redisUri)) {
      throw new Error("Invalid $REDIS_URI");
    }

    if (this.ethBesuNodeUrl) {
      if (!/^wss?:/i.test(this.ethBesuNodeUrl)) {
        throw new Error("Invalid $ETH_BESU_NODE");
      }
    } else {
      if (!/^wss?:/i.test(this.ethNodeUrl)) {
        throw new Error("Invalid $ETH_NODE");
      }
    }

    if (!/^https?:/i.test(this.ethBulkUrl)) {
      throw new Error("Invalid $ETH_BULK_URL");
    }

    if (!/\w/.test(this.dataDir)) {
      throw new Error("Invalid $DATA_DIR");
    }

    if (!isDirectory(this.dataDir)) {
      throw new Error("Not a directory: $DATA_DIR");
    }
  }

  public initEthWrapper(): ETHWrapper {
    return this.initEthBesuWrapper() || new ETHWrapper(this.ethNodeUrl);
  }
  
  private initEthBesuWrapper(): ETHBesuWrapper | null {
    if (!this.ethBesuNodeUrl) return null;

    return new ETHBesuWrapper(this.ethBesuNodeUrl);
  }

  public enabledChains(): string[] {
    const argChains = chainsFromArgs();

    if (argChains.length && this.envChains.length) {
      throw new Error(
        `Enabled chains must be specified by either arguments or env variables,` +
        ` not both.`
      );
    }

    return [ ...this.envChains, ...argChains ];
  }

  public mustEnabledChains(): string[] {
    const names = this.enabledChains();
    if (!names.length) throw new Error("No chains enabled");

    return names;
  }

  public mustEnabledChain(): string {
    const chains = this.mustEnabledChains();
    if (chains.length > 1) throw new Error("More than one chain enabled");

    return chains[0];
  }
}

const chainsFromEnv = (value: string): string[] => {
  if (/\[/.test(value)) {
    return JSON.parse(value);
  }

  return (value || "").split(",");
};

const chainsFromArgs = (): string[] => {
  return filterValidChains(chainArgs());
};

const chainArgs = (): string[] => {
  const args = minimist(process.argv.slice(2));
  let chains: string[] = [];

  if (args.chain) {
    if (typeof args.chain === "string") {
      chains = [args.chain];
    } else {
      chains = args.chain;
    }
  }

  return [ ...chains, ...args._ ];
};

const filterValidChains = (names: string[]): string[] => {
  const result: string[] = [];

  for (let name of names) {
    name = name.toUpperCase();
    if (!blockchainImpls.includes(name)) continue;

    result.push(name);
  }

  return result;
};

const isDirectory = (path: string) => {
  const stats = fs.statSync(path, {throwIfNoEntry: false});

  return stats?.isDirectory;
};

const config = new Config();

export default config;
