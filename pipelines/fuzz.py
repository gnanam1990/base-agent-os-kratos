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

async def run_fuzz_pipeline(source_path: Path) -> list[Finding]:
    return []
