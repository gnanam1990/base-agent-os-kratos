import asyncio
import json
import subprocess
from pathlib import Path
from typing import Literal, Optional
from pydantic import BaseModel

Severity = Literal['critical', 'high', 'medium', 'low', 'info']

class Finding(BaseModel):
    tool: str
    severity: Severity
    title: str
    description: str
    file: str
    line: int

async def run_slither(source_path: Path) -> list[Finding]:
    try:
        proc = await asyncio.create_subprocess_exec(
            'slither', str(source_path), '--json', '-',
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if not stdout:
            return []
        try:
            data = json.loads(stdout)
            detectors = data.get('results', {}).get('detectors', [])
            findings = []
            for d in detectors:
                impact = d.get('impact', 'info').lower()
                sev = impact if impact in ('critical', 'high', 'medium', 'low', 'info') else 'info'
                elements = d.get('elements', [])
                file_ = elements[0].get('source_mapping', {}).get('filename_relative', str(source_path)) if elements else str(source_path)
                line = elements[0].get('source_mapping', {}).get('lines', [0])[0] if elements else 0
                findings.append(Finding(tool='slither', severity=sev, title=d.get('check', '?'),
                                        description=d.get('description', ''), file=file_, line=line))
            return findings
        except Exception:
            return []
    except FileNotFoundError:
        return []

async def run_mythril(source_path: Path) -> list[Finding]:
    try:
        proc = await asyncio.create_subprocess_exec(
            'myth', 'analyze', str(source_path), '-o', 'json',
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        try:
            data = json.loads(stdout)
            issues = data.get('issues', [])
            findings = []
            for i in issues:
                sev = i.get('severity', 'Low').lower()
                findings.append(Finding(tool='mythril', severity=sev,
                                        title=i.get('title', '?'),
                                        description=i.get('description', ''),
                                        file=str(source_path), line=i.get('lineno', 0)))
            return findings
        except Exception:
            return []
    except FileNotFoundError:
        return []

async def run_4naly3er(source_path: Path) -> list[Finding]:
    try:
        proc = await asyncio.create_subprocess_exec(
            'node', '/opt/4naly3er/dist/index.js', '--file', str(source_path),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        findings: list[Finding] = []
        for line in stdout.decode('utf-8').splitlines():
            if line.startswith('GAS') or line.startswith('LOW') or line.startswith('HIGH'):
                sev = 'high' if line.startswith('HIGH') else ('low' if line.startswith('LOW') else 'info')
                findings.append(Finding(tool='4naly3er', severity=sev, title=line[:80],
                                        description=line, file=str(source_path), line=0))
        return findings
    except FileNotFoundError:
        return []

async def run_static_pipeline(source_path: Path) -> list[Finding]:
    results = await asyncio.gather(run_slither(source_path), run_mythril(source_path), run_4naly3er(source_path))
    merged = [f for sub in results for f in sub]
    seen = set()
    deduped: list[Finding] = []
    for f in merged:
        key = (f.severity, f.title.lower(), f.file, f.line)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(f)
    return deduped
