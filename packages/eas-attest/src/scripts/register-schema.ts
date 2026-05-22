import { SchemaRegistry } from '@ethereum-attestation-service/eas-sdk';
import { ethers } from 'ethers';
import { EAS_SCHEMA_REGISTRY_BASE, PRIMARY_SCHEMA } from '@kratos/core';

async function main() {
  const rpc = process.env.BASE_MAINNET_RPC;
  const pk = process.env.AGENT_PK || process.env.DEPLOYER_PK;
  if (!rpc || !pk) throw new Error('BASE_MAINNET_RPC and AGENT_PK or DEPLOYER_PK required');

  const provider = new ethers.JsonRpcProvider(rpc);
  const signer = new ethers.Wallet(pk, provider);
  const registry = new SchemaRegistry(EAS_SCHEMA_REGISTRY_BASE);
  registry.connect(signer);

  console.log('Registering PRIMARY_SCHEMA:', PRIMARY_SCHEMA);
  const tx = await registry.register({
    schema: PRIMARY_SCHEMA,
    resolverAddress: '0x0000000000000000000000000000000000000000',
    revocable: true,
  });
  const uid = await tx.wait();
  console.log('PRIMARY schema UID:', uid);
  console.log('Add to .env:');
  console.log('EAS_SCHEMA_UID_AUDIT=' + uid);
}

main().catch((e) => { console.error(e); process.exit(1); });
