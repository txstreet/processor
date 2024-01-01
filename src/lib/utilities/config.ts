const fs = require("fs");

class Config {
  ethBulkUrl: string;
  dataDir: string;

  constructor(env = process.env) {
    this.ethBulkUrl = env["ETH_BULK_URL"];
    this.dataDir = env["DATA_DIR"];

    if (!/^https?:/i.test(this.ethBulkUrl)) {
      throw "Missing $ETH_BULK_URL";
    }

    if (!/\w/.test(this.dataDir)) {
      throw "Missing $DATA_DIR";
    }

    if (!isDirectory(this.dataDir)) {
      throw "Not a directory: $DATA_DIR";
    }
  }
};

const isDirectory = (path: string) => {
  const stats = fs.statSync(path, {throwIfNoEntry: false});

  return stats?.isDirectory;
};

const config = new Config();

export default config;
