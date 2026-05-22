export const kratosRegistryAbi = [
  {
    type: 'function',
    name: 'setAgent',
    inputs: [{ name: '_agent', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordAudit',
    inputs: [
      { name: 'jobId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'contractAddr', type: 'address', internalType: 'address' },
      { name: 'severity', type: 'uint8', internalType: 'uint8' },
      { name: 'reportURI', type: 'string', internalType: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAudit',
    inputs: [{ name: 'jobId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct KratosRegistry.AuditRecord',
        components: [
          { name: 'contractAddr', type: 'address', internalType: 'address' },
          { name: 'severity', type: 'uint8', internalType: 'uint8' },
          { name: 'reportURI', type: 'string', internalType: 'string' },
          { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'agent',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AuditRecorded',
    inputs: [
      { name: 'jobId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'contractAddr', type: 'address', indexed: true, internalType: 'address' },
      { name: 'severity', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'reportURI', type: 'string', indexed: false, internalType: 'string' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
] as const;
