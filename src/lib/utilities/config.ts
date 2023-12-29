class Config {
  ethBulkUrl: string;

  constructor(env = process.env) {
    this.ethBulkUrl = env["ETH_BULK_URL"];

    if (!/^https?:/i.test(this.ethBulkUrl)) throw "Missing $ETH_BULK_URL";
  }
};

const config = new Config();

export default config;
