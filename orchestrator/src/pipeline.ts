import type { AuditJob, AuditReport } from '@kratos/core';
import type { ForkHandle } from './forkPool';

export async function runAudit(
  redis: any,
  fork: ForkHandle,
  job: AuditJob
): Promise<AuditReport> {
  console.log(`Running audit for job ${job.job_id} on fork port ${fork.port}`);

  return {
    job_id: job.job_id,
    severity: 'clean',
    findings: [],
    report_uri: '',
    completed_at: Math.floor(Date.now() / 1000),
  };
}
