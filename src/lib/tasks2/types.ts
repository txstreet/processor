export interface ProjectedEthereumTransaction {
    hash: string;
    from: string;
    insertedAt: number;
    timestamp: number;
    gas: number;
    value: number;
    gasPrice: number | undefined; 
    maxFeePerGas: number | undefined;
    maxPriorityFeePerGas: number | undefined;
    gasUsed?: number | undefined;
    dropped: boolean | undefined;
    processed: boolean;
    extras?: any;
    pExtras?: any;
}

export interface ProjectedEthereumBlock {
    chain: string;
    hash: string;
    baseFeePerGas: number | undefined; 
    gasUsed: number | undefined; 
    gasLimit: number | undefined;
    difficulty: string; 
    size: number;
    height: number;
    timestamp: number;
    gasUsedDif: number;
    transactions: number;
}

export interface ProjectedXMRTransaction {
    hash: string;
    insertedAt: number;
    timestamp: number;
    dropped: boolean | undefined;
    processed: boolean;
    fee: number;
    size: number;
    extras?: any;
    pExtras?: any;
}

export interface ProjectedXMRBlock {
    chain: string;
    hash: string;
    timestamp: number;
    height: number; 
    difficulty: number;
    transactions: number;
    size: number;
}

export interface ProjectedBTCTransaction {
    chain: string;
    hash: string;
    insertedAt: number;
    timestamp: number; 
    dropped: boolean | undefined;
    processed: boolean; 
    fee: number;
    size: number; 
    rsize: number; 
    extras?: any;
    pExtras?: any;
}

export interface ProjectedBTCBlock {
    hash: string;
    chain: string;
    timestamp: number;
    height: number;
    difficulty: number;
    transactions: number;
    size: number; 
}
