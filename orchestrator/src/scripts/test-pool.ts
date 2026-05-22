import { ForkPool } from '../forkPool';

async function main() {
  const pool = new ForkPool(2, process.env.BASE_MAINNET_RPC!);
  await pool.warmup();
  console.log('warmup done');

  const a = await pool.acquire();
  console.log('acquired', a.port);
  const b = await pool.acquire();
  console.log('acquired', b.port);

  await pool.release(a);
  const c = await pool.acquire();
  console.log('re-acquired', c.port);

  await pool.shutdown();
}
main();
