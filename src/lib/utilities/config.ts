import { ETHWrapper, ETHBesuWrapper } from '../node-wrappers';

const fs = require("fs");

class Config {
  public mongodbUri:      string;
  public mongodbDatabase: string;
  public redisUri: string;
  public ethBulkUrl:      string;
  public dataDir:         string;

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
};

const isDirectory = (path: string) => {
  const stats = fs.statSync(path, {throwIfNoEntry: false});

  return stats?.isDirectory;
};

const config = new Config();

export default config;
