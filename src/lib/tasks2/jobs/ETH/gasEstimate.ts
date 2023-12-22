import fs from 'fs';
import path from 'path';

var baseFee = 0; 
var currentHeight = 0; 
var gasDif = 0; 
var gasLimit = 0;
var lowBlockGas = 0;

let ignoreFeesFromHashes: any = {}; //for txs fitted into end of blocks, ignore their fee for calculation

/**
 * Generate estimates of fees for next blocks
 * Right now it is just based on mempool, so blocks after the first will be lower and inaccurate,
 * but it can be updated to simulate future projections based on gas throughput
 */
async function go() {
  const _path = path.join(__dirname, '..', '..', '..', '..', 'data', 'ETH-pendingTransactions.json');
  const _result = fs.readFileSync(_path).toString('utf-8'); 
  const result = JSON.parse(_result);
  // const list: any = [...result];

  const list: any = [...result].reverse();
  // const list = result.sort((a: any, b: any) => getGp(a) - getGp(b));
  ignoreFeesFromHashes = {};
  const blocks = generateBlocks(list);
  const final = finalizeBlocks(blocks);
  return final;
}

function getModSize(entry: any) {
  return Number(entry.g > 42000 ? entry.g * gasDif : entry.g);
}

function getGp(entry: any) {
  return (entry.mfpg || entry.gp || 0) / 1000000000;
}

function getFittingTxs(list: any[], block: any, start: number) {
  let spaceRemaining = gasLimit - block.gasUsed;
  let txs: any = [];
  for (let i = start - 1; i >= 0; i--) {
    if (spaceRemaining < 21000) break; //TODO replace 21000 based on coin
    let entry: any = list[i];
    if (getGp(entry) < baseFee) continue;

    const modSize = getModSize(entry);
    if (modSize < spaceRemaining) {
      //it fits!
      spaceRemaining -= modSize;
      ignoreFeesFromHashes[entry.tx] = true;
      txs.push(entry);
    }
  }
  return txs;
}

function calcBaseFee(prevBaseFee: number, used: number, limit: number) {
  const elasticity = 2;
  const denominator = 8;
  const target = limit / elasticity;
  let baseFee = prevBaseFee;
  if (used > target) {
    const usedDelta = used - target;
    const baseDelta = Math.max(
        prevBaseFee * usedDelta / target / denominator,
      1
    );
    baseFee = prevBaseFee + baseDelta;
  } else if (used < target) {
    const usedDelta = target - used;
    const baseDelta = prevBaseFee * usedDelta / target / denominator;
    baseFee = prevBaseFee - baseDelta;
  }
  return baseFee;
}

function generateBlocks(list: any[]): any {
  const blocksGenerate = 3;
  const blocks: any = [];

  for (let blockIndex = 0; blockIndex < blocksGenerate; blockIndex++) {
    if (blockIndex > 0)
      baseFee = calcBaseFee(baseFee, blocks[blockIndex - 1].gasUsed, gasLimit);
    blocks[blockIndex] = {
      height: currentHeight + blockIndex + 1,
      baseFee: parseFloat(baseFee.toFixed(2)),
      minMpfpg: 1000000000,
      txArray: [],
      gasUsed: 0,
    };
    const block = blocks[blockIndex];
    for (let i = list.length - 1; i >= 0; i--) {
      const entry: any = list[i];
      const modSize = getModSize(entry);
      if (block.gasUsed + modSize > gasLimit) {
        let fittedTxs = getFittingTxs(list, block, i + 1);
        for (let j = 0; j < fittedTxs.length; j++) {
          const fittedTx: any = fittedTxs[j];
          const fittedModSize = getModSize(fittedTx);
          block.txArray.push(fittedTx);
          block.gasUsed += fittedModSize;
          list.splice(list.indexOf(fittedTx), 1);
        }
        break;
      }

      if (getGp(entry) < baseFee) continue;
      block.txArray.push(entry);
      block.gasUsed += modSize;
      list.splice(i, 1);
      block.gasUsed = parseInt(Math.min(block.gasUsed, gasLimit).toString());
    }
  }
  return blocks;
}

function finalizeBlocks(blocks: any[]) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const tips = [];
    for (let j = 0; j < block.txArray.length; j++) {
      const tx = block.txArray[j];
      if (ignoreFeesFromHashes[tx.tx]) continue;
      let tip = getGp(tx) - block.baseFee;
      if (tx.mpfpg && tip > Number(tx.mpfpg / 1000000000))
        tip = Number(tx.mpfpg / 1000000000);
      tips.push(tip);
    }
    tips.sort(function (a, b) {
      return a - b;
    });
    let targetTipIndex = Math.floor(tips.length * 0.05);
    if (block.gasUsed < lowBlockGas) targetTipIndex = 0;
    // let targetTipIndex = 0;
    const highTipIndex = Math.floor(tips.length * 0.6);
    block.minMpfpg = Math.round(Math.max(Number(tips.length && tips[targetTipIndex]
      ? tips[targetTipIndex]
      : 1), 1));
    if (block.gasUsed < lowBlockGas && block.minMpfpg > 1) block.minMpfpg = 1;
    const actualHigh = Math.max(Number(tips.length && tips[highTipIndex]
      ? tips[highTipIndex]
      : 2), 2);
    block.highMpfpg = Math.round(Math.min(block.minMpfpg * 10, actualHigh));
    // block.highMpfpg = Math.round(actualHigh);

    block.txCount = block.txArray.length;
    //recommended max priority fee
    const recTipIndex = Math.floor((targetTipIndex + highTipIndex) / 2);
    block.recMpfpg = Math.max(Number(tips.length && tips[recTipIndex]
      ? tips[recTipIndex]
      : block.minMpfpg+1), 2);

    if (block.gasUsed < lowBlockGas)
      block.recMpfpg = Math.max(block.minMpfpg, 1);
    if (block.recMpfpg > block.highMpfpg)
      block.highMpfpg = Math.max(block.recMpfpg, 2);
    if (block.recMpfpg < block.minMpfpg)
      block.recMpfpg = Math.max(block.minMpfpg, 1);
    if(block.highMpfpg === block.recMpfpg)
      block.highMpfpg++;


    //recommended max fee
    block.recMfpg = Math.ceil((block.baseFee + block.highMpfpg) * 1.5);
    block.baseFee = parseFloat(block.baseFee.toFixed(2));
    delete block.txArray;
  }
  return blocks;
}

export default async (_baseFee: number, _currentHeight: number, _gasDif: number, _gasLimit: number) => {
    baseFee = _baseFee / 1000000000;
    currentHeight = _currentHeight;
    gasDif = _gasDif / 100;
    gasLimit = _gasLimit; 
    lowBlockGas = _gasLimit * 0.7;


    return await go(); 
}