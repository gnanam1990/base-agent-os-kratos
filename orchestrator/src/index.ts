import 'dotenv/config';
import { createClient } from 'redis';
import { ForkPool } from './forkPool';
import { AuditJobSchema } from '@kratos/core';
import { runAudit } from './pipeline';

const STREAM = 'kratos:jobs';
const GROUP = 'orchestrator';
const CONSUMER = process.env.CONSUMER_ID || 'orch-1';

async function main() {
  const r = createClient({ url: process.env.REDIS_URL });
  await r.connect();
  try { await r.xGroupCreate(STREAM, GROUP, '$', { MKSTREAM: true }); } catch {}

  const pool = new ForkPool(parseInt(process.env.MAX_CONCURRENT_FORKS || '4', 10), process.env.BASE_MAINNET_RPC!);
  await pool.warmup();
  console.log('orchestrator started');

  while (true) {
    const reply = await r.xReadGroup(GROUP, CONSUMER, { key: STREAM, id: '>' }, { COUNT: 5, BLOCK: 5000 });
    if (!reply) continue;
    for (const { messages } of reply) {
      for (const m of messages) {
        try {
          const job = AuditJobSchema.parse(JSON.parse(m.message.payload));
          const fork = await pool.acquire();
          try {
            const report = await runAudit(r, fork, job);
            await r.xAdd('kratos:results', '*', { payload: JSON.stringify(report) });
          } finally {
            await pool.release(fork);
            await r.xAck(STREAM, GROUP, m.id);
          }
        } catch (e) {
          console.error('job error', m.id, e);
          await r.xAck(STREAM, GROUP, m.id);
        }
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
