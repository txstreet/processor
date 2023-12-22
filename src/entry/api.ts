import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors, { CorsOptions } from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import apiRouter from '../lib/api';
import staticRouter from '../lib/api/static';

// Configure credd-origin-resource-sharing.
const whitelist: string[] = ['localhost', 'txstreet.com'];
const CORSConfig: CorsOptions = {
    origin: '*' 
};

/* =====================
 (origin: string, callback: any) => {
        if(whitelist.includes(origin))
            return callback(null, true);
         return callback(new Error(`Request from ${origin} was blocked by CORS.`));
    }
 ======================= */

// Initialize the express application & setup middleware.
const app: express.Application = express();
app.use(helmet());
app.use(express.json());
app.use(compression());
app.use(cors({ origin: '*'}));

app.get('/healthcheck', (request: any, response: any) => {
    response.status(200).send('OK'); 
});

// Create & assign the default router.
const router: express.Router = express.Router();
router.use('/', apiRouter);
app.use('/api/v2', router);
app.use('/static', staticRouter); 

// Begin listening.
console.log('Start listening');
app.listen(process.env.API_PORT, (): any => {
    return console.log(`Server listening on port: ${process.env.API_PORT}`);
});
