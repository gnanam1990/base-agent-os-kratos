import type { AuditJob, AuditReport, Finding } from '@kratos/core';
import type { ForkHandle } from './forkPool';
import { execa } from 'execa';

export async function runStaticAnalysis(sourcePath: string): Promise<Finding[]> {
  try {
    const result = await execa('python3', [
      '-c',
      `import asyncio, json; from pipelines.static import run_static_pipeline; from pathlib import Path; print(json.dumps([f.model_dump() for f in asyncio.run(run_static_pipeline(Path('${sourcePath}')))], default=str))`
    ], { cwd: process.cwd() });

    const findings = JSON.parse(result.stdout);
    return findings.map((f: any) => ({
      tool: f.tool,
      severity: f.severity,
      title: f.title,
      description: f.description,
      location: { file: f.file, line: f.line },
    }));
  } catch (e) {
    console.warn('Static analysis failed:', e);
    return [];
  }
}

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
