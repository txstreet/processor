# Setting up an Ethereum Node for TxStreet

These instructions are meant for DigitalOcean, but you can use the same steps with some modifications to create a node on other cloud providers.

## System Requirements

- At least 2TB of storage recommended
        On DigitalOcean, use a large storage optimized disk. Do not use an external volume as the read and write speeds are not fast enough.
- 16GB memory
- At least 4 CPU cores

## Setup

1. Create the droplet on Digital Ocean.
- Use the same region and datacenter as your other droplets and databases.
- Ubuntu 23.04.
- Storage optimized dedicated cpu with 1.5x SSD and at least 1.76 TB NVMe SSD.
- Add your SSH key if you wish.
- Add the tag 'geth'.
- Click create droplet.

2. Start syncing the execution client client 'geth'.
- SSH into the droplet as the root user.
- `add-apt-repository -y ppa:ethereum/ethereum`
- `apt update`
- `apt install geth`
- `mkdir /root/ethereum`
- `openssl rand -hex 32 | sudo tee /root/ethereum/jwt.hex > /dev/null`
- `nano /etc/systemd/system/geth.service`
- Paste the following and save:
```
[Unit]
Description=Geth

[Service]
Type=simple
User=root
Restart=always
RestartSec=12
ExecStart=/usr/bin/geth --http --http.corsdomain *  --http.addr 0.0.0.0 --http.api admin,db,eth,miner,web3,net,personal,txpool --ws --ws.addr 0.0.0.0 --ws.api admin,db,eth,miner,web3,net,personal,txpool --ws.origins *  --txpool.globalslots 75000 --txpool.accountslots 64 --txpool.accountqueue 16 --txpool.globalqueue 5000 --txpool.lifetime 24h0m0s --maxpeers 200 --authrpc.jwtsecret /root/ethereum/jwt.hex
[Install]
WantedBy=default.target
```
- `systemctl daemon-reload`
- `service geth start`
- Verify the service is running properly with `service geth status`
- `systemctl enable geth.service`

3. Start syncing the consensus client, 'prysm'.
- `mkdir /root/prysm`
- `cd prysm`
- `curl https://raw.githubusercontent.com/prysmaticlabs/prysm/master/prysm.sh --output prysm.sh && chmod +x prysm.sh`
- `nano /etc/systemd/system/beacon-chain.service`
- Paste the following and save:
```
[Unit]
Description=Prysm Consensus Client BN (Mainnet)
Wants=network-online.target
After=network-online.target
[Service]
User=root
Group=root
Type=simple
Restart=always
RestartSec=5
ExecStart=/root/prysm/prysm.sh beacon-chain \
  --mainnet \
  --datadir=/root/prysm/data \
  --execution-endpoint=http://127.0.0.1:8551 \
  --jwt-secret=/root/ethereum/jwt.hex \
  --checkpoint-sync-url=https://sync-mainnet.beaconcha.in \
  --genesis-beacon-api-url=https://sync-mainnet.beaconcha.in \
  --accept-terms-of-use
[Install]
WantedBy=multi-user.target
```
- `systemctl daemon-reload`
- `service beacon-chain start`
- Verify the service is running properly with `service beacon-chain status`
- `systemctl enable beacon-chain.service`
4. Install nodejs and tmp-bulk-geth-api. This service will always run with pm2 and allow for bulk ipc requests to the geth node.
- `cd /root`
- `curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash`
- `exit` and log back in with SSH.
- `nvm install node`
- `npm install -g pm2`
- `git clone https://github.com/txstreet/tmp-bulk-geth-api.git`
- `cd tmp-bulk-geth-api`
- `npm install`
- `pm2 start "node index"`
- `pm2 save`
- `pm2 startup`
5. Monitor geth and prysm to make sure they complete syncing. 
- Monitor geth sync status with `geth attach` and then `eth.syncing`. It will return `false` if it is fully synced.
- Monitor prysm by checking the beacon-chain service logs.
6. Apply updates whenever a new version of geth or prysm is released.
- To update geth `apt update && apt install geth`, then `service geth restart`
- To update prysm `service beacon-chain restart`