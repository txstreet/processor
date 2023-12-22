import fs from 'fs';
import path from 'path';
import { Router } from 'express';

const blockchainRouter = Router();

// Fetch and load all routers declared in the blockchain folders.
// This expects that the folder structure of :chain/index.(ts|js) is followed.
fs.readdirSync(__dirname).filter((filename: string) => {
    const basePath: string = path.join(__dirname, filename);
    if(fs.lstatSync(basePath).isDirectory()) {
        const module: Router = require(basePath).default;
        blockchainRouter.use(`/${filename}`, module);
        console.log(filename); 
    }
});

export default blockchainRouter;