import config from './utilities/config';
import axios from 'axios';

type checkFn = () => Promise<void>;

const checkAll = async (): Promise<boolean> => {
  const checks: {[key: string]: checkFn} = {
    "bulk-eth-api": checkBulkEthApi,
    "mongodb": checkMongodb,
  };
  
  const results: {[key: string]: checkResult} = {};
  for (const [name, fn] of Object.entries(checks)) {
    const result = await check(name, (fn as checkFn));
    results[name] = result;

    printResult(name, result);
  }

  let finalResult: boolean = true;
  for (const [name, result] of Object.entries(results)) {
    finalResult = finalResult && result.ok;

    if (result.err) {
      console.error("");
      printError(name, result.err);
    }
  }

  return finalResult;
};

type checkResult = {
  ok:         boolean;
  status:     string;
  err:        Error | null;
  durationMs: number;
};

const printResult = (name: string, result: checkResult): void => {
  let message = (result.ok ? "[OK]" : " !! ") +
    ` Health of ${name}: ${result.status} (in ${result.durationMs} ms)`;

  console[result.ok ? "log" : "error"](message);
}

const printError = (name: string, err: Error): void => {
  console.error(`Error for ${name}:`);
  console.error(err);
}

const check = async (name: string, fn: checkFn): Promise<checkResult> => {
  const t0 = new Date().valueOf();
  const buildResult = (ok: boolean, status: string, err: Error | null): checkResult => {
    const durationMs = (new Date().valueOf()) - t0;

    return {ok, status, err, durationMs};
  };

  try {
    await fn();
  } catch (err) {
    return buildResult(false, `FAILURE: ${err}`, err);
  }

  return buildResult(true, "OK", null);
};

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
  throw new Error("test");
};

const handleRequest = async (request: any, response: any) => {
  response.status(200).send('OK'); 
};

export {
  handleRequest,
  checkAll,
}
