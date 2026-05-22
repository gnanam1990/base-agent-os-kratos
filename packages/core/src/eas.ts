/** EAS deployment addresses on Base mainnet (chainId 8453). */
export const EAS_BASE_ADDRESS = '0x4200000000000000000000000000000000000021' as const;
export const EAS_SCHEMA_REGISTRY_BASE = '0x4200000000000000000000000000000000000020' as const;

/** Kratos's primary EAS schema string. Register once via packages/eas-attest. */
export const PRIMARY_SCHEMA = 'string contract_address,uint256 chain_id,string severity,uint256 findings_count,string report_uri,uint256 completed_at' as const;
