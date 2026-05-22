import { execa } from 'execa';

export interface ForkHandle {
  port: number;
  rpcUrl: string;
  process: any;
  status: 'idle' | 'busy';
}

export class ForkPool {
  private forks: ForkHandle[] = [];
  private size: number;
  private forkRpc: string;
  private waitQueue: ((handle: ForkHandle) => void)[] = [];

  constructor(size: number, forkRpc: string) {
    const maxForks = parseInt(process.env.MAX_CONCURRENT_FORKS || '4', 10);
    this.size = Math.min(size, maxForks);
    this.forkRpc = forkRpc;
  }

  async warmup(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (let i = 0; i < this.size; i++) {
      const port = 9100 + i;
      promises.push(this.spawnFork(port));
    }
    await Promise.all(promises);
    console.log(`Fork pool warmed up with ${this.size} instances`);
  }

  private async spawnFork(port: number): Promise<void> {
    const proc = execa('anvil', [
      '--fork-url', this.forkRpc,
      '--port', String(port),
      '--silent',
      '--chain-id', '8453',
    ], { stdio: 'pipe' });

    const handle: ForkHandle = {
      port,
      rpcUrl: `http://127.0.0.1:${port}`,
      process: proc,
      status: 'idle',
    };

    this.forks.push(handle);
    await this.waitForReady(port);
  }

  private async waitForReady(port: number): Promise<void> {
    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        });
        if (res.ok) return;
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error(`Anvil on port ${port} not ready after ${maxRetries} retries`);
  }

  async acquire(): Promise<ForkHandle> {
    const idle = this.forks.find(f => f.status === 'idle');
    if (idle) {
      idle.status = 'busy';
      return idle;
    }

    return new Promise(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  async release(handle: ForkHandle): Promise<void> {
    try {
      await fetch(handle.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'anvil_reset', params: [], id: 1 }),
      });
    } catch (e) {
      console.warn('Failed to reset fork:', e);
    }

    const waiting = this.waitQueue.shift();
    if (waiting) {
      handle.status = 'busy';
      waiting(handle);
    } else {
      handle.status = 'idle';
    }
  }

  async shutdown(): Promise<void> {
    for (const fork of this.forks) {
      try {
        fork.process.kill('SIGTERM');
      } catch {}
    }
    this.forks = [];
    console.log('Fork pool shut down');
  }

  get size_(): number {
    return this.forks.length;
  }
}
