#!/usr/bin/env python3
"""Hash a clean manifest and every candidate patch before evaluator access.

The resulting seal detects any patch mutation between coding and prediction
generation. Process isolation is still required to keep evaluator metadata away
from coding agents before this command runs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


TASK_FIELDS = {"problem_statement", "repo", "base_commit"}
VARIANTS = ("bun", "plain")
DATASET = "SWE-bench/SWE-bench_Verified"
DATASET_REVISION = "91aa3ed51b709be6457e12d00300a6a596d4c6a3"
DATASET_FINGERPRINT = "24e4847db36d5b81"


def validate_manifest_bytes(data: bytes) -> list[dict[str, str]]:
    tasks = json.loads(data.decode("utf-8"))
    if not isinstance(tasks, list) or not tasks:
        raise ValueError("clean manifest must be a non-empty list")
    for task in tasks:
        if not isinstance(task, dict) or set(task) != TASK_FIELDS:
            raise ValueError("clean manifest contains evaluator-only fields")
        if not all(isinstance(value, str) and value for value in task.values()):
            raise ValueError("clean manifest fields must be non-empty strings")
    return tasks


def validate_manifest(path: Path) -> list[dict[str, str]]:
    return validate_manifest_bytes(path.read_bytes())


def create_seal(manifest: Path, sealed_root: Path) -> dict[str, object]:
    manifest_bytes = manifest.read_bytes()
    tasks = validate_manifest_bytes(manifest_bytes)
    patches: dict[str, str] = {}
    for index in range(1, len(tasks) + 1):
        for variant in VARIANTS:
            relative = f"case-{index:02d}/{variant}.patch"
            patch_path = sealed_root / relative
            if not patch_path.is_file():
                raise ValueError(f"candidate patch is missing or empty: {patch_path}")
            patch_bytes = patch_path.read_bytes()
            if not patch_bytes.strip():
                raise ValueError(f"candidate patch is missing or empty: {patch_path}")
            patches[relative] = hashlib.sha256(patch_bytes).hexdigest()
    return {
        "schema_version": 1,
        "hash_algorithm": "sha256",
        "dataset": DATASET,
        "dataset_revision": DATASET_REVISION,
        "dataset_fingerprint": DATASET_FINGERPRINT,
        "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "task_count": len(tasks),
        "patches": patches,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("sealed_root", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    seal = create_seal(args.manifest, args.sealed_root)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(seal, indent=2) + "\n", encoding="utf-8")
    print(f"Sealed {len(seal['patches'])} patches in {args.output}")


if __name__ == "__main__":
    main()
