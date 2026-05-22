import { z } from 'zod';

export const SeveritySchema = z.enum(['clean', 'low', 'high', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

export const TierSchema = z.enum(['fast', 'standard', 'deep']);
export type Tier = z.infer<typeof TierSchema>;

export const FindingSchema = z.object({
  tool: z.string(),
  severity: SeveritySchema,
  title: z.string(),
  description: z.string(),
  location: z.object({
    file: z.string(),
    line: z.number().int(),
  }),
  proof_of_attack_tx: z.string().optional(),
  remediation: z.string().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const AuditJobSchema = z.object({
  job_id: z.string(),
  source: z.string(),
  contract_name: z.string(),
  constructor_args: z.array(z.any()).optional(),
  tier: TierSchema,
  requester: z.string(),
  payment_receipt: z.string(),
  created_at: z.number().int(),
});
export type AuditJob = z.infer<typeof AuditJobSchema>;

export const AuditReportSchema = z.object({
  job_id: z.string(),
  target_address: z.string().optional(),
  severity: SeveritySchema,
  findings: z.array(FindingSchema),
  report_uri: z.string(),
  attestation_uid: z.string().optional(),
  completed_at: z.number().int(),
});
export type AuditReport = z.infer<typeof AuditReportSchema>;
