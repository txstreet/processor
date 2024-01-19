# Setting up the TxStreet backend processors

These instructions are meant for DigitalOcean, but you can use the same steps with some modifications for other cloud providers.

## Setup

1. Create a dedicated droplet on DigitalOcean to run the backend processes. It is also possible to run these in a kubernetes cluster, but for now we will keep things simple.
- Use the same region and datacenter as your other droplets and databases.
- Ubuntu 23.04.
- Dedicated CPU is recommended with at least 8GB of Ram and 4 CPU cores. If you are only running 1-2 low throughput blockchains, you can get away with lower specs.
- Add your SSH key if you wish.
- Add the tag 'processor'.
- Click create droplet.

2. Install processor and dependencies.
- Login to the droplet as root.
- `curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash`
- `exit` and log back in.
- `nvm install node v16`
- `npm install typescript -g`
- `npm install pm2 -g`
- `pm2 install pm2-logrotate`
- `git clone https://github.com/txstreet/processor.git`
- `cd processor`
- `npm install`
- `nano .env`
- Paste the following, make the necessary changes based on the comments, and save:
```
NODE_ENV=production

#Add your mongo VPC connecting string
MONGODB_URI=mongodb+srv://

#Add your redis VPC connecting string
REDIS_URI=rediss://

MONGODB_DATABASE=txstreet
USE_DATABASE=true
ETH_BULK_URL=http://bulk-geth-api:8080

#Optional quicknode api endpoint
QUICKNODE_ETH=
QUICKNODE_ARBI=

#Replace 0.0.0.0 with the private IP from each blockchain node
ETH_NODE=ws://0.0.0.0:8546
# Or:
ETH_BESU_NODE=ws://0.0.0.0:8546
LTC_NODE=0.0.0.0
BTC_NODE=0.0.0.0
XMR_NODE=0.0.0.0
BCH_NODE=0.0.0.0

PENDING_BATCH_SIZE=50
CONFIRMED_BATCH_SIZE=200

PROCESS_PENDING=true
PROCESS_CONFIRMED=true

WIKI_DIR=/root/wiki

#Optional etherscan api key
ETHERSCAN_API_KEY=

#Directory to store data that is shared between processes
DATA_DIR=/mnt/disks/txstreet_storage

UPDATE_DATABASES=true

#Change to remove any tickers/blockchains you are not supporting
TICKERS=["ETH", "LTC", "BTC", "RINKEBY", "BCH", "XMR", "ARBI"]

#Optional Opensea API key
OPENSEA_KEY=
```
- `tsc`
- `mkdir -p /mnt/disks/txstreet_storage` (or your chosen DATA_DIR)
- `node dist/entry/initial-setup`

3. Clone the wiki.
- `cd /root`
- git clone https://github.com/txstreet/wiki.git

4. Create pm2 processes. This step is assuming you are using Ethereum. You can repeat this step for any blockchain by replacing all instances of ETH with the ticker for that blockchain. For example, Bitcoin would be BTC instead of ETH. tx-processor, block-processor and node-subscriber can have multiple instances running at one time.
- `pm2 start "node ./dist/entry/tx-processor --ETH" --name "ETH Tx Processor" --namespace "ETH"`
- `pm2 start "node ./dist/entry/scheduled-tasks --ETH" --name "ETH Scheduled Tasks" --namespace "ETH"`
- `pm2 start "node ./dist/entry/block-processor --ETH" --name "ETH Block Processor" --namespace "ETH"`
- `pm2 start "node ./dist/entry/scheduled-tasks2 --ETH" --name "ETH Scheduled Tasks2" --namespace "ETH"`
- `pm2 start "node ./dist/entry/node-subscriber --ETH" --name "ETH Node Subscriber" --namespace "ETH"`
- `pm2 start "node dist/entry/create-stat-history --chain ETH --interval 5s --expires 1d" --name "ETH Stats 5s" --namespace "ETH"`
- `pm2 save`
- `pm2 startup`
- Check for any errors with `pm2 logs`
5. Create cronjobs.
- `crontab -e` and paste the following lines, with the correct path to the processor directory, and correct path to node version. Get the correct node path with `whereis node` and replace. Comment out any lines from blockchains you are not using.

```
#Stats 5 min

*/5 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain BTC --interval 5m --expires 30d --cron true

*/5 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain ETH --interval 5m --expires 30d --cron true

*/5 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain LTC --interval 5m --expires 30d --cron true

*/5 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain BCH --interval 5m --expires 30d --cron true

*/5 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain XMR --interval 5m --expires 30d --cron true

#Stats 1 hour

0 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain LTC --interval 1h --expires 365d --cron true

0 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain BTC --interval 1h --expires 365d --cron true

0 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain BCH --interval 1h --expires 365d --cron true

0 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain XMR --interval 1h --expires 365d --cron true

0 * * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain ETH --interval 1h --expires 365d --cron true


#Stats 1 day

0 5 * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain ETH --interval 1d --cron true

0 5 * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain BTC --interval 1d --cron true

0 5 * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain BCH --interval 1d --cron true

0 5 * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain LTC --interval 1d --cron true

0 5 * * * /root/.nvm/versions/node/v16.13.0/bin/node /root/processor/dist/entry/create-stat-history --chain XMR --interval 1d --cron true
```
6. The backend processor should now be fully operational, and the mongo database should be populating with transactions and blocks. Check for errors with `pm2 logs` and by checking the cron logs.
