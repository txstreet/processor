import { Router } from 'express';
import blockchainRouter from './blockchain';
import nftRouter from "./nft";

const apiRouter = Router();
apiRouter.use('/blockchain', blockchainRouter);
apiRouter.use('/nft', nftRouter);

export default apiRouter;