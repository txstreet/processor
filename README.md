# TxStreet Backend

Backend monorepo for TxStreet. 

## Requirements

- Mongo Replica Set
- Redis
- Blockchain Nodes (ETH, BTC, BCH, XMR, LTC)
- Nodejs 16
- Typescript
- PM2
- Nginx (Optional)

## Setup

These instructions are meant for DigitalOcean, but you can use the same steps with some modifications to run on other cloud providers or locally. Get $200 credit for DigitalOcean using this link - https://m.do.co/c/8f9aff88f052

1. Decide what blockchains you want to run, and set up a node for each.
- [Set up a Bitcoin Node for TxStreet](docs/setup/BTC-node.md)
- [Set up an Ethereum Node for TxStreet](docs/setup/ETH-node.md)
- [Set up a Bitcoin Cash Node for TxStreet](docs/setup/BCH-node.md)
- [Set up a Litecoin Node for TxStreet](docs/setup/LTC-node.md)
- [Set up a Monero Node for TxStreet](docs/setup/XMR-node.md)
- Setup an Arbitrum Endpoint for TxStreet (Coming soon)(Requires Ethereum Node)

2. Set up the databases.
- [Setup MongoDB for TxStreet](docs/setup/Mongo-db.md)
- [Setup Redis for TxStreet](docs/setup/Redis-db.md)

3. [Setting up the TxStreet backend processors](docs/setup/Processor.md)
4. [Setting up the TxStreet servers](docs/setup/Servers.md)
5. Set up firewalls (Coming soon)


## Advanced Setup

- [Kubernetes Cluster and Load Balancer](docs/setup/Kubernetes.md)
- Cloudflare and Domains (Coming Soon)


