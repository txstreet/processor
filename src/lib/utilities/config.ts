import { ETHWrapper, ETHBesuWrapper } from '../node-wrappers';

const fs = require("fs");

class Config {
  public ethBulkUrl: string;
  public dataDir:    string;

  private ethNodeUrl:     string;
  private ethBesuNodeUrl: string | null;

  constructor(env = process.env) {
    this.ethNodeUrl     = env.ETH_NODE;
    this.ethBesuNodeUrl = env.ETH_BESU_NODE;
    this.ethBulkUrl     = env.ETH_BULK_URL;
    this.dataDir        = env.DATA_DIR;


    if (this.ethBesuNodeUrl) {
      if (!/^wss?:/i.test(this.ethBesuNodeUrl)) {
        throw "Invalid $ETH_BESU_NODE";
      }
    } else {
      if (!/^wss?:/i.test(this.ethNodeUrl)) {
        throw "Invalid $ETH_NODE";
      }
    }

    if (!/^https?:/i.test(this.ethBulkUrl)) {
      throw "Invalid $ETH_BULK_URL";
    }

    if (!/\w/.test(this.dataDir)) {
      throw "Invalid $DATA_DIR";
    }

    if (!isDirectory(this.dataDir)) {
      throw "Not a directory: $DATA_DIR";
    }
  }

  public initEthWrapper(): ETHWrapper {
    return this.initEthBesuWrapper() || new ETHWrapper(this.ethNodeUrl);
  }
  
  private initEthBesuWrapper(): ETHBesuWrapper | null {
    if (!this.ethBesuNodeUrl) return null;

    return new ETHBesuWrapper(this.ethBesuNodeUrl);
  }
};

const isDirectory = (path: string) => {
  const stats = fs.statSync(path, {throwIfNoEntry: false});

  return stats?.isDirectory;
};

const config = new Config();

export default config;
