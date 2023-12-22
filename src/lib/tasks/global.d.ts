export interface WebResponse {
    status: number;
    data: string | any; 
}

export interface CoinLookupTable  {
    [key: string]: string;
}

export interface CoingeckoMarketDataResponse {

}

export interface CoingeckoTaskResult {
    success: boolean;
    error?: string; 
    ticker?: string;
    name?: string;
    data?: any;
}