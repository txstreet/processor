import dotenv from 'dotenv';
dotenv.config();

import minimist from 'minimist'; 
import ethRecentContracts from './jobs/eth-recent-contracts';
Object.assign(process.env, minimist(process.argv.slice(2)));

const run = async () => {
    ethRecentContracts('ETH', 'test', Date.now() - (1000 * 60) * 5);
}

run();

