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

export async function runFuzzAnalysis(sourcePath: string): Promise<Finding[]> {
  try {
    const result = await execa('python3', [
      '-c',
      `import asyncio, json; from pipelines.fuzz import run_fuzz_pipeline; from pathlib import Path; print(json.dumps([f.model_dump() for f in asyncio.run(run_fuzz_pipeline(Path('${sourcePath}')))], default=str))`
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
    console.warn('Fuzz analysis failed:', e);
    return [];
  }
}

export async function runSymbolicAnalysis(sourcePath: string): Promise<Finding[]> {
  try {
    const result = await execa('python3', [
      '-c',
      `import asyncio, json; from pipelines.symbolic import run_symbolic_pipeline; from pathlib import Path; print(json.dumps([f.model_dump() for f in asyncio.run(run_symbolic_pipeline(Path('${sourcePath}')))], default=str))`
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
    console.warn('Symbolic analysis failed:', e);
    return [];
  }
}

export async function runAudit(
  redis: any,
  fork: ForkHandle,
  job: AuditJob
): Promise<AuditReport> {
  console.log(`Running audit for job ${job.job_id} on fork port ${fork.port}`);

  const allFindings: Finding[] = [];

  const staticFindings = await runStaticAnalysis(job.source);
  allFindings.push(...staticFindings);

  if (job.tier === 'standard' || job.tier === 'deep') {
    const fuzzFindings = await runFuzzAnalysis(job.source);
    allFindings.push(...fuzzFindings);
  }

  if (job.tier === 'deep') {
    const symbolicFindings = await runSymbolicAnalysis(job.source);
    allFindings.push(...symbolicFindings);
  }

  const hasCritical = allFindings.some(f => f.severity === 'critical');
  const hasHigh = allFindings.some(f => f.severity === 'high');
  const severity = hasCritical ? 'critical' : hasHigh ? 'high' : allFindings.length > 0 ? 'low' : 'clean';

  return {
    job_id: job.job_id,
    severity,
    findings: allFindings,
    report_uri: '',
    completed_at: Math.floor(Date.now() / 1000),
  };
}
