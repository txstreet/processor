import BlockchainWrapper from "../base";
import Web3 from 'web3';


export default class ETHWrapper extends BlockchainWrapper {
    public web3: Web3;
    public options: { [key: string]: any };
    // public blockSubscription: 

    constructor(host: string) {
        super('ETH');

        // Initialize web3
        this.options = {
            clientConfig: {
                maxReceivedFrameSize: 10000000000,
                maxReceivedMessageSize: 10000000000,
                keepalive: true,
                keepaliveInterval: 1000,
            },
            reconnect: {
                auto: true,
                delay: 1000,
                maxAttempts: Number.MAX_SAFE_INTEGER,
                onTimeout: false
            }
        };

        const provider = new Web3.providers.WebsocketProvider(host, this.options);
        this.web3 = new Web3(provider);

        // Add admin peers, nodeInfo, and removePeer functions. 
        this.web3.eth.extend({
            property: 'admin',
            methods: [
                { name: 'peers', call: 'admin_peers' },
                { name: 'nodeInfo', call: 'admin_nodeInfo' },
                { name: 'removePeer', call: 'admin_removePeer', params: 1 }
            ]
        });

        // Add txpoorl content, inspect, and status functions. 
        this.web3.eth.extend({
            property: 'txpool',
            methods: [
                { name: "content", call: "txpool_content" },
                { name: "inspect", call: "txpool_inspect" },
                { name: "status", call: "txpool_status" }
            ]
        });
    }

    public initEventSystem() {
        this.web3.eth.subscribe('pendingTransactions', (error: any, result: any) => { }).on('data', async (hash: string) => {
            try {
                const transaction = await this.getTransaction(hash, 2);
                this.emit('mempool-tx', transaction);
            } catch (error) {
                console.error(error);
            }
        });

        this.web3.eth.subscribe('newBlockHeaders', (error: any, result: any) => { }).on('data', (block: any) => {
            // console.log("BLOCK TEST", block);
            this.emit('confirmed-block', block.hash);
        });
    }

    public async getCurrentHeight(): Promise<null | number> {
        return await this.web3.eth.getBlockNumber();
    }

    public async getTransactionReceipts(block: any) {
        try {
            let promises = [];
            for (let i = 0; i < block.transactions.length; i++) {
                const transaction = block.transactions[i];
                promises.push(this.web3.eth.getTransactionReceipt(transaction.hash));
            }
            let receipts = await Promise.all(promises);
            return receipts;
        } catch (error) {
            console.error(error);
            return [];
        }
    };

    public async getTransactionReceipt(hash: string) {
        try {
            let receipt = await this.web3.eth.getTransactionReceipt(hash);
            return receipt;
        }
        catch (error) {
            console.log(error);
            return null;
        }
    }

    public async getTransaction(id: string, verbosity: number, blockId?: string | number): Promise<any> {
        try {
            const transaction: any = await this.web3.eth.getTransaction(id);
            if (!transaction) return null;
            if (typeof transaction === "string") return null;

            if (transaction.from)
                transaction.from = transaction.from.toLowerCase();
            if (transaction.to)
                transaction.to = transaction.to.toLowerCase();

            if (transaction.gasPrice)
                transaction.gasPrice = Number(transaction.gasPrice);
            if (transaction.v)
                transaction.v = Number(transaction.v);
            if (transaction.value)
                transaction.value = Number(transaction.value);
            if (transaction.maxPriorityFeePerGas)
                transaction.maxPriorityFeePerGas = Number(transaction.maxPriorityFeePerGas);
            if (transaction.maxFeePerGas)
                transaction.maxFeePerGas = Number(transaction.maxFeePerGas);

            transaction.pendingSortPrice = Number(transaction.gasPrice || transaction.maxFeePerGas);

            if (verbosity > 0 && transaction.blockHash) {
                transaction.receipt = await this.web3.eth.getTransactionReceipt(id);
            }
            return transaction;
        } catch (error: any) {
            console.error(error);
            const msg = error.message || error.toString()
            if (msg.includes("connection not open on send"))
                process.exit(1);
            console.error(error);
            return null;
        }
    }

    public async getBlock(id: string | number, verbosity: number): Promise<any> {
        try {
            const returnTransactionObjects = verbosity > 0 ? true : false;
            let block: any;
            if(returnTransactionObjects){
                block = await this.web3.eth.getBlock(id, true);
            }
            else{
                block = await this.web3.eth.getBlock(id, false);
            }
            if (!block) return null;

            block.height = block.number;
            block.baseFeePerGas = Number(block.baseFeePerGas);
            block.timestamp = Math.floor(block.timestamp);

            for (let i = 0; i < block.transactions?.length; i++) {
                const transaction = block.transactions[i];
                if (typeof transaction === "string") continue;

                if (transaction.from)
                    transaction.from = transaction.from.toLowerCase();
                if (transaction.to)
                    transaction.to = transaction.to.toLowerCase();

                if (transaction.gasPrice)
                    transaction.gasPrice = Number(transaction.gasPrice);
                if (transaction.v)
                    transaction.v = Number(transaction.v);
                if (transaction.value)
                    transaction.value = Number(transaction.value);
                if (transaction.maxPriorityFeePerGas)
                    transaction.maxPriorityFeePerGas = Number(transaction.maxPriorityFeePerGas);
                if (transaction.maxFeePerGas)
                    transaction.maxFeePerGas = Number(transaction.maxFeePerGas);

                transaction.pendingSortPrice = Number(transaction.gasPrice || transaction.maxFeePerGas);

                block.transactions[i] = transaction;
            }

            return block;
        } catch (error: any) {
            const msg = error.message || error.toString()
            if (msg.includes("connection not open on send"))
                process.exit(1);
            console.error(error);
            console.error(error);
            return null;
        }
    }

    public async getCode(address: string) {
        try {
            return await this.web3.eth.getCode(address);
        } catch (error) {
            console.error(error);
            console.error(error);
            return "0x";
        }
    }

    public async getUncle(blockId: string | number, uncleIndex: number): Promise<any> {
        try {
            const block: any = await this.web3.eth.getUncle(blockId, uncleIndex, true);
            if (!block) return null;

            block.height = block.number;
            block.baseFeePerGas = Number(block.baseFeePerGas);
            block.timestamp = Math.floor(block.timestamp);

            if (Array.isArray(block.transactions)) {
                for (let i = 0; i < block.transactions?.length; i++) {
                    const transaction = block.transactions[i];
                    if (typeof transaction === "string") continue;

                    if (transaction.from)
                        transaction.from = transaction.from.toLowerCase();
                    if (transaction.to)
                        transaction.to = transaction.to.toLowerCase();

                    if (transaction.gasPrice)
                        transaction.gasPrice = Number(transaction.gasPrice);
                    if (transaction.v)
                        transaction.v = Number(transaction.v);
                    if (transaction.value)
                        transaction.value = Number(transaction.value);
                    if (transaction.maxPriorityFeePerGas)
                        transaction.maxPriorityFeePerGas = Number(transaction.maxPriorityFeePerGas);
                    if (transaction.maxFeePerGas)
                        transaction.maxFeePerGas = Number(transaction.maxFeePerGas);

                    transaction.pendingSortPrice = Number(transaction.gasPrice || transaction.maxFeePerGas);

                    block.transactions[i] = transaction;
                }
            }

            return block;
        } catch (error: any) {
            const msg = error.message || error.toString()
            if (msg.includes("connection not open on send"))
                process.exit(1);
            console.error(error);
            console.error(error);
            return null;
        }
    }

    public async resolveUncle(id: string | number, index: number): Promise<any> {
        try {
            const block: any = await this.web3.eth.getUncle(id, index, true);
            if (!block) return { exists: false };
            if (!block.number) return { exists: false };

            block.height = block.number;
            block.baseFeePerGas = Number(block.baseFeePerGas);
            block.timestamp = Math.floor(block.timestamp);

            if (Array.isArray(block.transactions)) {
                for (let i = 0; i < block.transactions?.length; i++) {
                    const transaction = block.transactions[i];
                    if (typeof transaction === "string") continue;

                    if (transaction.from)
                        transaction.from = transaction.from.toLowerCase();
                    if (transaction.to)
                        transaction.to = transaction.to.toLowerCase();

                    if (transaction.gasPrice)
                        transaction.gasPrice = Number(transaction.gasPrice);
                    if (transaction.v)
                        transaction.v = Number(transaction.v);
                    if (transaction.value)
                        transaction.value = Number(transaction.value);
                    if (transaction.maxPriorityFeePerGas)
                        transaction.maxPriorityFeePerGas = Number(transaction.maxPriorityFeePerGas);
                    if (transaction.maxFeePerGas)
                        transaction.maxFeePerGas = Number(transaction.maxFeePerGas);

                    transaction.pendingSortPrice = Number(transaction.gasPrice || transaction.maxFeePerGas);

                    block.transactions[i] = transaction;
                }
            }
            return block;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    public async resolveBlock(id: string | number, verbosity: number, depth: number): Promise<any> {
        try {
            const block = await this.getBlock(id, verbosity);
            if (!block)
                return { exists: false };
            if (block.height == null)
                return { exists: false };
            return { exists: true, block };
        } catch (error) {
            console.error(error);
            console.error(error);
            return { exists: false };
        }
    }

    public async getTransactionCount(address: string): Promise<number> {
        try {
            return await this.web3.eth.getTransactionCount(address);
        } catch (error) {
            console.error(error);
            return 0;
        }
    }

    public isTransaction(data: any): boolean {
        if (!data.hash) return false;
        if (!data.gasPrice) return false;
        return true;
    }

    public isTransactionConfirmed(transaction: any): boolean {
        return transaction.blockHash != null;
    }

    public isBlock(data: any): boolean {
        if (!data.chain) return false;
        if (!data.hash) return false;
        if (!data.height) return false;
        return true;
    }
}