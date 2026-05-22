import 'dotenv/config';
import { createClient } from 'redis';
import { ethers } from 'ethers';

interface MonitorEntry {
  target_address: string;
  callback_url?: string;
  subscribed_at: number;
  expires_at: number;
}

async function main() {
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();

  const provider = new ethers.WebSocketProvider(
    process.env.BASE_WS_RPC || 'wss://mainnet.base.org'
  );

  console.log('Block watcher started');

  provider.on('block', async (blockNumber) => {
    try {
      const monitors = await redis.hGetAll('kratos:monitors');
      const now = Math.floor(Date.now() / 1000);

      for (const [target, data] of Object.entries(monitors)) {
        const monitor: MonitorEntry = JSON.parse(data);

        if (monitor.expires_at < now) {
          await redis.hDel('kratos:monitors', target);
          continue;
        }

        const code = await provider.getCode(target);
        if (code === '0x') {
          console.log(`Target ${target} has no code, skipping`);
          continue;
        }

        await redis.xAdd('kratos:jobs', '*', {
          payload: JSON.stringify({
            job_id: `monitor-${blockNumber}-${target.slice(0, 8)}`,
            source: target,
            contract_name: 'Monitored',
            tier: 'fast',
            requester: 'monitor',
            payment_receipt: '',
            created_at: now,
          }),
        });
      }
    } catch (e) {
      console.error('Block watcher error:', e);
    }
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
