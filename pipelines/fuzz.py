import asyncio
import json
from pathlib import Path
from typing import Literal
from pydantic import BaseModel

Severity = Literal['critical', 'high', 'medium', 'low', 'info']

class Finding(BaseModel):
    tool: str
    severity: Severity
    title: str
    description: str
    file: str
    line: int

async def run_echidna(source_path: Path, properties_path: Path, timeout_seconds: int = 600) -> list[Finding]:
    try:
        proc = await asyncio.create_subprocess_exec(
            'echidna', str(source_path),
            '--contract', 'EchidnaTest',
            '--test-mode', 'property',
            '--test-limit', '50000',
            '--seq-len', '50',
            '--timeout', str(timeout_seconds),
            '--format', 'json',
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate(timeout=timeout_seconds + 30)
        try:
            data = json.loads(stdout)
            tests = data.get('tests', [])
            findings = []
            for t in tests:
                if t.get('status') == 'failed':
                    findings.append(Finding(
                        tool='echidna', severity='high',
                        title=f"property {t.get('name')} violated",
                        description=f"Counterexample: {json.dumps(t.get('counterexample', []))}",
                        file=str(source_path), line=0,
                    ))
            return findings
        except Exception as e:
            return []
    except FileNotFoundError:
        return []

async def run_fuzz_pipeline(source_path: Path) -> list[Finding]:
    from .fuzz_props import generate_and_save_properties
    import tempfile
    import shutil

    tmp_dir = Path(tempfile.mkdtemp(prefix='kratos-fuzz-'))
    try:
        shutil.copy(source_path, tmp_dir / source_path.name)
        props_path = await generate_and_save_properties(source_path, tmp_dir)
        return await run_echidna(tmp_dir / source_path.name, props_path)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
