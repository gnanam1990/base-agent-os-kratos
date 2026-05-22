import type { AuditJob, AuditReport, Finding } from '@kratos/core';
import type { ForkHandle } from './forkPool';
import { execa } from 'execa';
import { aggregateFindings, generateMarkdown, uploadReport, type Report } from './reporter';

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

export async function runExploitTemplates(targetAddr: string, forkRpcUrl: string): Promise<Finding[]> {
  try {
    const { runAllTemplates } = await import('./exploitRunner');
    const results = await runAllTemplates(targetAddr, forkRpcUrl);
    return results
      .filter(r => r.vulnerable)
      .map(r => ({
        tool: 'exploit-template',
        severity: 'high' as const,
        title: `Exploit confirmed: ${r.template}`,
        description: `Category: ${r.category}\n${r.trace}`,
        location: { file: `exploit-templates/test/${r.category}`, line: 0 },
      }));
  } catch (e) {
    console.warn('Exploit templates failed:', e);
    return [];
  }
}

export async function runAudit(
  redis: any,
  fork: ForkHandle,
  job: AuditJob
): Promise<AuditReport> {
  console.log(`Running audit for job ${job.job_id} on fork port ${fork.port}`);

  const staticFindings = await runStaticAnalysis(job.source);

  let fuzzFindings: Finding[] = [];
  let symbolicFindings: Finding[] = [];
  let exploitFindings: Finding[] = [];

  if (job.tier === 'standard' || job.tier === 'deep') {
    fuzzFindings = await runFuzzAnalysis(job.source);
  }

  if (job.tier === 'deep') {
    symbolicFindings = await runSymbolicAnalysis(job.source);
  }

  exploitFindings = await runExploitTemplates(job.source, fork.rpcUrl);

  const report = aggregateFindings(staticFindings, fuzzFindings, symbolicFindings, exploitFindings);
  report.job_id = job.job_id;
  report.target_address = job.source;
  report.pipelines_run = ['static', 'fuzz', 'symbolic', 'exploit'].filter((_, i) => {
    if (i === 0) return true;
    if (i === 1) return job.tier === 'standard' || job.tier === 'deep';
    if (i === 2) return job.tier === 'deep';
    return true;
  });

  const markdown = generateMarkdown(report);
  const reportUri = await uploadReport(markdown);

  return {
    job_id: job.job_id,
    target_address: report.target_address,
    severity: report.severity_overall,
    findings: report.findings,
    report_uri: reportUri,
    attestation_uid: '',
    completed_at: report.completed_at,
  };
}
