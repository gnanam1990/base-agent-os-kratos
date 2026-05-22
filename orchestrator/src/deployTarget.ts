import { execa } from 'execa';
import { mkdir, writeFile, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';

const ANVIL_DEFAULT_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export interface DeployResult {
  address: string;
  txHash: string;
}

export async function deployTargetToFork(
  forkRpcUrl: string,
  source: string,
  contractName: string,
  constructorArgs: string[] = []
): Promise<DeployResult> {
  const id = randomUUID();
  const tmpDir = join('/tmp', `kratos-deploy-${id}`);

  try {
    await mkdir(tmpDir, { recursive: true });
    await mkdir(join(tmpDir, 'src'), { recursive: true });

    await writeFile(join(tmpDir, 'foundry.toml'), `
[profile.default]
solc = "0.8.24"
src = "src"
out = "out"
libs = ["lib"]
optimizer = true
optimizer_runs = 1000000
`);

    await writeFile(join(tmpDir, 'src', `${contractName}.sol`), source);

    const args = [
      'create',
      join(tmpDir, `src/${contractName}.sol:${contractName}`),
      '--rpc-url', forkRpcUrl,
      '--private-key', ANVIL_DEFAULT_KEY,
    ];

    if (constructorArgs.length > 0) {
      args.push('--constructor-args', ...constructorArgs);
    }

    const result = await execa('forge', args, { cwd: tmpDir });
    const output = result.stdout;

    const addressMatch = output.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);
    const txMatch = output.match(/Transaction:\s*(0x[a-fA-F0-9]{64})/);

    if (!addressMatch) throw new Error('Could not parse deployed address from forge output');

    return {
      address: addressMatch[1],
      txHash: txMatch?.[1] || '0x',
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
