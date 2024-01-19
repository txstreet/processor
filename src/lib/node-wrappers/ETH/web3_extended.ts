import Web3 from 'web3';
import Eth from 'web3-eth';

interface Web3Geth extends Web3 {
  eth: EthGeth;
}

interface EthGeth extends Eth {
  txpool: TxpoolGeth;
};

interface TxpoolGeth {
  status(): Promise<TxpoolStatus>;
};

// https://geth.ethereum.org/docs/interacting-with-geth/rpc/ns-txpool#txpool-status
type TxpoolStatus = {
  pending: string; // Hex
  queued: string; // Hex
};

interface Web3Besu extends Web3 {
  eth: EthBesu;
}

interface EthBesu extends Eth {
  txpool: TxpoolBesu;
};

interface TxpoolBesu {
  besuStatistics(): Promise<BesuStatistics>;
};

// https://besu.hyperledger.org/public-networks/reference/api#txpool_besustatistics
type BesuStatistics = {
  maxSize: number;
  localCount: number;
  remoteCount: number;
};

export {
  Web3Geth,
  Web3Besu,
};
