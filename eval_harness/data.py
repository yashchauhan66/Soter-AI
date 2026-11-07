"""Offline, source-preserving evaluation data mechanisms (not release certification)."""
import hashlib
import json
import math
import os
import random
import re
import unicodedata
from collections.abc import Mapping
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

from .core import Case, _freeze_json, _thaw_json, _unicode_string, aggregate_metrics

SCHEMA_IDENTITY = "soter.case/source-policy/v2"
IMPORTER_IDENTITY = "soter.jsonl/utf8-exact-v1"
GROUPING_IDENTITY = "soter.group/connected-source-template-parent-declared-duplicates/v2"
SEAL_IDENTITY = "soter.seal/exact-bytes-manifest-pin/v1"
TEXT_NORMALIZATION_IDENTITY = "NFKC-casefold-whitespace/v1"
PARTITION_IDENTITY = "soter.partition/seeded-components-largest-remainder/v1"
SEAL_FIELDS = frozenset(("seal_identity", "complete", "schema_identity", "importer_identity", "grouping_identity",
                        "settings", "payload_sha256", "payload_bytes", "n_cases", "ordered_ids", "source_input",
                        "serialized_source_fingerprints", "audits", "coverage_gaps_by_id",
                        "independence_established", "release_ready", "normalization", "grouping", "partition_plan"))
UNESTABLISHED_AUDITS = _freeze_json({
    "provenance": "not_established", "semantic_near_duplicate": "not_run",
    "lexical_near_duplicate": "not_run", "embedding_near_duplicate": "not_run",
    "baseline_exposure": "not_established", "teacher_exposure": "not_established",
})


def _sha256(payload):
    return hashlib.sha256(payload).hexdigest()


def _json_bytes(value):
    return json.dumps(_thaw_json(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


@dataclass(frozen=True)
class ImportedDataset:
    """Captured immutable source bytes and the exact records parsed from them."""
    raw_bytes: bytes
    cases: tuple[Case, ...]
    record_bytes: tuple[bytes, ...]

    def __post_init__(self):
        if type(self.raw_bytes) is not bytes:
            raise ValueError("invalid JSONL: captured input must be immutable bytes")
        object.__setattr__(self, "cases", tuple(self.cases))
        object.__setattr__(self, "record_bytes", tuple(self.record_bytes))
        if len(self.cases) != len(self.record_bytes):
            raise ValueError("invalid JSONL: source records and cases are not aligned")

    @property
    def raw_sha256(self):
        return _sha256(self.raw_bytes)

    @property
    def ordered_ids(self):
        return tuple(case.id for case in self.cases)

    @property
    def schema_identity(self):
        return SCHEMA_IDENTITY

    @property
    def importer_identity(self):
        return IMPORTER_IDENTITY

    @property
    def release_ready(self):
        return False

    @property
    def diagnostics(self):
        return _freeze_json({"case_count": len(self.cases),
                             "coverage_gaps_by_id": {case.id: list(case.coverage_gaps) for case in self.cases},
                             "audits": UNESTABLISHED_AUDITS, "independence_established": False, "release_ready": False})

    def assert_independence(self):
        raise ValueError("independence not established: metadata declarations do not replace "
                         + ", ".join(UNESTABLISHED_AUDITS))

    def assert_release_ready(self):
        raise ValueError("release not established: release_ready=false; provenance/semantic/teacher audits are missing")

    @property
    def source_fingerprints(self):
        groups = {}
        for case, raw_record in zip(self.cases, self.record_bytes):
            descriptor = {name: case.to_dict()[name] for name in (
                "source", "source_version", "license", "license_status", "provenance")}
            key = _json_bytes(descriptor)
            group = groups.setdefault(key, {"identity": descriptor, "ordered_ids": [], "records": []})
            group["ordered_ids"].append(case.id)
            group["records"].append(raw_record)
        return tuple(_freeze_json({"identity": group["identity"], "ordered_ids": group["ordered_ids"],
                                   "record_bytes_sha256": _sha256(b"".join(group["records"]))})
                     for group in groups.values())


def _strict_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key {key!r}")
        result[key] = value
    return result


def _reject_constant(value):
    raise ValueError(f"nonfinite JSON number {value}")


def _validate_unicode_values(row):
    """JSON escapes must decode to Unicode scalars; no replacement/normalization."""
    pending = [row]
    while pending:
        value = pending.pop()
        if type(value) is str:
            value.encode("utf-8", errors="strict")
        elif type(value) is dict:
            pending.extend(value.keys())
            pending.extend(value.values())
        elif type(value) is list:
            pending.extend(value)


def _parse_jsonl(payload):
    if not payload:
        raise ValueError("invalid JSONL: empty input has no records")
    chunks = payload.split(b"\n")
    if chunks[-1] == b"":
        chunks.pop()
    records = tuple(chunk + (b"\n" if index < len(chunks) - 1 or payload.endswith(b"\n") else b"")
                    for index, chunk in enumerate(chunks))
    cases, seen = [], set()
    for line, record in enumerate(records, 1):
        try:
            row = json.loads(record.decode("utf-8"), object_pairs_hook=_strict_object, parse_constant=_reject_constant)
            _validate_unicode_values(row)
            case = Case.from_dict(row)
            if case.id in seen:
                raise ValueError(f"duplicate case ID {case.id!r}")
            seen.add(case.id)
            cases.append(case)
        except (UnicodeError, ValueError, TypeError) as error:
            raise ValueError(f"invalid JSONL line {line}: {error}") from error
    return ImportedDataset(payload, tuple(cases), records)


def import_jsonl_bytes(payload, *, claim="diagnostic"):
    """Hash and parse one immutable captured payload, with no reopening of paths."""
    if type(payload) is not bytes:
        raise ValueError("invalid JSONL: expected captured bytes, not coerced text")
    if claim not in ("diagnostic", "independence", "release"):
        raise ValueError("invalid claim: use diagnostic, independence or release verbatim")
    imported = _parse_jsonl(payload)
    if claim == "independence":
        imported.assert_independence()
    if claim == "release":
        imported.assert_release_ready()
    return imported


def import_jsonl(path, *, claim="diagnostic"):
    """Read exactly once in binary mode; imported text/IDs/order remain untouched."""
    return import_jsonl_bytes(Path(path).read_bytes(), claim=claim)


@dataclass(frozen=True)
class SealedDataset:
    """Verified captured bytes; consuming cases never reopens a mutable path."""
    dataset: ImportedDataset
    source_dataset: ImportedDataset
    manifest_bytes: bytes
    manifest: Mapping

    def __post_init__(self):
        object.__setattr__(self, "manifest", _freeze_json(self.manifest))

    @property
    def manifest_sha256(self):
        return _sha256(self.manifest_bytes)

    @property
    def raw_bytes(self):
        return self.dataset.raw_bytes

    @property
    def cases(self):
        return self.dataset.cases

    @property
    def ordered_ids(self):
        return self.dataset.ordered_ids

    @property
    def release_ready(self):
        return False


def _settings_bytes(settings):
    if not isinstance(settings, Mapping) or not settings:
        raise ValueError("invalid seal settings: explicit nonempty object required")
    try:
        copied = _thaw_json(_freeze_json(settings))
    except ValueError as error:
        raise ValueError(f"invalid seal settings: {error}") from error
    required = {"target", "threshold", "seed", "text_overlap_normalization", "languages"}
    if not required <= copied.keys():
        raise ValueError("invalid seal settings: missing explicit target/threshold/seed/normalization/languages")
    if copied["target"] not in ("risk", "injection", "policy"):
        raise ValueError("invalid seal settings: target is not normalized or inferred")
    threshold = copied["threshold"]
    if type(threshold) not in (int, float) or not math.isfinite(threshold) or not 0 <= threshold <= 1:
        raise ValueError("invalid seal settings: threshold must be a finite probability, not coerced")
    if type(copied["seed"]) is not int:
        raise ValueError("invalid seal settings: seed must be an integer, not coerced")
    languages = copied["languages"]
    if (not isinstance(languages, list) or not languages
            or any(type(language) is not str or not language.strip() for language in languages)
            or len(set(languages)) != len(languages)):
        raise ValueError("invalid seal settings: declared languages must be unique ordered strings")
    if copied["text_overlap_normalization"] != TEXT_NORMALIZATION_IDENTITY:
        raise ValueError("invalid seal settings: unknown named text normalization")
    if "ece_bins" in copied and (type(copied["ece_bins"]) is not int or not 1 <= copied["ece_bins"] <= 1000):
        raise ValueError("invalid seal settings: ece_bins must be an integer in [1,1000]")
    return _json_bytes(copied)


def _write_exclusive(path, payload):
    with path.open("xb") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())


def seal_dataset(imported, destination, *, settings, partition_plan=None):
    """Seal diagnostic data at a NEW directory; manifest is written last."""
    settings_payload = _settings_bytes(settings)
    if not isinstance(imported, ImportedDataset):
        raise ValueError("invalid seal: expected a captured ImportedDataset")  # noqa: TRY004 -- Invalid-record APIs consistently raise ValueError.
    source = import_jsonl_bytes(imported.raw_bytes)
    if (source.record_bytes != imported.record_bytes
            or _json_bytes([case.to_dict() for case in source.cases]) != _json_bytes([case.to_dict() for case in imported.cases])):
        raise ValueError("invalid seal: captured bytes and parsed cases disagree")
    payload = b"".join(_json_bytes(case.to_dict()) + b"\n" for case in source.cases)
    serialized = import_jsonl_bytes(payload)
    captured_settings = json.loads(settings_payload)
    manifest = {
        "seal_identity": SEAL_IDENTITY, "complete": True,
        "schema_identity": SCHEMA_IDENTITY, "importer_identity": IMPORTER_IDENTITY,
        "grouping_identity": GROUPING_IDENTITY, "settings": json.loads(settings_payload),
        "normalization": _normalization_descriptor(captured_settings["text_overlap_normalization"]),
        "grouping": _grouping_record(source.cases),
        "partition_plan": _partition_record(source.cases, partition_plan, captured_settings),
        "payload_sha256": _sha256(payload), "payload_bytes": len(payload), "n_cases": len(source.cases),
        "ordered_ids": list(source.ordered_ids),
        "source_input": {"raw_sha256": source.raw_sha256, "raw_bytes": len(source.raw_bytes),
                         "source_fingerprints": _thaw_json(source.source_fingerprints)},
        "serialized_source_fingerprints": _thaw_json(serialized.source_fingerprints),
        "audits": dict(UNESTABLISHED_AUDITS),
        "coverage_gaps_by_id": _thaw_json(source.diagnostics["coverage_gaps_by_id"]),
        "independence_established": False, "release_ready": False,
    }
    manifest_payload = _json_bytes(manifest) + b"\n"
    destination = Path(destination)
    destination.mkdir(exist_ok=False)
    _write_exclusive(destination / "source.jsonl", source.raw_bytes)
    _write_exclusive(destination / "cases.jsonl", payload)
    _write_exclusive(destination / "manifest.json", manifest_payload)
    return load_sealed(destination, expected_manifest_sha256=_sha256(manifest_payload),
                       expected_settings=json.loads(settings_payload))


def _verify_manifest_shape(manifest):
    if type(manifest) is not dict or manifest.keys() != SEAL_FIELDS:
        raise ValueError("incomplete manifest or unknown manifest fields")
    source = manifest["source_input"]
    if type(source) is not dict or source.keys() != {"raw_sha256", "raw_bytes", "source_fingerprints"}:
        raise ValueError("incomplete source fingerprint manifest")
    for name in ("payload_bytes", "n_cases"):
        if type(manifest[name]) is not int or manifest[name] <= 0:
            raise ValueError(f"{name} must be an integer, not coerced")
    if type(source["raw_bytes"]) is not int or source["raw_bytes"] <= 0:
        raise ValueError("source raw_bytes must be an integer, not coerced")
    for value in (manifest["payload_sha256"], source["raw_sha256"]):
        if type(value) is not str or not re.fullmatch(r"[0-9a-f]{64}", value):
            raise ValueError("invalid exact SHA256 token; values are not normalized")
    ids = manifest["ordered_ids"]
    if (type(ids) is not list or not ids or any(type(item) is not str or not item.strip() for item in ids)
            or len(set(ids)) != len(ids)):
        raise ValueError("ordered_ids must be a unique ordered list of exact strings")


def load_sealed(destination, *, expected_manifest_sha256, expected_settings):
    """Pin manifest, then hash AND parse the same captured data/source payloads."""
    expected_settings_payload = _settings_bytes(expected_settings)
    destination = Path(destination)
    try:
        if type(expected_manifest_sha256) is not str or not re.fullmatch(r"[0-9a-f]{64}", expected_manifest_sha256):
            raise ValueError("expected manifest SHA256 is malformed; it is not normalized")
        required_files = {"manifest.json", "cases.jsonl", "source.jsonl"}
        if (not destination.is_dir() or destination.is_symlink()
                or {entry.name for entry in destination.iterdir()} != required_files
                or any(not (destination / name).is_file() or (destination / name).is_symlink() for name in required_files)):
            raise ValueError("missing, extra or linked unbound seal inputs")
        manifest_payload = (destination / "manifest.json").read_bytes()
        payload = (destination / "cases.jsonl").read_bytes()
        source_payload = (destination / "source.jsonl").read_bytes()
    except (OSError, ValueError) as error:
        raise ValueError(f"invalid seal: {error}") from error
    return _verify_captured_seal(manifest_payload, payload, source_payload,
                                 expected_manifest_sha256=expected_manifest_sha256,
                                 expected_settings_payload=expected_settings_payload)


def _verify_captured_seal(manifest_payload, payload, source_payload, *, expected_manifest_sha256, expected_settings_payload):
    """Verify and consume one byte capture, reusable without any mutable file path."""
    try:
        if any(type(value) is not bytes for value in (manifest_payload, payload, source_payload, expected_settings_payload)):
            raise ValueError("seal captures must be immutable bytes, not coerced text")
        if type(expected_manifest_sha256) is not str or not re.fullmatch(r"[0-9a-f]{64}", expected_manifest_sha256):
            raise ValueError("expected manifest SHA256 is malformed; it is not normalized")
        if _sha256(manifest_payload) != expected_manifest_sha256:
            raise ValueError("manifest byte fingerprint mismatch")
        manifest = json.loads(manifest_payload.decode("utf-8"), object_pairs_hook=_strict_object, parse_constant=_reject_constant)
        _verify_manifest_shape(manifest)
        if (manifest["seal_identity"] != SEAL_IDENTITY or manifest["schema_identity"] != SCHEMA_IDENTITY
                or manifest["importer_identity"] != IMPORTER_IDENTITY or manifest["grouping_identity"] != GROUPING_IDENTITY):
            raise ValueError("schema/importer/grouping/seal identity mismatch")
        if (manifest["complete"] is not True or manifest["release_ready"] is not False
                or manifest["independence_established"] is not False):
            raise ValueError("incomplete manifest or prohibited release/independence claim")
        if _json_bytes(manifest["settings"]) != expected_settings_payload:
            raise ValueError("settings mismatch")
        expected_settings_record = json.loads(expected_settings_payload)
        if _json_bytes(manifest["normalization"]) != _json_bytes(_normalization_descriptor(expected_settings_record["text_overlap_normalization"])):
            raise ValueError("normalization identity mismatch (including Unicode data version)")
        if _json_bytes(manifest["audits"]) != _json_bytes(UNESTABLISHED_AUDITS):
            raise ValueError("unestablished audit status mismatch")
        if _sha256(payload) != manifest["payload_sha256"] or len(payload) != manifest["payload_bytes"]:
            raise ValueError("serialized byte fingerprint mismatch")
        if (_sha256(source_payload) != manifest["source_input"]["raw_sha256"]
                or len(source_payload) != manifest["source_input"]["raw_bytes"]):
            raise ValueError("source byte fingerprint mismatch")
        serialized, source = import_jsonl_bytes(payload), import_jsonl_bytes(source_payload)
        if (list(serialized.ordered_ids) != manifest["ordered_ids"] or serialized.ordered_ids != source.ordered_ids
                or len(serialized.cases) != manifest["n_cases"]):
            raise ValueError("ordered IDs/count mismatch")
        if _json_bytes([case.to_dict() for case in serialized.cases]) != _json_bytes([case.to_dict() for case in source.cases]):
            raise ValueError("serialized cases differ from captured source")
        if (_json_bytes(_thaw_json(source.source_fingerprints)) != _json_bytes(manifest["source_input"]["source_fingerprints"])
                or _json_bytes(_thaw_json(serialized.source_fingerprints)) != _json_bytes(manifest["serialized_source_fingerprints"])):
            raise ValueError("source fingerprint identities mismatch")
        if _thaw_json(source.diagnostics["coverage_gaps_by_id"]) != manifest["coverage_gaps_by_id"]:
            raise ValueError("coverage-gap metadata mismatch")
        if _json_bytes(manifest["grouping"]) != _json_bytes(_grouping_record(source.cases)):
            raise ValueError("computed grouping identity/assignment mismatch")
        _verify_partition_record(source.cases, manifest["partition_plan"], expected_settings_record)
    except (OSError, UnicodeError, ValueError, KeyError, TypeError) as error:
        raise ValueError(f"invalid seal: {error}") from error
    return SealedDataset(serialized, source, manifest_payload, manifest)


def aggregate_sealed(sealed, batch, *, expected_manifest_sha256, expected_settings, expected_model_identity):
    """Metrics on pinned captured seal bytes/settings, never a reopened data path."""
    settings_payload = _settings_bytes(expected_settings)
    if not isinstance(sealed, SealedDataset):
        raise ValueError("invalid seal: captured SealedDataset required")  # noqa: TRY004 -- Invalid-record APIs consistently raise ValueError.
    verified = _verify_captured_seal(sealed.manifest_bytes, sealed.raw_bytes, sealed.source_dataset.raw_bytes,
                                     expected_manifest_sha256=expected_manifest_sha256,
                                     expected_settings_payload=settings_payload)
    if _json_bytes(sealed.manifest) != _json_bytes(verified.manifest):
        raise ValueError("invalid seal: manifest object and captured manifest bytes disagree")
    for supplied, checked in ((sealed.dataset, verified.dataset), (sealed.source_dataset, verified.source_dataset)):
        if (supplied.record_bytes != checked.record_bytes
                or _json_bytes([case.to_dict() for case in supplied.cases]) != _json_bytes([case.to_dict() for case in checked.cases])):
            raise ValueError("invalid seal: supplied cases/records disagree with their verified bytes")
    settings = json.loads(settings_payload)
    result = aggregate_metrics(verified.cases, batch, target=settings["target"], threshold=settings["threshold"],
                               declared_languages=settings["languages"], expected_model_identity=expected_model_identity,
                               n_bins=settings.get("ece_bins", 10))
    result.update({"seal": {"manifest_sha256": verified.manifest_sha256, "payload_sha256": verified.manifest["payload_sha256"],
                             "source_input_sha256": verified.source_dataset.raw_sha256,
                             "schema_identity": SCHEMA_IDENTITY, "importer_identity": IMPORTER_IDENTITY,
                             "grouping_identity": GROUPING_IDENTITY},
                   "audits": _thaw_json(verified.manifest["audits"]), "independence_established": False,
                   "release_ready": False, "execution_scope": "captured_sealed_metrics_only_no_inference_or_guard_execution"})
    return result


def _grouping_record(cases):
    try:
        grouping = group_cases(cases)
    except ValueError as error:
        if "trustworthy family metadata" not in str(error):
            raise
        return {"status": "not_established", "assignment": None, "reason": str(error), "identity": GROUPING_IDENTITY}
    return {"status": "computed_diagnostic", "assignment": grouping.to_dict(), "identity": GROUPING_IDENTITY}


def _partition_record(cases, plan, settings):
    if plan is None:
        return None  # no partition declaration, NOT a release-holdout claim
    if not isinstance(plan, PartitionPlan):
        raise ValueError("invalid partition plan: computed PartitionPlan required")  # noqa: TRY004 -- Invalid-record APIs consistently raise ValueError.
    if plan.seed != settings["seed"]:
        raise ValueError("partition plan seed differs from explicit seal settings seed")
    recomputed = partition_cases(cases, proportions=plan.proportions, seed=plan.seed)
    if _json_bytes(plan.to_dict()) != _json_bytes(recomputed.to_dict()):
        raise ValueError("partition plan identity/order/assignments differ from recomputed connected split")
    return {"sha256": recomputed.sha256, "record": recomputed.to_dict()}


def _verify_partition_record(cases, bound, settings):
    if bound is None:
        return
    if type(bound) is not dict or bound.keys() != {"sha256", "record"} or type(bound["record"]) is not dict:
        raise ValueError("incomplete partition plan manifest")
    record = bound["record"]
    if record.get("seed") != settings["seed"]:
        raise ValueError("partition plan seed differs from explicit seal settings seed")
    order, proportions = record.get("partition_order"), record.get("proportions")
    if (type(order) is not list or not order or any(type(name) is not str for name in order)
            or len(set(order)) != len(order) or type(proportions) is not dict or set(order) != set(proportions)):
        raise ValueError("incomplete partition plan declared order/proportions")
    # Canonical JSON sorts object keys; this explicit list alone defines allocation order.
    ordered_proportions = {name: proportions[name] for name in order}
    recomputed = partition_cases(cases, proportions=ordered_proportions, seed=record.get("seed"))
    if _json_bytes(record) != _json_bytes(recomputed.to_dict()) or bound["sha256"] != recomputed.sha256:
        raise ValueError("partition plan fingerprint/order/settings/assignment mismatch")


def _validated_cases(cases):
    if not isinstance(cases, (list, tuple)) or any(not isinstance(case, Case) for case in cases):
        raise ValueError("invalid cases: expected an ordered list/tuple of Case records")
    cases = tuple(cases)
    ids = [case.id for case in cases]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate case ID; identifiers are not normalized")
    return cases


def _case_payload(cases):
    return b"".join(_json_bytes(case.to_dict()) + b"\n" for case in cases)


@dataclass(frozen=True)
class GroupAssignment:
    ordered_ids: tuple[str, ...]
    components: tuple[tuple[str, ...], ...]
    case_to_group: Mapping
    input_sha256: str
    unresolved_parent_ids: tuple[str, ...]
    identity: str = GROUPING_IDENTITY

    def __post_init__(self):
        object.__setattr__(self, "ordered_ids", tuple(self.ordered_ids))
        object.__setattr__(self, "components", tuple(tuple(component) for component in self.components))
        object.__setattr__(self, "case_to_group", _freeze_json(self.case_to_group))
        object.__setattr__(self, "unresolved_parent_ids", tuple(self.unresolved_parent_ids))

    def to_dict(self):
        return {"identity": self.identity, "ordered_ids": list(self.ordered_ids),
                "components": [list(component) for component in self.components],
                "case_to_group": _thaw_json(self.case_to_group), "input_sha256": self.input_sha256,
                "unresolved_parent_ids": list(self.unresolved_parent_ids),
                "family_trust_basis": "explicit_caller_metadata_not_an_external_provenance_audit",
                "source_family_namespace": ["source", "source_family"],
                "template_family_namespace": "global_exact_template_family",
                "node_aliases": ["id", "variant_id", "parent_id"],
                "legacy_group_id_certifies_independence": False,
                "audits": dict(UNESTABLISHED_AUDITS), "independence_established": False, "release_ready": False}


def group_cases(cases):
    """Conservative connected components from exact, trustworthy declared lineage.

    Source families connect across versions within exact source namespaces;
    versions remain fingerprinted metadata, never boundaries that sever a family.
    Templates and declared duplicate groups are global exact keys.
    Parent/variant IDs are node aliases (including
    shared external parents). Legacy group_id alone is NEVER a family certificate.
    """
    cases = _validated_cases(cases)
    missing = [case.id for case in cases if "family_metadata" in case.coverage_gaps
               or (case.source_family not in (None, "unknown")
                   and (case.source == "unknown" or case.source_version in (None, "unknown")))]
    if missing:
        raise ValueError(f"missing trustworthy family metadata for {missing!r}; group_id/row-random is insufficient")
    parents = list(range(len(cases)))
    def root(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index
    def union(left, right):
        left, right = root(left), root(right)
        if left != right:
            if cases[left].id > cases[right].id:
                left, right = right, left
            parents[right] = left
    keys = {}
    aliases = {case.id for case in cases} | {case.variant_id for case in cases if case.variant_id is not None}
    unresolved = set()
    for index, case in enumerate(cases):
        tokens: list[tuple] = [("node", case.id)]
        for value in (case.parent_id, case.variant_id):
            if value is not None:
                tokens.append(("node", value))
        if case.parent_id is not None and case.parent_id not in aliases:
            unresolved.add(case.parent_id)
        if case.source_family not in (None, "unknown"):
            tokens.append(("source_family", case.source, case.source_family))
        if case.template_family not in (None, "unknown"):
            tokens.append(("template_family", case.template_family))
        if case.near_duplicate_group not in (None, "unknown"):
            tokens.append(("declared_duplicate", case.near_duplicate_group))
        for token in tokens:
            if token in keys:
                union(index, keys[token])
            else:
                keys[token] = index
    members = {}
    for index, case in enumerate(cases):
        members.setdefault(root(index), []).append(case.id)
    components = tuple(sorted(tuple(sorted(values)) for values in members.values()))
    assignment = {}
    for component in components:
        group_id = _sha256(GROUPING_IDENTITY.encode("utf-8") + b"\n" + _json_bytes(list(component)))
        assignment.update({identifier: group_id for identifier in component})
    return GroupAssignment(tuple(case.id for case in cases), components, assignment,
                           _sha256(_case_payload(cases)), tuple(sorted(unresolved)))


def _validate_seed(seed):
    if type(seed) is not int:
        raise ValueError("invalid seed: explicit integer required, no coercion")


def _partition_memberships(cases, partitions):
    if not isinstance(partitions, Mapping) or not partitions:
        raise ValueError("invalid partition coverage: explicit named partitions required")
    copied = _freeze_json(partitions)
    assigned, locations = [], {}
    for name, ids in copied.items():
        if type(name) is not str or not name.strip() or not isinstance(ids, tuple):
            raise ValueError("invalid partition coverage: named ordered ID lists required")
        for identifier in ids:
            if type(identifier) is not str or not identifier.strip():
                raise ValueError("invalid partition coverage: exact string IDs required")
            if identifier in locations:
                raise ValueError(f"duplicate assignment for {identifier!r}")
            assigned.append(identifier)
            locations[identifier] = name
    expected = tuple(case.id for case in cases)
    if len(assigned) != len(expected) or set(assigned) != set(expected):
        raise ValueError("invalid partition coverage: missing or foreign case IDs")
    for name, ids in copied.items():
        if ids != tuple(identifier for identifier in expected if locations[identifier] == name):
            raise ValueError("invalid partition coverage: case order was edited within a partition")
    return copied, locations


def audit_partitions(cases, partitions, *, seed, normalization=TEXT_NORMALIZATION_IDENTITY):
    """Diagnostic connected-group AND exact/named-normalized text leakage audit."""
    _validate_seed(seed)
    descriptor = _normalization_descriptor(normalization)
    cases = _validated_cases(cases)
    grouping = group_cases(cases)
    copied, locations = _partition_memberships(cases, partitions)
    component_leakage = []
    for component in grouping.components:
        names = {locations[identifier] for identifier in component}
        if len(names) > 1:
            component_leakage.append({"case_ids": list(component), "partitions": sorted(names)})
    records = [(case, locations[case.id]) for case in cases]
    exact = _overlap_pairs(records, normalized=False, normalization=normalization)
    normalized = _overlap_pairs(records, normalized=True, normalization=normalization)
    controls = run_overlap_controls(seed=seed, normalization=normalization)
    passed = not component_leakage and not exact and not normalized and controls["passed"]
    return {"passed": passed, "seed": seed, "grouping_identity": grouping.identity,
            "input_sha256": grouping.input_sha256, "ordered_ids": list(grouping.ordered_ids),
            "normalization": descriptor, "component_leakage": component_leakage,
            "exact_text_overlap": exact, "normalized_text_overlap": normalized, "positive_controls": controls,
            "component_count": len(grouping.components),
            "partition_counts": {name: {"rows": len(ids), "components": len({grouping.case_to_group[identifier] for identifier in ids})}
                                 for name, ids in copied.items()},
            "coverage_gaps": ["empty_partition:" + name for name, ids in copied.items() if not ids],
            "checks": {"connected_components": "failed" if component_leakage else "passed",
                       "exact_text_overlap": "failed" if exact else "passed",
                       "normalized_text_overlap": "failed" if normalized else "passed",
                       "positive_controls": "passed" if controls["passed"] else "failed"},
            "audits": dict(UNESTABLISHED_AUDITS), "independence_established": False, "release_ready": False}


def validate_partitions(cases, partitions, *, seed, normalization=TEXT_NORMALIZATION_IDENTITY):
    """Refuse structural coverage defects, connected straddling and text overlap."""
    report = audit_partitions(cases, partitions, seed=seed, normalization=normalization)
    if report["component_leakage"]:
        raise ValueError(f"connected component straddles partitions: {report['component_leakage']!r}")
    if report["exact_text_overlap"] or report["normalized_text_overlap"]:
        raise ValueError("text overlap crosses partitions; exact/named-normalized leakage detected")
    if not report["positive_controls"]["passed"]:
        raise ValueError("overlap positive controls failed; no passing audit can be reported")
    return report


@dataclass(frozen=True)
class PartitionPlan:
    ordered_ids: tuple[str, ...]
    partitions: Mapping
    proportions: Mapping
    seed: int
    grouping: GroupAssignment
    validation: Mapping
    identity: str = PARTITION_IDENTITY

    def __post_init__(self):
        object.__setattr__(self, "ordered_ids", tuple(self.ordered_ids))
        for name in ("partitions", "proportions", "validation"):
            object.__setattr__(self, name, _freeze_json(getattr(self, name)))

    def to_dict(self):
        return {"identity": self.identity, "ordered_ids": list(self.ordered_ids),
                "partition_order": list(self.partitions), "partitions": _thaw_json(self.partitions),
                "proportions": _thaw_json(self.proportions), "seed": self.seed,
                "allocation_unit": "connected_component_not_rows", "grouping": self.grouping.to_dict(),
                "validation": _thaw_json(self.validation), "independence_established": False, "release_ready": False}

    @property
    def sha256(self):
        return _sha256(_json_bytes(self.to_dict()))


def partition_cases(cases, *, proportions, seed):
    """Deterministic group allocation; proportions describe groups, NOT row counts."""
    _validate_seed(seed)
    cases = _validated_cases(cases)
    grouping = group_cases(cases)
    if not isinstance(proportions, Mapping) or not proportions:
        raise ValueError("invalid proportions: explicit named numeric proportions required")
    proportions = _thaw_json(_freeze_json(proportions))
    if (any(type(name) is not str or not name.strip() for name in proportions)
            or any(type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 1
                   for value in proportions.values())):
        raise ValueError("invalid proportions: finite numeric probabilities, not coerced")
    weights = [Fraction(str(value)) for value in proportions.values()]
    if sum(weights) != 1:
        raise ValueError("invalid proportions: explicit proportions must sum exactly to one")
    quotas = [len(grouping.components) * weight for weight in weights]
    counts = [quota.numerator // quota.denominator for quota in quotas]
    remainder_order = sorted(range(len(counts)), key=lambda index: (-(quotas[index] - counts[index]), index))
    for index in remainder_order[:len(grouping.components) - sum(counts)]:
        counts[index] += 1
    components = list(grouping.components)
    random.Random(seed).shuffle(components)
    partitions, offset = {}, 0
    for name, count in zip(proportions, counts):
        selected = {identifier for component in components[offset:offset + count] for identifier in component}
        partitions[name] = tuple(case.id for case in cases if case.id in selected)
        offset += count
    validation = validate_partitions(cases, partitions, seed=seed)
    return PartitionPlan(tuple(case.id for case in cases), partitions, proportions, seed, grouping, validation)


def _normalization_descriptor(normalization):
    if normalization != TEXT_NORMALIZATION_IDENTITY:
        raise ValueError("unknown named normalization; identifiers/settings are not normalized")
    return {"name": normalization, "unicode_data_version": unicodedata.unidata_version,
            "recipe": ["NFKC", "casefold", "collapse_Unicode_whitespace"],
            "removes_zero_width": False, "folds_confusables": False, "normalized_includes_exact": True,
            "text_unit": "original_text_and_each_ordered_role_tagged_turn_no_flattening"}


def normalize_text(text, *, normalization=TEXT_NORMALIZATION_IDENTITY):
    """Named diagnostic view only; the caller's exact source text is untouched."""
    _normalization_descriptor(normalization)
    if type(text) is not str:
        raise ValueError("invalid overlap text: exact string required, no coercion")
    return " ".join(unicodedata.normalize("NFKC", text).casefold().split())


def _text_units(case):
    if case.text is not None and case.text:
        yield {"kind": "original_text"}, case.text
    if case.turns is not None:
        for index, turn in enumerate(case.turns):
            if turn.text:
                yield {"kind": "turn", "index": index, "role": turn.role}, turn.text


def _overlap_pairs(records, *, normalized, normalization):
    buckets = {}
    for case, partition in records:
        for view, text in _text_units(case):
            key = normalize_text(text, normalization=normalization) if normalized else text
            if key:
                buckets.setdefault(key, []).append((case.id, partition, view))
    result = []
    for key, members in buckets.items():
        members.sort(key=lambda member: (member[0], member[1], _json_bytes(member[2])))
        for index, (left_id, left_partition, left_view) in enumerate(members):
            for right_id, right_partition, right_view in members[index + 1:]:
                if left_partition != right_partition:
                    result.append({"left_id": left_id, "right_id": right_id,
                                   "left_partition": left_partition, "right_partition": right_partition,
                                   "left_view": left_view, "right_view": right_view,
                                   "text_sha256": _sha256(key.encode("utf-8"))})
    return sorted(result, key=_json_bytes)


def run_overlap_controls(*, seed, normalization=TEXT_NORMALIZATION_IDENTITY):
    """Exercise this same matcher with synthetic exact/Unicode/negative controls."""
    _validate_seed(seed)
    _normalization_descriptor(normalization)
    token = _sha256(str(seed).encode("utf-8"))[:16]
    pairs = {"exact": ("synthetic exact " + token, "synthetic exact " + token),
             "unicode": ("ＳＹＮＴＨＥＴＩＣ café\t" + token, "synthetic cafe\u0301 " + token),
             "negative": ("synthetic only-left " + token, "synthetic only-right " + token)}
    flags, generated = {}, []
    for name, texts in pairs.items():
        cases = tuple(Case.from_dict({"id": f"synthetic.control.{name}.{index}", "text": text,
                                      "label": "SAFE", "target": "risk", "gold_positive": False,
                                      "language": "unknown", "source": "builtin-synthetic-controls",
                                      "source_id": f"control.{name}.{index}", "license": "internal-test-only",
                                      "group_id": "not-an-independence-certificate", "slices": ["robustness"]})
                      for index, text in enumerate(texts))
        generated.extend(cases)
        records = [(cases[0], "left"), (cases[1], "right")]
        exact = bool(_overlap_pairs(records, normalized=False, normalization=normalization))
        normalized = bool(_overlap_pairs(records, normalized=True, normalization=normalization))
        flags[name] = (exact and normalized if name == "exact" else
                       normalized and not exact if name == "unicode" else not exact and not normalized)
    return {"passed": all(flags.values()), "exact_positive": flags["exact"],
            "unicode_normalized_positive": flags["unicode"], "negative_control": flags["negative"],
            "seed": seed, "synthetic_only": True, "fixture_sha256": _sha256(_case_payload(generated))}


def audit_overlap(candidates, references, *, seed, reference_name, normalization=TEXT_NORMALIZATION_IDENTITY):
    """Compare caller-supplied cohorts; this does not establish baseline/teacher exposure."""
    _validate_seed(seed)
    descriptor = _normalization_descriptor(normalization)
    if type(reference_name) is not str or not reference_name.strip():
        raise ValueError("invalid reference_name: exact nonempty string required")
    _unicode_string(reference_name, "invalid reference_name")
    candidates, references = _validated_cases(candidates), _validated_cases(references)
    records = [(case, "candidate") for case in candidates] + [(case, "reference") for case in references]
    exact = _overlap_pairs(records, normalized=False, normalization=normalization)
    normalized = _overlap_pairs(records, normalized=True, normalization=normalization)
    controls = run_overlap_controls(seed=seed, normalization=normalization)
    id_overlap = sorted({case.id for case in candidates} & {case.id for case in references})
    return {"passed": not exact and not normalized and not id_overlap and controls["passed"],
            "seed": seed, "reference_name": reference_name, "normalization": descriptor,
            "candidate_ordered_ids": [case.id for case in candidates], "reference_ordered_ids": [case.id for case in references],
            "candidate_sha256": _sha256(_case_payload(candidates)), "reference_sha256": _sha256(_case_payload(references)),
            "id_overlap": id_overlap, "exact_text_overlap": exact, "normalized_text_overlap": normalized,
            "positive_controls": controls, "coverage_gaps": {
                "candidate": {case.id: list(case.coverage_gaps) for case in candidates},
                "reference": {case.id: list(case.coverage_gaps) for case in references}},
            "audits": dict(UNESTABLISHED_AUDITS), "independence_established": False, "release_ready": False}
