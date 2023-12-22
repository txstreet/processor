import axios from 'axios';
import mongodb from '../../../databases/mongodb';
import { CoingeckoTaskResult, CoinLookupTable, WebResponse } from '../global';

export const pricing: { [key: string]: number } = {};

const url = (coin: string): string => 
    `https://api.coingecko.com/api/v3/coins/${coin}?tickers=true&market_data=true&community_data=true&developer_data=true`

const coins: CoinLookupTable = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'LTC': 'litecoin',
    'XMR': 'monero',
    'BCH': 'bitcoin-cash'
}


// Flattens an object into a single-level object with pathway keys. 
function flatten<T extends Record<string, any>>(object: T, path: string | null = null, separator = '.'): T {
    return Object.keys(object).reduce((acc: T, key: string): T => {
      const value = object[key];
      const newPath = Array.isArray(object)
        ? `${path ? path : ''}[${key}]`
        : [path, key].filter(Boolean).join(separator);
      const isObject = [
        typeof value === 'object',
        value !== null,
        !(value instanceof Date),
        !(value instanceof RegExp),
        !(Array.isArray(value) && value.length === 0),
      ].every(Boolean);
  
      return isObject
        ? { ...acc, ...flatten(value, newPath, separator) }
        : { ...acc, [newPath]: value };
    }, {} as T);
  }

// Utility used to update the database, retries failed attempts up to 5 times before
// giving up. 
const updateDatabase = async (ticker: string, updateObject: any, attempt: number = 1): Promise<any> => {
    const { database } = await mongodb(); 
    const collection = database.collection('statistics'); 


    // Flatten the object so that the database updates the correct fields, without using a 
    // key.path.value MongoDB will replace the entire object, instead of the provided values. 
    const $set = flatten(updateObject, null, '-');

    try {
        await collection.updateOne({ chain: ticker }, { $set }); 
        pricing[ticker] = updateObject.fiatPrice.usd;
        if(ticker === 'ETH') {
            await collection.updateOne({ chain: 'RINKEBY' }, { $set }); 
            pricing['RINKEBY'] = updateObject.fiatPrice.usd;
        }
            
    } catch (error) {
        console.error(error);
        return attempt > 5 ? null : updateDatabase(ticker, updateObject, attempt++); 
    }
}

// Export the actual task to be scheduled in src/index.
export default async(): Promise<void> => {
    // Create an array of tasks to execute simultaneously. 
    let tasks: Promise<CoingeckoTaskResult>[] = []; 
    // Iterate over the coins to create tasks for each one. 
    Object.keys(coins).forEach((ticker: string) => {
        // Get the name of the coin from the lookup table. 
        const nameOfCoin: string = coins[ticker];  
        try {
            // Create the task. 
            let task = new Promise<CoingeckoTaskResult>(async (resolve: (value: CoingeckoTaskResult) => void) => {
                try {
                    // Issue a request to the coingecko API. 
                    let { status, data }: WebResponse = await axios.get(url(nameOfCoin)); 
                    // Reject the task using resolve to allow for Promise.all
                    if(status !== 200) {
                        return resolve({ success: false, error: `Status code: ${status}` });
                    }
                    // Successful task. 
                    resolve({ success: true, ticker, name: nameOfCoin, data: data as object }); 
                } catch (error) {
                    // Reject the task using resolve to allow for Promise.all
                    return resolve({ success: false, error: error?.message || error.toString() }); 
                }
            }); 
            tasks.push(task); 
        } catch(error) {
            console.error(error); 
        }
    }); 

    // Wait for all tasks to resolve, try/catch not needed here since the promises never reject. 
    let results: CoingeckoTaskResult[] = await Promise.all(tasks); 

    // Iterate over the results to update database pricing. 
    results.forEach((taskResult: CoingeckoTaskResult) => {
        const { success, error, ticker, name, data  } = taskResult; 
        if(!success) {
            // Task failed, just ignore this iteration. 
            console.error(error); 
            return; 
        }

        // No data? No updates.
        if(data.market_data == "undefined") return; 
        
        // Destructure pricing information from market data.
        let usdPrice = Number(data.market_data.current_price['usd'].toFixed(2)); 
        
        // Destructure supply information from market data.
        let circulatingSupply = data.market_data.circulating_supply; 
        let totalSupply = data.market_data.total_supply; 

        // Create an update object for database mutation.
        let supply: { [key: string]: number } = {}; 
        if(circulatingSupply) supply.circulating  = circulatingSupply;
        if(totalSupply) supply.total = totalSupply;

        // Destructure volume information from market data.
        let totalVolume = data.market_data.total_volume; 

         // Create an update object for database mutation.
        let volume: { [key: string]: number } = {}; 
        if(totalVolume.usd) volume.usd = totalVolume.usd; 
        if(totalVolume.btc) volume.btc = totalVolume.btc; 

        // Destructure market cap information from market data.
        let marketCap = data.market_data.market_cap;

         // Create an update object for database mutation.
        let cap: { [key: string]: number } = {};
        if(marketCap.usd) cap.usd = marketCap.usd; 

        // Create the database update object.
        let updateObj: { [key: string]: any } = {}; 

        // If there's an update to the current price, update that. 
        if(usdPrice > 0) {
            updateObj.fiatPrice = { usd: usdPrice }; 
        }

        // If there's updates to supply, apply them to the object.
        if(Object.keys(supply).length) {
            updateObj.supply = supply; 
        }

        // If there's updates to volume, apply them to the object.
        if(Object.keys(volume).length) {
            updateObj.volume = volume; 
        }

        // If there's updates to market cap, apply them to the object.
        if(Object.keys(cap).length) {
            updateObj.marketCap = cap; 
        }

        // Make sure that there's updates to be made.
        if(Object.keys(updateObj).length) {
            updateDatabase(ticker as string, updateObj);
        }
    }); 
}