#!/usr/bin/env python3
"""Build SWE-bench prediction files after all coding variants are sealed.

This is deliberately an evaluator-side tool. It maps the clean prompt manifest to
official instance IDs only after solutions have been frozen, then pairs each ID
with the corresponding sealed patch.
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


def parse_clean_manifest(data: bytes) -> list[dict[str, str]]:
    tasks = json.loads(data.decode("utf-8"))
    if not isinstance(tasks, list) or not tasks:
        raise ValueError("clean manifest must be a non-empty list")
    for task in tasks:
        if not isinstance(task, dict) or set(task) != TASK_FIELDS:
            raise ValueError("clean manifest contains evaluator-only fields")
        if not all(isinstance(value, str) and value for value in task.values()):
            raise ValueError("clean manifest fields must be non-empty strings")
    return tasks


def load_clean_manifest(path: Path) -> list[dict[str, str]]:
    return parse_clean_manifest(path.read_bytes())


def verify_seal(
    path: Path, manifest_bytes: bytes, sealed_root: Path, task_count: int
) -> dict[str, str]:
    seal = json.loads(path.read_text(encoding="utf-8"))
    if seal.get("schema_version") != 1 or seal.get("hash_algorithm") != "sha256":
        raise ValueError("unsupported evaluation seal")
    if seal.get("task_count") != task_count:
        raise ValueError("seal task count does not match clean manifest")
    if (
        seal.get("dataset") != DATASET
        or seal.get("dataset_revision") != DATASET_REVISION
        or seal.get("dataset_fingerprint") != DATASET_FINGERPRINT
    ):
        raise ValueError("seal does not match the pinned evaluator dataset")
    if seal.get("manifest_sha256") != hashlib.sha256(manifest_bytes).hexdigest():
        raise ValueError("clean manifest changed after sealing")

    expected = {
        f"case-{index:02d}/{variant}.patch"
        for index in range(1, task_count + 1)
        for variant in VARIANTS
    }
    hashes = seal.get("patches")
    if not isinstance(hashes, dict) or set(hashes) != expected:
        raise ValueError("seal does not contain the exact candidate patch set")
    verified_patches: dict[str, str] = {}
    for relative, expected_hash in hashes.items():
        patch = sealed_root / relative
        if not patch.is_file():
            raise ValueError(f"candidate patch changed after sealing: {relative}")
        patch_bytes = patch.read_bytes()
        if hashlib.sha256(patch_bytes).hexdigest() != expected_hash:
            raise ValueError(f"candidate patch changed after sealing: {relative}")
        verified_patches[relative] = patch_bytes.decode("utf-8")
    return verified_patches


def map_instance_ids(
    tasks: list[dict[str, str]], rows: list[dict[str, object]]
) -> list[str]:
    by_source: dict[tuple[str, str], list[str]] = {}
    for row in rows:
        key = (str(row["repo"]), str(row["base_commit"]))
        by_source.setdefault(key, []).append(str(row["instance_id"]))

    instance_ids: list[str] = []
    for task in tasks:
        key = (task["repo"], task["base_commit"])
        matches = by_source.get(key, [])
        if len(matches) != 1:
            raise ValueError(f"expected one official instance for {key}, found {len(matches)}")
        instance_ids.append(matches[0])
    return instance_ids


def build_predictions(
    instance_ids: list[str], verified_patches: dict[str, str], variant: str
) -> list[dict[str, str]]:
    if variant not in VARIANTS:
        raise ValueError(f"unknown variant: {variant}")
    predictions = []
    for index, instance_id in enumerate(instance_ids, start=1):
        relative = f"case-{index:02d}/{variant}.patch"
        patch = verified_patches.get(relative, "")
        if not patch.strip():
            raise ValueError(f"verified patch is empty: {relative}")
        predictions.append(
            {
                "instance_id": instance_id,
                "model_name_or_path": f"bun-loop-study/{variant}",
                "model_patch": patch,
            }
        )
    return predictions


def write_jsonl(path: Path, records: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(record, sort_keys=True) + "\n" for record in records),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("sealed_root", type=Path)
    parser.add_argument("seal", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()

    manifest_bytes = args.manifest.read_bytes()
    tasks = parse_clean_manifest(manifest_bytes)
    verified_patches = verify_seal(
        args.seal, manifest_bytes, args.sealed_root, len(tasks)
    )

    # Import and access evaluator data only after candidate integrity is verified.
    from datasets import load_dataset

    dataset = load_dataset(DATASET, revision=DATASET_REVISION, split="test")
    if getattr(dataset, "_fingerprint", None) != DATASET_FINGERPRINT:
        raise ValueError("loaded evaluator dataset fingerprint does not match the seal")
    rows = list(dataset)
    instance_ids = map_instance_ids(tasks, rows)
    for variant in VARIANTS:
        output = args.output_dir / f"{variant}.jsonl"
        write_jsonl(output, build_predictions(instance_ids, verified_patches, variant))
        print(f"Wrote {len(instance_ids)} {variant} predictions to {output}")
    print("Instance IDs: " + " ".join(instance_ids))


if __name__ == "__main__":
    main()
