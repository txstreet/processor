# Setting up a Litecoin Node for TxStreet

These instructions are meant for DigitalOcean, but you can use the same steps with some modifications to create a node on other cloud providers.

## System Requirements

- 4GB memory
- 2 CPU cores
- At least 200GB of storage

## Setup

1. Create the droplet on DigitalOcean
- Use the same region and datacenter as your other droplets and databases.
- Ubuntu 22.04.
- Choose any type of droplet with the system requirements.
- Click "Add Volume" and set it to at least 200GB, "Automatically Format & Mount", and Ext4.
- Add your SSH key if you wish.
- Add the tag 'litecoin'.
- Click create droplet.
2. Modify system file limits.
- SSH into the droplet as the root user.
- Run the following commands:
```
echo 'root soft nproc 65535
root soft nofile 65535' | sudo tee -a /etc/security/limits.conf`
```
`echo 'session required pam_limits.so' | sudo tee -a /etc/pam.d/common-session`
- Reboot with `reboot`

3. Start syncing `litecoind`.
- `apt update`
- `apt install libdb-dev libdb++-dev -y`
- `apt install libfmt-dev -y`
- `apt install libboost-all-dev libzmq3-dev libminiupnpc-dev -y`
- `apt install curl git build-essential libtool autotools-dev -y`
- `apt install automake pkg-config bsdmainutils python3 -y`
- `apt install software-properties-common libssl-dev libevent-dev -y`
- `git clone https://github.com/litecoin-project/litecoin.git`
- `cd litecoin`
- `./autogen.sh`
- `./configure --with-incompatible-bdb`
- `make`
- `make install`
- `mkdir /var/lib/litecoind`
- `mkdir /root/.litecoin`
- `nano /root/.litecoin/litecoin.conf`
- Paste the following and save:
*Make sure to change `your_drive_directory` to the drive directory DigitalOcean created for you. You can `ls /mnt` to see what it is.*
```
txindex=1
server=1
daemon=1
listen=0
#change this to volume in your droplet
datadir=/mnt/your_drive_directory
disablewallet=1
rpcuser=user
rpcpassword=pass
rpcworkqueue=512
rpcthreads=4
dbcache=2500
rpcbind=0.0.0.0:9332
rpcallowip=0.0.0.0/0

# Enable zeromq for real-time data
zmqpubrawtx=tcp://0.0.0.0:28332
zmqpubrawblock=tcp://0.0.0.0:28332
zmqpubhashtx=tcp://0.0.0.0:28332
zmqpubhashblock=tcp://0.0.0.0:28332
```
- `nano /etc/systemd/system/litecoind.service`
- Paste the following and save:
```
[Unit]
Description=Litecoins distributed currency daemon
After=network.target

[Service]
User=root
Group=root

Type=forking
PIDFile=/var/lib/litecoind/litecoind.pid
ExecStart=/usr/local/bin/litecoind -daemon -pid=/var/lib/litecoind/litecoind.pid \
-conf=/root/.litecoin/litecoin.conf

Restart=always
PrivateTmp=true
TimeoutStopSec=60s
TimeoutStartSec=2s
StartLimitInterval=120s
StartLimitBurst=5

[Install]
WantedBy=multi-user.target
```
- `systemctl daemon-reload`
- `service litecoind start`
- Verify the service is running properly with `service litecoind status`
- `systemctl enable litecoind`

4. Wait for the litecoin blockchain to sync. This may take a while and seem stalled for a bit, but just give it time. Check on the status with `litecoin-cli getblockchaininfo`
5. Resize the disk when needed.
- See https://docs.digitalocean.com/products/volumes/how-to/increase-size/
6. Update litecoind when needed.
- `service litecoind stop`
- `cd /root/litecoin`
- `git pull`
- `./autogen.sh`
- `./configure --with-incompatible-bdb`
- `make`
- `make install`
- `service litecoind start`