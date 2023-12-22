import EventEmitter from 'eventemitter3';

export default abstract class BlockchainWrapper extends EventEmitter {
    // The market-ticker for the blockchain's main currency.
    public ticker: string;

    // The amount of depth (in blocks) that a single request can fulfill.
    public blockDepthLimit: number = 5;

    /**
     * Initializes a new BlockchainWrapper.
     * 
     * @param ticker The market-ticker for the blockchain's main currency. 
     */
    constructor(ticker: string) {
        super();
        this.ticker = ticker.toUpperCase();
    }

    /**
     * Initializes any blockchain specific event systems for obtaining pending transaction data
     * from the mempool and newly confirmed blocks. 
     */
    public abstract initEventSystem(): any;

    /**
    * Obtains array of transaction receipts.
    * 
    * @param block The block object with hash or id.
    */
    public abstract getTransactionReceipts?(block: any): any;

    /**
    * Obtains array of transaction receipts.
    * 
    * @param block The block object with hash or id.
    */
     public abstract getTransactionReceipt?(hash: string): any;

    /**
     * Obtains a transaction from the node with varying levels of information based on the vebosity.
     * 
     * @param id The id of the transaction, usually represented by a hash.
     * @param verbosity The level of data requested for the transaction, higher is more.
     * @param blockId The block number or hash that this transaciton is in, if known. 
     */
    public abstract getTransaction(id: string, verbosity: number, blockId?: string | number): any;

    /**
     * Obtains a block from the node with varying levels of information based on the verbosity.
     * 
     * @param id The id of the block, usually a height or hash.
     * @param verbosity The level of data requested for the block, higher is more.
     */
    public abstract getBlock(id: string | number, verbosity: number): any;

    /**
     * Resolves a block, returning all data associated with this block as well as ensuring that
     * all related blocks are processed within the depth limit.
     * 
     * @param id The height or hash of the block.
     * @param verbosity The level of data requested for the block, higher is more.
     * @param depth The current depth of the request. (How many times this request has been called from a single function call)
     */
    public abstract resolveBlock(id: string | number, verbosity: number, epth: number): Promise<any>;

    /**
     * Gets the number of transactions sent by this account/address.
     * 
     * @param account The account/address.
     */
    public abstract getTransactionCount(account: string): Promise<number>;

    /**
     * Determines rather or not the supplied data represents that of a transaction.
     * 
     * @param data The data.
     */
    public abstract isTransaction(data: any): boolean;

    /**
     * Determines rather or not a transaction has been confirmed by using transaction-properties 
     * supplied by the node request.
     * 
     * @param transaction The transaction data.  
     */
    public abstract isTransactionConfirmed(transaction: any): boolean;

    /**
     * Determines rather or not the supplied data represents that or a block.
     * 
     * @param data The data.
     */
    public abstract isBlock(data: any): boolean;

    /**
     * Gets the current block height from the node
     */
    public abstract getCurrentHeight(): Promise<null | number>;
}