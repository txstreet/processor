import { _implementations } from "./implementation";

export const enabledHooks: any = {
  ARBI: [
    "DefaultHousing",
  ],
  ETH: [
    "Arbitrum",
    "DefaultHousing",
    "Uniswap",
    "Opensea",
    "Sushi"
  ],
  BTC: [
    "DefaultHousing",
  ],
  LTC: [
    "DefaultHousing",
    "MWEB",
    "MWEBPeg",
    "Segwit"
  ],
  BCH: [
    "CashFusion",
    "EatBCH",
    "Memo",
    "SLP"
  ]
};

export const initHooks = async (chain: string) => {
  const hooks = enabledHooks[chain] || [];
  
  console.log(`${chain}: Initializing ${hooks.length} hooks`);

  for (const className of hooks) {
    const implClass = await import(`./${chain}/${className}/index`);

    await implClass.default.init();
  }
};

export default async (chain: string, transaction: any) => {
  let tasks: Promise<boolean>[] = [];
  let implementations = _implementations[chain] || [];
  implementations.forEach((implementation) => {
    tasks.push(new Promise<boolean>(async (resolve) => {
      try {
        let result = await implementation.validate(transaction);
        let executed = false;
        if (result) executed = await implementation.execute(transaction);
        if (result && transaction.blockHash && executed && (implementation as any).confirmed) await (implementation as any).confirmed(transaction);

        return resolve(true);
      } catch (error) {
        console.error(error);

        return resolve(false);
      }
    }))
  })
  await Promise.all(tasks);
};
