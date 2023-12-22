import BlockchainWrapper from "../base";
const zmq = require('zeromq/v5-compat');
import memcache from '../memcache';
import fetch from 'node-fetch';

export default class XMRWrapper extends BlockchainWrapper {
    public host: string;
    public rpcPort: number;
    public zmqPort: number;
    public sock: any; 

    constructor(host: string, rpcPort:number = 18081, zmqPort: number = 18083) {
        super('XMR'); 
        this.host = host;
        this.rpcPort = rpcPort;
        this.zmqPort = zmqPort; 
    }

    public async rpc(path: string, type: string = "json", body: any = null): Promise<any> {
        const url = `http://${this.host}:${this.rpcPort}/${path}`;
        const options: any = { method: 'POST', headers: { 'Content-Type': 'application/json' } }; 
        if(body) options.body = JSON.stringify(body);
        const result = await fetch(url, options);
        if(type === "text") return result.text();
        return result.json(); 
    }

    public initEventSystem() {
        this.sock = zmq.socket('sub'); 
        this.sock.connect(`tcp://${this.host}:${this.zmqPort}`);
        this.sock.subscribe('json-minimal-txpool_add');
        this.sock.subscribe('json-minimal-chain_main');
        this.sock.on('message', async (topicBuffer: Buffer, messageBuffer: Buffer) => {
            try {
                const topic = topicBuffer.toString('ascii');
                const command = topic.substring(0, topic.indexOf(':')); 
                switch(command) {
                    case 'json-minimal-txpool_add':
                        const parsed = JSON.parse(topic.split('minimal-txpool_add:')[1]); 
                        const id = parsed[0].id; 
                        if(memcache.get(`xmr-tx-${id}`)) return;
                        memcache.put(`xmr-tx-${id}`, 1); 
                        const transaction = await this.getTransaction(parsed[0].id, 0); 
                        this.emit('mempool-tx', transaction); 
                        break;
                    case 'json-minimal-chain_main':
                        const block: any = JSON.parse(topic.split('minimal-chain_main:')[1]); 
                        const hash = block.ids[0]; 
                        if(memcache.get(`xmr-block-${hash}`)) return;
                        memcache.put(`xmr-block-${hash}`, 1); 
                        this.emit('confirmed-block', hash);
                        break; 
                }
            } catch (error) { /*ignore*/ };
        });
    }

    public getTransactionReceipts: undefined;

    public getTransactionReceipt: undefined;

    public getTransactionCount: undefined;

    public async getTransaction(id: string, verbosity: number, blockId?: string | number): Promise<any> {
        try {
            const result = await this.rpc("get_transactions", "json", { txs_hashes: [id], decode_as_json: true }); 
            if(!result || !result.txs || !result.txs[0].tx_hash) return null; 
            const transaction = result.txs[0]; 
            return this._formatTransaction(transaction); 
        } catch (error) {
            console.error(error); 
            console.error(error);
            return null; 
        }
    }

    public async getBlock(id: string | number, verbosity: number): Promise<any> {
        try {
            if(!isNaN(Number(id))) id = Number(id); 
            const params: any = {};
            if(typeof(id) === 'string') params.hash = id;
            if(typeof(id) === 'number') params.height = id; 
            if(Object.keys(params).length === 0) return null; 

            const result = await this.rpc("json_rpc", "json", { jsonrpc: "2.0", id: "0", method: "get_block", params }); 
            if(result && result.result && result.result.status === "OK") {
                return this._formatBlock(result.result);
            }
            return null; 
        } catch (error) {
            console.error(error);
            console.error(error);
            return null;
        }
    }

    public async resolveBlock(id: string | number, verbosity: number, depth: number): Promise<any> {
        try {
            const block = await this.getBlock(id, 0); 
            if(block == null) 
                return { exists: false }; 
            if(block.height == null)
                return { exists: false }
            if(block.previous_block_hash && depth <= 5)
                await this.resolveBlock(block.previous_block_hash, 0, depth + 1); 
            return { exists: true, block };
        } catch (error) {
            console.error(error);
            return { exists: false } 
        }
    }

    public isTransaction(data: any): boolean {
        if(!data.hash) return false;
        if(!data.inputs) return false; 
        return true;
    }

    public isTransactionConfirmed(transaction: any): boolean {
        return transaction.blockHeight > 0;
    }

    public isBlock(data: any): boolean {
        if(!data.hash) return false;
        if(!data.transactions) return false;
        return true;
    }

    _formatBlock(data: any): any {
        const block: any = {};
        block.hash = data.block_header.hash; 
        block.prevHash = data.block_header.prev_hash; 
		block.size = data.block_header.block_size;
		block.weight = data.block_header.block_weight;
		block.difficulty = data.block_header.difficulty;
		block.height = data.block_header.height;
		block.majorVersion = data.block_header.major_version;
		block.minorVersion = data.block_header.minor_version;
		block.minerTxHash = data.block_header.miner_tx_hash;
		block.nonce = data.block_header.nonce;
		block.txs = data.block_header.num_txes;
		block.transactions = data.tx_hashes || [];
		block.orphanStatus = data.block_header.orphan_status;
		block.reward = data.block_header.reward;
		block.timestamp = Math.floor(data.block_header.timestamp);
        return block;
    }

    _formatTransaction(data: any): any {
        var transaction: any = {}; 
        let tx_json = JSON.parse(data.tx_json || data.as_json);
        transaction.hash = data.id_hash || data.tx_hash;
        transaction.blockHeight = data.block_height;
        transaction.inputs = tx_json.vin;
        transaction.outputs = tx_json.vout;
        transaction.extra = tx_json.extra;
        transaction.rctSignatures = tx_json.rct_signatures;
        transaction.fee = data.fee || (tx_json.rct_signatures ? tx_json.rct_signatures.txnFee : false) || 0;
        transaction.size = data.blob_size || data.as_hex.length / 2;
        transaction.weight = data.weight || 0;
        transaction.version = tx_json.version;
        transaction.receivedTimestamp = data.received_timestamp || data.receive_time || data.block_timestamp;
        transaction.timestamp = Date.now() / 1000;
        transaction.extras = {};
        transaction.pub = null;
        transaction.paymentId = null;
        transaction = this._parseExtra(transaction);
        return transaction;
    }

    _bintohex(bin: any): any {
        var out = [];
        for (var i = 0; i < bin.length; ++i) {
            out.push(("0" + bin[i].toString(16)).slice(-2));
        }
        return out.join("");
    }

    _parseExtra(transaction: any): any {
        const bin = transaction.extra;
        if (bin[0] === 1){ //pubkey is tag 1
            transaction.pub = this._bintohex(bin.slice(1, 33)); //pubkey is 32 bytes
            if (bin[33] === 2 && bin[35] === 0 || bin[35] === 1){
                transaction.paymentId = this._bintohex(bin.slice(36, 36 + bin[34] - 1));
            }
        } else if (bin[0] === 2){
            if (bin[2] === 0 || bin[2] === 1){
                transaction.paymentId = this._bintohex(bin.slice(3, 3 + bin[1] - 1));
            }
            //second byte of nonce is nonce payload length; payload length + nonce tag byte + payload length byte should be the location of the pubkey tag
            if (bin[2 + bin[1]] === 1){
                var offset = 2 + bin[1];
                transaction.pub = this._bintohex(bin.slice(offset + 1, offset + 1 + 32));
            }
        }
        return transaction;
    }

    public async getCurrentHeight(): Promise<null | number> {
        try {
            const result = await this.rpc("json_rpc", "json", { jsonrpc: "2.0", id: "0", method: "get_last_block_header" }); 
            if(result && result.result && result.result.status === "OK") {
                return Number(result?.result?.block_header?.height || 0);
            }
            return null; 
        } catch (error) {
            console.error(error);
            console.error(error);
            return null;
        }
    }

}