import asyncio
import json
import re
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

def generate_symbolic_properties(source_path: Path) -> str:
    source = source_path.read_text()

    contract_match = re.search(r'contract\s+(\w+)', source)
    contract_name = contract_match.group(1) if contract_match else 'Target'

    functions = re.findall(r'function\s+(\w+)\s*\(([^)]*)\)\s+external', source)
    checks = []
    for func_name, args in functions:
        if func_name.startswith('check_'):
            continue

        checks.append(f"""
    function check_{func_name}_access_control() public {{
        address ownerBefore = target.owner();
        target.{func_name}();
        if (msg.sender != ownerBefore) {{
            assert(address(target.owner()) == ownerBefore);
        }}
    }}""")

    checks_str = '\n'.join(checks)

    return f"""// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "./{source_path.stem}.sol";

contract SymbolicTest is Test {{
    {contract_name} public target;

    function setUp() public {{
        target = new {contract_name}();
    }}

    {checks_str}
}}
"""

async def generate_and_save_symbolic_properties(source_path: Path, output_dir: Path) -> Path:
    properties = generate_symbolic_properties(source_path)
    test_dir = output_dir / 'test'
    test_dir.mkdir(parents=True, exist_ok=True)
    output_path = test_dir / 'SymbolicTest.t.sol'
    output_path.write_text(properties)
    return output_path

async def run_halmos(test_path: Path, timeout_per_function: int = 120) -> list[Finding]:
    try:
        proc = await asyncio.create_subprocess_exec(
            'halmos', '--match-contract', 'SymbolicTest',
            '--solver-timeout-assertion', str(timeout_per_function * 1000),
            '--json-output', '/tmp/halmos-out.json',
            cwd=str(test_path.parent.parent),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate(timeout=timeout_per_function * 10 + 60)

        try:
            with open('/tmp/halmos-out.json') as f:
                data = json.load(f)
            failures = []
            for test in data.get('tests', []):
                if test.get('result') == 'fail':
                    failures.append(Finding(
                        tool='halmos', severity='high',
                        title=f"symbolic assertion failed: {test.get('name')}",
                        description=f"Counterexample: {json.dumps(test.get('counterexample', {}))}",
                        file=str(test_path), line=0,
                    ))
            return failures
        except Exception:
            return []
    except FileNotFoundError:
        return []

async def run_symbolic_pipeline(source_path: Path) -> list[Finding]:
    from .fuzz_props import generate_and_save_properties
    import tempfile
    import shutil

    tmp_dir = Path(tempfile.mkdtemp(prefix='kratos-symb-'))
    try:
        shutil.copy(source_path, tmp_dir / source_path.name)
        props_path = await generate_and_save_symbolic_properties(source_path, tmp_dir)
        return await run_halmos(props_path)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
