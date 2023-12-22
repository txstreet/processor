# Setting up Redis for TxStreet

These instructions are meant for DigitalOcean, but you can use the self-managed steps for other cloud providers.

## Managed Setup

It is recommended to create a managed database in DigitalOcean. This makes upgrading, resizing, backups and maintenance very easy. 

1. Create the database
- Click "Create Database" in DigitalOcean.
- Choose the same region and datacenter as all your other droplets.
- Choose Redis with the latest version.
- For the database configuration, choose shared CPU and either the 1GB or 2GB option, depending on how many blockchains you are running.
- Decide if you want standby nodes. You should get this if you want zero downtime. You need at least the 2GB configuration for this.
- Click "Create database cluster"
2. Add trusted sources
- Put in all the IP addresses that you will be connecting to the database with. You can also enter in droplets and tags. You should enter in all the tags from your droplets here and keep it updated with new ones.
3. Note the VPC Network Connection String. You will need this to connect your droplets to the database. The Public network can be used to connect from your personal computer to debug with a redis client.

## Self-Managed Setup

Running a self-managed redis server on Ubuntu is fairly simple. These steps assume you already have a droplet or other kind of Ubuntu VM running.

1. Install Redis
- Login to the droplet as root.
- `apt update`
- `apt install redis`
- `nano /etc/redis/redis.conf`
- Make sure the `requirepass` line is not commented out, and is using a strong password. Note the droplet IP and redis password to create the connection string. Save the file.
- `systemctl restart redis-server`
2. Make sure your other droplets and servers have access to redis and no firewalls are blocking port 6379.