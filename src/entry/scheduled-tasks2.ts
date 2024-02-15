// @ts-strict-ignore
import dotenv from 'dotenv';
dotenv.config({});

import DropoutContainer from '../lib/tasks2/containers/Dropout';
import ObtainTransactionsFromDatabase from '../lib/tasks2/tasks/ObtainTransactionsFromDatabase';
import { ProjectedEthereumTransaction, ProjectedEthereumBlock, ProjectedXMRTransaction, ProjectedXMRBlock, ProjectedBTCTransaction, ProjectedBTCBlock } from '../lib/tasks2/types';
import path from 'path';
import { BTCBlocksSchema, BTCTransactionsSchema, ETHBlocksSchema, XMRBlocksSchema, XMRTransactionsSchema } from '../data/schemas';
import ObtainBlocksFromDatabase from '../lib/tasks2/tasks/ObtainBlocksFromDatabase';
import ObtainRollupBlocksFromDatabase from '../lib/tasks2/tasks/ObtainRollupBlocksFromDatabase';
import config from '../lib/utilities/config';
import { startServer as startHealthcheckServer } from '../lib/healthcheck';

const chainToInit: string = config.mustEnabledChain();

// A function used to wrap the initialization instructions of this script in an async/await context. 
const initialize = async () => {
    try {
        console.log("INITIALIZE HAS BEEN CALLED, IS THIS INTENDED?")
        // Create a collection for transactions that lasts one day. 
        const { ETHTransactionsSchema } = require('../data/schemas');
        // Transactions collection
        let transactions: DropoutContainer<any> | null = null;
        // Blocks collection
        let blocks: DropoutContainer<any> | null = null;

        switch (chainToInit) {
            case 'ETH':
                transactions = new DropoutContainer<ProjectedEthereumTransaction>(`transactions-${chainToInit}.bin`, ETHTransactionsSchema, 'hash', ((1000 * 60) * 60) * 1, 'insertedAt', true);
                // Create a collection for blocks that lasts one day.
                blocks = new DropoutContainer<ProjectedEthereumBlock>(`blocks-${chainToInit}.bin`, ETHBlocksSchema, 'hash', ((1000 * 60) * 60) * 24, 'timestamp', false, 250);
                break;
            case 'ARBI':
                transactions = new DropoutContainer<ProjectedEthereumTransaction>(`transactions-${chainToInit}.bin`, ETHTransactionsSchema, 'hash', ((1000 * 60) * 60) * 1, 'insertedAt', true);
                blocks = new DropoutContainer<ProjectedEthereumBlock>(`blocks-${chainToInit}.bin`, ETHBlocksSchema, 'hash', ((1000 * 60) * 60) * 2, 'timestamp', false, 250);
                break;
            case 'XMR':
                transactions = new DropoutContainer<ProjectedXMRTransaction>(`transactions-${chainToInit}.bin`, XMRTransactionsSchema, 'hash', ((1000 * 60) * 60) * 1, 'insertedAt', true);
                // Create a collection for blocks that lasts one day.
                blocks = new DropoutContainer<ProjectedXMRBlock>(`blocks-${chainToInit}.bin`, XMRBlocksSchema, 'hash', ((1000 * 60) * 60) * 24, 'timestamp', false, 250);
                break;
            case 'BTC':
            case 'LTC':
            case 'BCH':
                transactions = new DropoutContainer<ProjectedBTCTransaction>(`transactions-${chainToInit}.bin`, BTCTransactionsSchema, 'hash', ((1000 * 60) * 60) * 1, 'insertedAt', true);
                // Create a collection for blocks that lasts one day.
                blocks = new DropoutContainer<ProjectedBTCBlock>(`blocks-${chainToInit}.bin`, BTCBlocksSchema, 'hash', ((1000 * 60) * 60) * 24, 'timestamp', false, 250);
                break;
        }

        if (chainToInit === 'ARBI') {
            const obtainTask: ObtainRollupBlocksFromDatabase = new ObtainRollupBlocksFromDatabase(chainToInit, blocks, transactions).start(true) as ObtainRollupBlocksFromDatabase;
            obtainTask.waitForFirstCompletion().then(x => {
                blocks.setReady(true);
                transactions.setReady(true);
            });
        }
        else {
            // Create an overlap protected task for obtaining transactions. 
            const obtainTransactionsTask: ObtainTransactionsFromDatabase = new ObtainTransactionsFromDatabase(chainToInit, transactions).start(true) as ObtainTransactionsFromDatabase;
            obtainTransactionsTask.waitForFirstCompletion().then(x => {
                transactions.setReady(true);
            });

            // Create an overlap protected task for obtaining blocks. 
            const obtainBlocksTask: ObtainBlocksFromDatabase = new ObtainBlocksFromDatabase(chainToInit, blocks).start(true) as ObtainBlocksFromDatabase;
            obtainBlocksTask.waitForFirstCompletion().then(x => {
                blocks.setReady(true);
            });
        }
        // Start all workers for the given chain.
        require(path.join(__dirname, '..', 'lib', 'tasks2', 'jobs', chainToInit, 'workers', 'index.js')).default();
        require(path.join(__dirname, '..', 'lib', 'tasks2', 'jobs', 'common', 'workers', 'index.js')).default(chainToInit);
    } catch (error) {
        console.error(error);
    }
}

startHealthcheckServer();
initialize();
