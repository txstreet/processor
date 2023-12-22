import ChainImplementation from '../../implementation';
// @ts-ignore-line
import abiDecoder from "abi-decoder";
import fetch from "node-fetch";

import contract_0x7be8076f4ea4a4ad08075c2508e481d6c946d12b from "./0x7be8076f4ea4a4ad08075c2508e481d6c946d12b.json";
import contract_0x7f268357a8c2552623316e2562d90e642bb538e5 from "./0x7f268357a8c2552623316e2562d90e642bb538e5.json";

import mongodb from '../../../../databases/mongodb'; 

class Opensea extends ChainImplementation {
  public addresses: string[] = [];
  public nftList: any = {}; //TODO cache in db

  async fetchContract(address: string): Promise<any> {
    // console.log('test');
    if (this.nftList[address]) return this.nftList[address];
    const url = "https://api.opensea.io/api/v1/asset_contract/" + address;
    try {
      const response = await fetch(url, {
        headers: { 'X-API-KEY': process.env.OPENSEA_KEY }
      });
      // const body = await response.text();
      // console.log(body);
      const data: any = await response.json();
      if (!data.collection) return {};
      this.nftList[address] = data;
      return data;
    } catch (error) {
      console.error(error);
      return {};
    }
  }

  async formatSale(transaction: any, decoded: any, type: number = 1) {
    // if(type > 1) console.log("0x" + String(decoded.params[3].value).substring(162, 202));
    const nftAddr = type === 1 ? decoded.params[0].value[4] : "0x" + String(decoded.params[3].value).substring(162, 202); //bundle?
    const to = decoded.params[0].value[1]; //always true
    const from = decoded.params[0].value[decoded.params[0].value[2] === "0x0000000000000000000000000000000000000000" ? 8 : 2]; //8 if accepting offer?
    let tokenAmount = decoded.params[1].value[4];
    const tokenAddr = decoded.params[0].value[6];
    let token = "ETH";
    if (tokenAddr !== "0x0000000000000000000000000000000000000000" && tokenAddr !== "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") {
      //TODO get custom token and divide decimals
      tokenAmount = "?"; //0.1
      token = "?"; //ETH
    } else {
      tokenAmount /= 1000000000000000000;
    }

    const details = await this.fetchContract(nftAddr);
    transaction.extras.opensea = {
      type: "trade",
      token: nftAddr,
      to,
      from,
      tokenAmount,
      tokenAddr, //TODO add token symbol
      slug: details?.collection?.slug || null,
      symbol: details?.symbol || null,
      img: details?.image_url || null,
    };

    let parts = [
      transaction.extras.opensea.symbol
        ? transaction.extras.opensea.symbol + " NFT"
        : "NFT",
      tokenAmount + " " + token,
    ];
    let message = "";

    if (transaction.from === from) {
      //start with nft
      message = parts[0] + " ➞ " + parts[1];
    } else {
      //start with amount
      message = parts[1] + " ➞ " + parts[0];
    }
    transaction.extras.houseContent = message;
  }

  async formatCancel(transaction: any, decoded: any) {
    const nftAddr = decoded.params[0].value[4];
    const details = await this.fetchContract(nftAddr);

    let tokenAmount = decoded.params[1].value[4];
    const tokenAddr = decoded.params[0].value[6];
    let token = "ETH";
    if (tokenAddr !== "0x0000000000000000000000000000000000000000") {
      //TODO get custom token
      token = "CUS";
    } else {
      tokenAmount /= 1000000000000000000;
    }

    //TODO get side (cancel offer or listing)
    transaction.extras.opensea = {
      type: "cancel",
      token: nftAddr,
      tokenAmount,
      tokenAddr, //TODO add token symbol
      slug: details?.collection?.slug || null,
      symbol: details?.symbol || null,
      img: details?.image_url || null,
    };

    transaction.extras.houseContent =
      "Cancel " +
      (transaction.extras.opensea.symbol
        ? transaction.extras.opensea.symbol + " NFT"
        : "NFT") +
      " Order";
  }

  async init(): Promise<ChainImplementation> {
    try {
      if (process.env.USE_DATABASE !== "false") {
        const { database } = await mongodb();
        const collection = database.collection("houses");
        const result = await collection.findOne({
          chain: this.chain,
          name: "opensea",
        });
        for (let i = 0; i < result.contracts.length; i++) {
          result.contracts[i] = result.contracts[i].toLowerCase();
        }
        this.addresses = result.contracts;
        console.log('Addresses for opensea:', this.addresses);
      }

      abiDecoder.addABI(contract_0x7be8076f4ea4a4ad08075c2508e481d6c946d12b);
      abiDecoder.addABI(contract_0x7f268357a8c2552623316e2562d90e642bb538e5);

      console.log("initialized opensea");
    } catch (error) {
      console.error(error);
    } finally {
      return this;
    }
  }

  async validate(transaction: any): Promise<boolean> {
    //Needed to test locally without db
    // return(transaction.to === '0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b'.toLowerCase());
    return this.addresses.includes(transaction.to.toLowerCase());
  }

  async execute(transaction: any): Promise<boolean> {
    if (transaction.house === 'opensea')
      return true;
    transaction.house = 'opensea';

    const to = transaction.to.toLowerCase();
    if (to === '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b' || to === '0x7f268357a8c2552623316e2562d90e642bb538e5') {
      if (!transaction.extras)
        transaction.extras = { showBubble: false };

      const decoded = abiDecoder.decodeMethod(transaction.input);
      switch (decoded.name) {
        case 'atomicMatch_':
          try { await this.formatSale(transaction, decoded, to === '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b'?1:2); } catch (error) { console.error(error); }
          break;
        case 'cacncelOrder_':
          try { await this.formatCancel(transaction, decoded); } catch (error) { console.error(error); }
          break;
      }
    }
    return true;
  }
}

export default new Opensea("ETH");