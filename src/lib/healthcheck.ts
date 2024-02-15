import config from './utilities/config';
import axios from 'axios';
import mongodb from '../databases/mongodb';
import { clients as redisClients } from '../databases/redisEvents';
import { RedisClient } from 'redis';
import Express, { Request, Response } from 'express';
import minimist from 'minimist';

type checkFn = () => Promise<void>;
type checksMap = {[key: string]: checkFn};

const toCheck = (): checksMap => {
  return {
    ...baseChecks(),
    ...chainsChecks(),
  };
};

const baseChecks = (): checksMap => {
  return {
    "mongodb":          checkMongodb,
    // "mongodb":          checkFail,
    "redis-subscriber": redisChecker("subscriber"),
    "redis-publisher":  redisChecker("publisher"),
  };
};

const chainsChecks = (): checksMap => {
  const all: {[key: string]: checksMap} = {
    "ETH": {
      "bulk-eth-api": checkBulkEthApi,
      "eth-node": checkEthNode,
    },
    // "BTC": {
    //   "btc-node": checkBtcNode,
    // },
    // "LTC": {
    //   "ltc-node": checkLtcNode,
    // },
    // "XMR": {
    //   "xmr-node": checkXmrNode,
    // },
  }

  const chains = config.enabledChains();

  let map: checksMap = {};
  for (const chain of chains) {
    if (!(chain in all)) continue;

    map = { ...map, ...all[chain] };
  }

  return map;
};

const checkEthNode = async (): Promise<void> => {
  const wrapper = config.initEthWrapper();

  await wrapper.mempoolSize();
};

const checkAll = async (): Promise<CheckResultAggregate> => {
  const checks: checksMap = toCheck();

  const results: checkResultMap = {};
  for (const [name, fn] of Object.entries(checks)) {
    const result = await check(name, (fn as checkFn));
    results[name] = result;
  }

  return new CheckResultAggregate(results);
};

type checkResult = {
  ok:         boolean;
  status:     string;
  err:        Error | null;
  durationMs: number;
};

type checkResultAsJson = {
  ok:         boolean;
  status:     string;
  err:        errorAsJson | null;
  durationMs: number;
};

type errorAsJson = {
  class:   string;
  message: string;
  stack:   string[];
};

function checkResultAsJson(result: checkResult): checkResultAsJson {
  return {
    ok:         result.ok,
    status:     result.status,
    err:        result.err ? errorAsJson(result.err as Error) : null,
    durationMs: result.durationMs,
  };
};

function errorAsJson(err: Error): errorAsJson {
  return {
    class:   err.constructor.name,
    message: err.message,
    stack:   err.stack ? err.stack.split("\n") : [],
  };
};

const check = async (name: string, fn: checkFn): Promise<checkResult> => {
  const t0 = new Date().valueOf();

  const buildResult =
    (ok: boolean, status: string, err: Error | null): checkResult => {
      const durationMs = (new Date().valueOf()) - t0;

      return {ok, status, err, durationMs};
    };

  try {
    await fn();
  } catch (err) {
    return buildResult(false, `FAILURE: ${err}`, err as Error);
  }

  return buildResult(true, "OK", null);
};

type checkResultMap = {[key: string]: checkResult};
type checkResultAggregateAsJson = {[key: string]: checkResultAsJson};

class CheckResultAggregate {
  private results: checkResultMap;

  constructor(results: checkResultMap) {
    this.results = results;
  }

  public ok(): boolean {
    for (const result of Object.values(this.results)) {
      if (!result.ok) {
        return false;
      }
    }

    return true;
  }

  public logErrors(): void {
    for (const [name, result] of Object.entries(this.results)) {
      if (result.err) {
        console.error(`Error for healthcheck "${name}":`, result.err);
      }
    }
  }

  public asJson(): checkResultAggregateAsJson {
    const obj: checkResultAggregateAsJson = {};

    for (const [name, result] of Object.entries(this.results)) {
      obj[name] = checkResultAsJson(result);
    }

    return obj;
  }
}

const checkBulkEthApi = async () => {
  const response = await axios.get(`${config.ethBulkUrl}/ping`)

  if (response.status !== 200) {
    throw `bulk-eth-api returned an unexpected status: ${response.status}`;
  }

  if (response.data !== "Pong\n") {
    throw(
      `bulk-eth-api returned an response body: ${JSON.stringify(response.data)}`
    );
  }
};

const checkMongodb = async() => {
  const { database } = await mongodb();
  const result = await database.command({ ping: 1 });

  if (result.ok !== 1) {
    throw new Error(`Unexpected ping result: ${result}`);
  }
};

const redisChecker = (clientName: string): checkFn => {
  const client: RedisClient = getRedisClient(clientName);

  return (): Promise<void> => {
    return checkRedis(client);
  };
}

const getRedisClient = (name: string): RedisClient => {
  switch (name) {
    case "publisher":
      return redisClients.publisher;
    case "subscriber":
      return redisClients.subscriber;
  }

  throw new Error(`Unknown Redis client: ${name}`);
};

const checkRedis = async (client: RedisClient): Promise<void> => {
  const ok = await client.ping();

  if (!ok) throw new Error(`Ping didn't retun true`);
};

const checkFail = async (): Promise<void> => {
  throw new Error(`Dummy failure`);
}

const handleHealthcheck = async (request: Request, response: Response) => {
  const aggregate = await checkAll();
  const status    = aggregate.ok() ? 200 : 503;
  const body      = aggregate.asJson();

  aggregate.logErrors();

  response.status(status).json(body);
}

const startServer = () => {
  const port   = config.mustHealthcheckPort();
  const app    = Express();

  app.get('/healthcheck', handleHealthcheck);

  app.listen(port, (): any => {
    console.log(`Healthcheck server listening on port: ${port}`);
  });
}

export {
  handleHealthcheck,
  startServer,
}
