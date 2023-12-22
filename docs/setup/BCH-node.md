# Setting up a Bitcoin Cash Node for TxStreet

These instructions are meant for DigitalOcean, but you can use the same steps with some modifications to create a node on other cloud providers.

## System Requirements

- 8GB memory
- 4 CPU cores
- At least 300GB of storage

## Setup

1. Create the droplet on DigitalOcean
- Use the same region and datacenter as your other droplets and databases.
- Ubuntu 20.04.
- Choose any type of droplet with the system requirements.
- Click "Add Volume" and set it to at least 300GB, "Automatically Format & Mount", and Ext4.
- Add your SSH key if you wish.
- Add the tag 'bitcoin-cash'.
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

3. Start syncing `bitcoind`.
- `add-apt-repository ppa:bitcoin-unlimited/bucash -y`
- `apt update`
- `apt install bitcoind -y`
- `mkdir /var/lib/bitcoind/`
- `mkdir /root/.bitcoin`
- `nano /root/.bitcoin/bitcoin.conf`
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
rpcbind=0.0.0.0:8332
rpcallowip=0.0.0.0/0

# Enable zeromq for real-time data
zmqpubrawtx=tcp://0.0.0.0:28332
zmqpubrawblock=tcp://0.0.0.0:28332
zmqpubhashtx=tcp://0.0.0.0:28332
zmqpubhashblock=tcp://0.0.0.0:28332
```
- `nano /etc/systemd/system/bitcoind.service`
- Paste the following and save:
```
[Unit]
Description=Bitcoins distributed currency daemon
After=network.target

[Service]
User=root
Group=root

Type=forking
ExecStart=/usr/bin/bitcoind -daemon -pid=/var/lib/bitcoind/bitcoind.pid -conf=/root/.bitcoin/bitcoin.conf
PIDFile=/var/lib/bitcoind/bitcoind.pid

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
- `service bitcoind start`
- Verify the service is running properly with `service bitcoind status`
- `systemctl enable bitcoind`

4. Wait for the bitcoin blockchain to sync. This may take a while and seem stalled for a bit, but just give it time. Check on the status with `bitcoin-cli getblockchaininfo`
5. Resize the disk when needed.
- See https://docs.digitalocean.com/products/volumes/how-to/increase-size/
6. Update bitcoind when needed.
- `service bitcoind stop`
- `apt update`
- `apt install bitcoind`
- `service bitcoind start`