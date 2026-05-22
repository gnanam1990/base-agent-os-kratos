import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { ethers } from 'ethers';
import { EAS_BASE_ADDRESS, EAS_SCHEMA_REGISTRY_BASE } from '@kratos/core';

export { EAS_BASE_ADDRESS, EAS_SCHEMA_REGISTRY_BASE };

export interface AttestDatum { name: string; value: any; type: string; }

export interface AttestOptions {
  rpcUrl: string;
  privateKey: string;
  schemaUID: string;
  recipient: string;
  data: AttestDatum[];
  schemaString: string;
  revocable?: boolean;
  expirationTime?: bigint;
}

export async function attest(opts: AttestOptions): Promise<string> {
  const provider = new ethers.JsonRpcProvider(opts.rpcUrl);
  const signer = new ethers.Wallet(opts.privateKey, provider);
  const eas = new EAS(EAS_BASE_ADDRESS);
  eas.connect(signer);
  const encoder = new SchemaEncoder(opts.schemaString);
  const encoded = encoder.encodeData(opts.data);
  const tx = await eas.attest({
    schema: opts.schemaUID,
    data: {
      recipient: opts.recipient,
      expirationTime: opts.expirationTime ?? 0n,
      revocable: opts.revocable ?? true,
      data: encoded,
    },
  });
  return await tx.wait();
}
