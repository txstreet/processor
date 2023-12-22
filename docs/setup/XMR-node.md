# Setting up a Monero Node for TxStreet

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
- Add the tag 'monero'.
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

3. Start syncing `monerod`.
- `apt update`
- `apt install bzip2`
- `mkdir /root/monero`
- `cd /root/monero`
- `wget https://downloads.getmonero.org/linux64`
- `tar -xjvf linux64 -C monero`
- `cd monero`
- `ln -s monero-x86_64-linux-gnu-v* latest`
- `nano /root/monero/monerod.conf`
- Paste the following and save:
*Make sure to change `your_drive_directory` to the drive directory DigitalOcean created for you. You can `ls /mnt` to see what it is.*
```
data-dir=/mnt/your_drive_directory
```
- `nano /etc/systemd/system/monerod.service`
- Paste the following and save:
```
[Unit]
Description=Monero Full Node
After=network.target

[Service]
User=root
WorkingDirectory=~
StateDirectory=monero
LogsDirectory=monero

# Clearnet config
Type=simple
ExecStart=/root/monero/monero/latest/monerod --non-interactive --zmq-pub tcp://0.0.0.0:18083 --rpc-bind-ip 0.0.0.0 --rpc-bind-port 18081 --limit-rate-up 16  --confirm-external-bind --config-file /root/monero/monerod.conf
StandardOutput=null
StandardError=null


Restart=always

[Install]
WantedBy=multi-user.target
```
- `systemctl daemon-reload`
- `service monerod start`
- Verify the service is running properly with `service monerod status`
- `systemctl enable monerod`

4. Wait for the monero blockchain to sync. This may take a while and seem stalled for a bit, but just give it time. Check on the status with:
```
curl http://127.0.0.1:18081/json_rpc -d '{"jsonrpc":"2.0","id":"0","method":"get_info"}' -H 'Content-Type: application/json'
```
5. Resize the disk when needed.
- See https://docs.digitalocean.com/products/volumes/how-to/increase-size/
6. Update monerod when needed.
- `service monerod stop`
- `cd /root/monero`
- `rm linux64`
- `wget https://downloads.getmonero.org/linux64`
- `tar -xjvf linux64 -C monero`
- `cd monero`
- `ls` to find the highest version directory
- `ln -s monero-x86_64-linux-gnu-v0.18.1.2 latest` *replace monero-x86_64-linux-gnu-v0.18.1.2 with directory name from previous step*
- `service monerod start`