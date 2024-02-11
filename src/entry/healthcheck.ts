import { checkAll } from '../lib/healthcheck';

(async () => {
  const ok = await checkAll();

  process.exit(ok ? 0 : 1);
})();
