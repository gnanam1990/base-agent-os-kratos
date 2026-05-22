import 'dotenv/config';
import { Hono } from 'hono';
import { paymentMiddleware } from 'x402-hono';
import { createClient } from 'redis';
import { randomUUID } from 'crypto';

const app = new Hono();

const payeeAddress = process.env.AGENT_WALLET as `0x${string}`;

app.use('*', paymentMiddleware(
  payeeAddress,
  {
    '/api/scan/fast': '$50',
    '/api/scan/standard': '$200',
    '/api/scan/deep': '$500',
    '/api/monitor': '$1000',
  }
));

app.get('/health', (c) => {
  return c.json({ status: 'ok', agent: 'kratos', version: '0.1.0' });
});

app.get('/openapi.json', (c) => {
  return c.json({
    openapi: '3.0.0',
    info: { title: 'Kratos API', version: '0.1.0' },
    paths: {
      '/api/scan/fast': { post: { summary: 'Fast scan ($50)' } },
      '/api/scan/standard': { post: { summary: 'Standard scan ($200)' } },
      '/api/scan/deep': { post: { summary: 'Deep scan ($500)' } },
      '/api/monitor': { post: { summary: 'Monitor subscription ($1000/mo)' } },
    },
  });
});

app.post('/api/scan/fast', async (c) => {
  const body = await c.req.json();
  const jobId = randomUUID();
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  await redis.xAdd('kratos:jobs', '*', {
    payload: JSON.stringify({
      job_id: jobId,
      source: body.source,
      contract_name: body.contract_name || 'Target',
      tier: 'fast',
      requester: body.requester || 'api',
      payment_receipt: c.req.header('x-payment-receipt') || '',
      created_at: Math.floor(Date.now() / 1000),
    }),
  });
  await redis.quit();
  return c.json({ job_id: jobId, status: 'queued' });
});

app.post('/api/scan/standard', async (c) => {
  const body = await c.req.json();
  const jobId = randomUUID();
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  await redis.xAdd('kratos:jobs', '*', {
    payload: JSON.stringify({
      job_id: jobId,
      source: body.source,
      contract_name: body.contract_name || 'Target',
      tier: 'standard',
      requester: body.requester || 'api',
      payment_receipt: c.req.header('x-payment-receipt') || '',
      created_at: Math.floor(Date.now() / 1000),
    }),
  });
  await redis.quit();
  return c.json({ job_id: jobId, status: 'queued' });
});

app.post('/api/scan/deep', async (c) => {
  const body = await c.req.json();
  const jobId = randomUUID();
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  await redis.xAdd('kratos:jobs', '*', {
    payload: JSON.stringify({
      job_id: jobId,
      source: body.source,
      contract_name: body.contract_name || 'Target',
      tier: 'deep',
      requester: body.requester || 'api',
      payment_receipt: c.req.header('x-payment-receipt') || '',
      created_at: Math.floor(Date.now() / 1000),
    }),
  });
  await redis.quit();
  return c.json({ job_id: jobId, status: 'queued' });
});

app.post('/api/monitor', async (c) => {
  const body = await c.req.json();
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  await redis.hSet('kratos:monitors', body.target_address, JSON.stringify({
    target_address: body.target_address,
    callback_url: body.callback_url,
    subscribed_at: Math.floor(Date.now() / 1000),
    expires_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  }));
  await redis.quit();
  return c.json({ status: 'subscribed', target: body.target_address });
});

app.get('/api/audits/:target/:sourceHash', async (c) => {
  const { target, sourceHash } = c.req.param();
  return c.json({ target, sourceHash, status: 'not_implemented' });
});

app.get('/api/jobs/:id', async (c) => {
  const { id } = c.req.param();
  return c.json({ job_id: id, status: 'not_implemented' });
});

const port = parseInt(process.env.PORT_API || '3000');
console.log(`Kratos API starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
