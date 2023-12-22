import BlockchainWrapper from "../base";
// import bitcore from 'bitcore-lib';
//@ts-ignore
import bitcore from 'bitcore-lib-ltc';
import * as bitcoinjs from 'bitcoinjs-lib';
const zmq = require('zeromq/v5-compat');
// @ts-ignore-line
import RpcClient from 'bitcoind-rpc';
import memcache from '../memcache';

export interface LTCRpcConfig {
    username: string,
    password: string,
    host: string,
    port?: number
}

export interface LTCZmqConfig {
    host: string,
    port?: number
}

export default class LTCWrapper extends BlockchainWrapper {
    public rpc: any;
    public sock: any;
    public configRpc: LTCRpcConfig;
    public configZmq?: LTCZmqConfig;

    constructor(configRpc: LTCRpcConfig, configZmq?: LTCZmqConfig) {
        super('LTC');
        this.configRpc = configRpc;
        this.configZmq = configZmq;

        // Initialize the Bitcoind RPC client.
        this.rpc = new RpcClient({
            protocol: 'http',
            user: configRpc.username,
            pass: configRpc.password,
            host: configRpc.host,
            port: configRpc.port
        });
    }

    public initEventSystem() {
        if (!this.configZmq)
            throw 'ZMQ Configuration was not supplied when initializing LTCWrapper.'

        this.sock = zmq.socket('sub');
        this.sock.connect(`tcp://${this.configZmq.host}:${this.configZmq.port}`);
        this.sock.subscribe('raw');
        this.sock.subscribe('hashblock');
        this.sock.subscribe('hashtx');
        this.sock.on('message', async (topicBuffer: Buffer, messageBuffer: Buffer) => {
            const topic = topicBuffer.toString('ascii');
            switch (topic) {
                case 'hashtx':
                    let txhash = messageBuffer.toString('hex');
                    // console.log(txhash);
                    let rpcTx = await this.getTransaction(txhash, 1);
                    // console.log(rpcTx);
                    this.emit('mempool-tx', rpcTx);

                    //     rpcTx.inputs.forEach((input: any) => {
                    //         if(input.address && input.address.includes('ltcmweb')) console.log(txhash, rpcTx)
                    //         if(input.ismweb) console.log(txhash, rpcTx)
                    //     });
                    //     rpcTx.outputs.forEach((output: any) => {
                    //         if(output.address && output.address.includes('ltcmweb')) console.log(txhash, rpcTx)
                    //         if(output.ismweb) console.log(txhash, rpcTx)
                    //     });
                    break;
                // case 'rawtx':
                //     try{

                //     let mweb = false;
                //     const hex = messageBuffer.toString('hex');
                //     const bitcoreTx: any = new bitcore.Transaction(messageBuffer);
                //     // const bitcoinjsTx = bitcoinjs.Transaction.fromHex(hex); 
                //     const transaction = bitcoreTx.toJSON();
                //     // console.log(rpcTx.inputs);
                //     if(memcache.get(`ltc-${transaction.hash}`)) return;
                //     memcache.put(`ltc-${transaction.hash}`, 1); 

                //     transaction.to = [];
                //     transaction.from = [];
                //     transaction.total = 0;
                //     transaction.asmArrays = [];

                //     for(let i = 0; i < transaction.outputs.length; i++) {
                //         const script = new bitcore.Script(transaction.outputs[i].script);
                //         transaction.outputs[i].address = script.toAddress().toString();
                //         transaction.outputs[i].asm = script.toASM();

                //         const output = transaction.outputs[i]; 

                //         let address = output.address;
                //         if(address.includes("ltcmweb1")){
                //             console.log(address);
                //             mweb = true;
                //         }
                //         if(address && address.length > 10 && transaction.to.indexOf(address) === -1) 
                //             transaction.to.push(address); 

                //         output.value = (output.satoshis / 100000000);
                //         output.usd = 0;

                //         transaction.outputs[i] = output; 
                //         transaction.total += output.value;
                //         transaction.asmArrays[i] = output.asm.split(' ');

                //         if(transaction.asmArrays[i] == "OP_RETURN") {
                //             if(!transaction.extras)
                //                 transaction.extras = {};
                //             transaction.extras.op_return = true; 
                //         }
                //     }

                //     for(let i = 0; i < transaction.inputs.length; i++) {
                //         const script = new bitcore.Script(transaction.inputs[i].script);
                //         transaction.inputs[i].address = script.toAddress().toString();
                //         transaction.inputs[i].asm = script.toASM();

                //         let address = transaction.inputs[i].address;
                //         if(address && address.length > 10 && transaction.from.indexOf(address) === -1) 
                //             transaction.from.push(address); 

                //         if(transaction.inputs[i].asm.length < 120) {
                //             if(!transaction.extras) 
                //                 transaction.extras = {};
                //             transaction.extras.sw = true;
                //         }
                //     }

                //     transaction.hex = hex;
                //     transaction.rsize = hex.length / 2;
                //     // transaction.size = bitcoinjsTx.virtualSize();
                //     transaction.size = 1;
                //     transaction.fee = false;
                //     transaction.fees = false; 

                //     if(mweb) console.log("mweb:", transaction);

                //     this.emit('mempool-tx', transaction);
                //     break;
                // } catch(error){
                //     console.error(error);
                // }

                case 'hashblock':
                    const hash = messageBuffer.toString('hex');
                    if (memcache.get(`ltc-${hash}`)) return;
                    memcache.put(`ltc-${hash}`, 1);
                    this.emit('confirmed-block', hash);
                    break;
            }
        });
    }

    public getTransactionReceipts: undefined;

    public getTransactionReceipt: undefined;

    public getTransactionCount: undefined;

    public async getTransaction(id: string, verbosity: number, blockId?: string | number): Promise<any> {
        const getRawTransaction = () => new Promise((resolve, reject) => {
            this.rpc.getRawTransaction(id, Math.max(Math.min(verbosity, 1), 0), blockId, (err: string, resp: any) => {
                if (err) return reject(err);
                let transaction = this.formatRPCTransaction(resp.result);
                return resolve(resp.result);
            });
        });

        const getFees = async (id: string) => new Promise((resolve) => {
            this.rpc.getMemPoolEntry(id, (error: string, resp: any) => {
                if (error) return resolve({ fee: false, fees: false });
                if (!resp) return resolve({ fee: false, fees: false });
                return resolve({ fee: resp.result.fee * 100000000, fees: resp.result.fees });
            });
        });

        try {
            let transaction: any = await getRawTransaction();
            if (!transaction) return null;

            // The transaction is not confirmed (no blockhash) and has no fee data, so we need to obtain it.
            if (!transaction.blockhash && !transaction.fee) {
                const fees: any = await getFees(transaction.hash);
                transaction = { ...transaction, ...fees };
            }
            return transaction;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    private formatRPCTransaction(transaction: any) {
        if (transaction) {
            // console.log(transaction); 
            transaction.timestamp = transaction.time * 1000;
            transaction.to = [];
            transaction.from = [];
            transaction.total = 0;
            transaction.asmArrays = [];

            if (transaction.vin || transaction.vout) {
                transaction.inputs = transaction.vin;
                transaction.outputs = transaction.vout;
                delete transaction.vin;
                delete transaction.vout;

                for (let i = 0; i < transaction.inputs.length; i++) {
                    transaction.inputs[i].asm = "";
                    if (transaction.inputs[i].scriptSig) {
                        const script = new bitcore.Script(transaction.inputs[i].scriptSig.hex);
                        transaction.inputs[i].address = script.toAddress().toString();
                        transaction.inputs[i].asm = transaction.inputs[i].scriptSig.asm;
                    }


                    let address = transaction.inputs[i].address;
                    if (address && address.length > 10 && transaction.from.indexOf(address) === -1)
                        transaction.from.push(address);
                }

                for (let i = 0; i < transaction.outputs.length; i++) {
                    const output = transaction.outputs[i];
                    if (!output.satoshis && output.value)
                        output.satoshis = output.value * 100000000;
                    if (output.scriptPubKey?.addresses) {
                        output.address = output.scriptPubKey.addresses[0];
                        // output.addresses = output.scriptPubKey.addresses;
                        for (let j = 0; j < output.scriptPubKey.addresses.length; j++) {
                            const outputAddress = output.scriptPubKey.addresses[j];
                            if (outputAddress && outputAddress.length > 10 && transaction.to.indexOf(outputAddress) === -1)
                                transaction.to.push(outputAddress);
                        }
                    }
                    output.asm = output?.scriptPubKey?.asm || "";

                    output.value = (output.satoshis / 100000000);
                    output.usd = 0;

                    transaction.outputs[i] = output;
                    transaction.total += output.value;
                    transaction.asmArrays[i] = output.asm.split(' ');

                    if (transaction.asmArrays[i] == "OP_RETURN") {
                        if (!transaction.extras)
                            transaction.extras = {};
                        transaction.extras.op_return = true;
                    }
                }
            }

            transaction.rsize = transaction.hex.length / 2;
            transaction.size = transaction.weight ? Math.ceil(transaction.weight / 4) : transaction.rsize;
            // transaction.size = transaction.rsize; 
            transaction.segwitHash = transaction.hash;
            transaction.hash = transaction.txid;

            if(transaction.vkern) console.log(transaction.vkern);
            delete transaction.txid;
        }
        return transaction;
    }

    public async getBlock(id: string | number, verbosity: number) {
        const rpcGetHashForHeight = async (id: number): Promise<string> => new Promise((resolve) => {
            this.rpc.getBlockHash(id, (err: string, resp: any) => {
                if (err) return resolve("");
                if (!resp) return resolve("");
                return resolve(resp.result);
            });
        });

        const rpcGetBlock = async (id: string, verbosity: number) => new Promise((resolve) => {
            this.rpc.getBlock(id, Math.max(Math.min(verbosity, 2), 0), (err: string, resp: any) => {
                if (err) return resolve(null);
                if (!resp) return resolve(null);
                return resolve(resp.result);
            })
        });

        try {
            if (typeof id === "number") {
                id = await rpcGetHashForHeight(id);
                console.log(id);
                if (id.length === 0) return null;
            }

            const block: any = await rpcGetBlock(id as string, verbosity);
            block.transactions = block.tx.map((transaction: any) => {
                return this.formatRPCTransaction(transaction);
            });
            let lastTx = block.tx[block.tx.length - 1];
            if(lastTx.inputs.length > 1 || lastTx.outputs.length > 1){
                console.log(block?.mweb);
            }
            if (!lastTx.extras)
                lastTx.extras = {};
            lastTx.extras.houseContent = "MWEB Hogex"
            lastTx.extras.mwebhogex = true;
            // console.log(lastTx);


            block.timestamp = Math.floor(block.time);
            block.parentHash = block.previousblockhash;
            delete block.tx;
            delete block.time;
            return block;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    public async resolveBlock(id: string | number, verbosity: number, depth: number): Promise<any> {
        try {
            const block = await this.getBlock(id, verbosity);
            if (!block) return { exists: false };
            if (block.height == null) return { exists: false };
            if (block.parentHash && depth < this.blockDepthLimit)
                await this.resolveBlock(block.parentHash, verbosity, depth + 1);
            return { exists: true, block };
        } catch (error) {
            console.error(error);
            return { exists: false };
        }
    }

    public async getPendingExtras(transaction: any): Promise<any> {
        if (transaction.fee || transaction.fees)
            return { fee: transaction.fee, fees: transaction.fees };

        const getFees = async (id: string) => new Promise((resolve) => {
            this.rpc.getMemPoolEntry(id, (error: string, resp: any) => {
                if (error) return resolve({ fee: false, fees: false });
                if (!resp) return resolve({ fee: false, fees: false });
                return resolve({ fee: resp.result.fee * 100000000, fees: resp.result.fees });
            });
        });

        return await getFees(transaction.hash);
    }

    public isTransaction(data: any): boolean {
        if (!data.hash) return false;
        if (!data.hex) return false;
        return true;
    }

    public isTransactionConfirmed(transaction: any): boolean {
        return transaction.confirmations > 0;
    }

    public isBlock(data: any): boolean {
        if (!data.chain) return false;
        if (!data.hash) return false;
        if (!data.height) return false;
        return true;
    }

    public async getCurrentHeight(): Promise<null | number> {
        const getBlockchainInfo = async () => new Promise((resolve) => {
            this.rpc.getBlockchainInfo((error: string, resp: any) => {
                if (error) return resolve(null);
                return resolve(resp?.result || null);
            });
        });
        const blockchainInfo: any = await getBlockchainInfo();
        if (!blockchainInfo) return null;
        return Number(blockchainInfo?.blocks || 0)
    }
}