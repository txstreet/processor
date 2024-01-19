import { ETHWrapper, ETHBesuWrapper } from '../../../lib/node-wrappers/ETH';

describe("ETHWrapper", () => {
  describe("#mempoolSize", () => {
    it("sums pending and queued counts", async () => {
      const wrapper = new ETHWrapper("ws://vpn-es:8546");

      const size = await wrapper.mempoolSize();
      console.log({size});

      await wrapper.stop();
    });
  });
});

describe("ETHBesuWrapper", () => {
  describe("#mempoolSize", () => {
    it("sums local and remote counts", async () => {
      const wrapper = new ETHBesuWrapper("ws://vpn-pia:8546");

      const size = await wrapper.mempoolSize();
      console.log({size});

      await wrapper.stop();
    });
  });
});
