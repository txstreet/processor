import dotenv from 'dotenv';
dotenv.config();

import minimist from 'minimist'; 
Object.assign(process.env, minimist(process.argv.slice(2)));

import updateHouseData from '../lib/tasks/jobs/update-house-data';
import updateHousePriority from '../lib/tasks/jobs/update-house-priority';
import updatePricing from '../lib/tasks/jobs/update-pricing';
import ethRemoveBadTxs from '../lib/tasks/jobs/eth-remove-bad-txs'; 
import unlockLockedTxs from '../lib/tasks/jobs/unlock-locked-txs';
import btcRemoveBadTxs from '../lib/tasks/jobs/btc-remove-bad-txs';
import xmrRemoveBadTxs from '../lib/tasks/jobs/xmr-remove-bad-txs';
import btcBlockBroadcast from '../lib/tasks/jobs/btc-block-broadcast';
import xmrBlockBroadcast from '../lib/tasks/jobs/xmr-block-broadcast';
import ethRecentContracts from '../lib/tasks/jobs/eth-recent-contracts';
import { chainConfig } from '../data/chains';
var allowed = Object.keys(chainConfig);
var chains: string[] = []; 

// Check for command line arguments matching that of blockchain implementations 
Object.keys(process.env).forEach(key => {
    if(allowed.includes(key.toUpperCase())) {
        chains.push(key.toUpperCase()); 
    }
})


// Utility for seconds->milliseconds.
const seconds = (amount: number) => amount * 1000; 

// Utility for minutes->milliseconds.
const minutes = (amount: number) => seconds(amount * 60); 

// Utility for hours->milliseconds.
const hours = (amount: number) => minutes(amount * 60); 

// Utility for days->milliseconds.
const days = (amount: number) => hours(amount * 24); 

// Utility for weeks->milliseconds.
const weeks = (amount: number) => days(amount * 7); 

// Utility for months->milliseconds.
// XXX: Slightly innacurate, will not be called on the same day of each month, due to leap years.
const months = (amount: number) => days(amount * (365.25 / 12));

// Utility for years->milliseconds. 
// XXX: Slightly innacurate, will not be called on the same day each year, due to leap years. 
const years = (amount: number) => months(amount * 12); 

// Simple utility method to execute a job continuously every #executionTime 
const executeJob = async (job: () => Promise<void>, executionTime: number, onFinish: boolean = false) => {
    if(onFinish) {
        await job(); 
        setTimeout(() => executeJob(job, executionTime, onFinish), executionTime); 
    } else {
        job(); 
        setTimeout(() => executeJob(job, executionTime), executionTime); 
    }
}


const run = async () => {
    // Update pricing statistics every minute. 
    executeJob(updatePricing, minutes(1));

    chains.forEach((chain: string) => {
        executeJob(() => unlockLockedTxs(chain), seconds(3));
        executeJob(() => {
            switch(chain) {
                case "ETH":
                case "RINKEBY":
                case "ARBI":
                    return;
                case "LTC":
                case "BTC":
                case "BCH":
                    return btcBlockBroadcast(chain);
                case "XMR":
                    return xmrBlockBroadcast(chain); 
            }
            return null; 
        }, 100, true);

        let checkBadTxsInterval = 0;
        switch(chain) {
            case "ARBI":
            case "ETH":
            case "RINKEBY":
                checkBadTxsInterval = 10;
                break; 
            case "LTC":
            case "BCH":
            case "XMR":
                checkBadTxsInterval = 1000;
                break;
            case "BTC":
                checkBadTxsInterval = 1000;
                break;
        }

        executeJob(() => {
            switch(chain) {
                case "ARBI":
                    return;
                case "ETH":
                case "RINKEBY":
                    return ethRemoveBadTxs(chain);
                case "LTC":
                case "BTC":
                case "BCH":
                    return btcRemoveBadTxs(chain);
                case "XMR":
                    return xmrRemoveBadTxs(chain); 
            }
        }, seconds(checkBadTxsInterval));

        updateHouseData(chain, chainConfig[chain].wikiname);
        executeJob(() => updateHousePriority(chain), minutes(1)); 
    });
    

    if(chains.includes('ETH')) {
        executeJob(() => ethRecentContracts('ETH', '5min', Date.now() - minutes(5)), seconds(5)); 
        executeJob(() => ethRecentContracts('ETH',  '1hour', Date.now() - hours(1)), hours(1)); 
        executeJob(() => ethRecentContracts('ETH',  '1day', Date.now() - days(1)), days(1)); 
    }

    setTimeout(() => {
        process.exit(1); 
    }, (1000 * 60) * 10)
}

run();
