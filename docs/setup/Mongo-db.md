# Setting up Mongodb for TxStreet

These instructions are meant for DigitalOcean.

## Managed Setup

It is recommended to create a managed database in DigitalOcean. This makes upgrading, resizing, backups and maintenance very easy. 

1. Create the database
- Click "Create Database" in DigitalOcean.
- Choose the same region and datacenter as all your other droplets.
- Choose MongoDB with the latest version.
- The database configuration is up to you, and will depend on how many blockchains you are running. A shared CPU will work fine. 4 CPU and 8GM RAM should be enough to run all the blockchains. If you are only running 1-2 low throughput blockchains, you can choose between the lower options. If you notice performance issues, you can always resize the database without any downtime.
- Decide if you want standby nodes. You should get this if you want zero downtime or if you are storing data that needs backing up.
- Click "Create database cluster"
2. Add trusted sources
- Put in all the IP addresses that you will be connecting to the database with. You can also enter in droplets and tags. You should enter in all the tags from your droplets here and keep it updated with new ones.
3. Note the VPC Network Connection String. You will need this to connect your droplets to the database. The Public network can be used to connect from your personal computer to debug with MongoDB Compass.

## Self-Managed Setup

A self-managed mongodb cluster will be a lot more complicated to setup. Here is a good tutorial on how to run one locally: https://medium.com/@goldblumie1/creating-a-mongodb-self-hosted-replica-set-database-da45dc9dc463