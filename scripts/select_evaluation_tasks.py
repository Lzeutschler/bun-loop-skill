#!/usr/bin/env python3
"""Create a contamination-resistant SWE-bench task manifest.

The output intentionally contains only the fields accepted by the prompt renderer.
Gold patches, evaluator patches, test identifiers, issue IDs, and hints are never
read by this script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ALLOWED_FIELDS = ("problem_statement", "repo", "base_commit")
DIFFICULTY_ORDER = {">4 hours": 0, "1-4 hours": 1}
EXCLUDED_REPOSITORIES = {"django/django", "pydata/xarray"}
SEED = "bun-loop-clean-evaluation-v1"
DATASET_REVISION = "91aa3ed51b709be6457e12d00300a6a596d4c6a3"


def selection_key(row: dict[str, object]) -> tuple[int, str]:
    difficulty = str(row["difficulty"])
    fingerprint = hashlib.sha256(
        f"{SEED}\0{row['repo']}\0{row['base_commit']}".encode()
    ).hexdigest()
    return DIFFICULTY_ORDER[difficulty], fingerprint


def select_tasks(rows: list[dict[str, object]], count: int) -> list[dict[str, str]]:
    candidates = [
        row
        for row in rows
        if row["repo"] not in EXCLUDED_REPOSITORIES
        and row.get("difficulty") in DIFFICULTY_ORDER
    ]
    selected: list[dict[str, str]] = []
    used_repositories: set[str] = set()

    for row in sorted(candidates, key=selection_key):
        repo = str(row["repo"])
        if repo in used_repositories:
            continue
        task = {field: str(row[field]) for field in ALLOWED_FIELDS}
        if set(task) != set(ALLOWED_FIELDS):
            raise RuntimeError("clean manifest field invariant failed")
        selected.append(task)
        used_repositories.add(repo)
        if len(selected) == count:
            return selected

    raise RuntimeError(f"only {len(selected)} repository-diverse tasks matched")


def main() -> None:
    from datasets import load_dataset

    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--count", type=int, default=5)
    args = parser.parse_args()
    if args.count < 1:
        parser.error("--count must be positive")

    dataset = load_dataset(
        "SWE-bench/SWE-bench_Verified", revision=DATASET_REVISION, split="test"
    )
    tasks = select_tasks(list(dataset), args.count)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(tasks, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(tasks)} clean tasks to {args.output}")


if __name__ == "__main__":
    main()
