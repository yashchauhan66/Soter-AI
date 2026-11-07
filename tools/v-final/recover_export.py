#!/usr/bin/env python3
"""Offline serialization recovery for existing v18 candidate weights only."""
from __future__ import annotations

import argparse
import ast
import gc
import linecache
from collections.abc import Mapping
import hashlib
import os
import re
import json
import math
import shutil
from datetime import datetime, timezone
from pathlib import Path
import sys
import tempfile
import time
import traceback
import types
from typing import Any
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
RECOVERY_ROOT = ROOT / "artifacts/ml/v-final/phase1/v18-recovered"
EXPECTED_WEIGHTS_SHA256 = "166733d6004519b3548098cf53b51f649cf46e1b918f1013f2a886d1dfc9059f"
EXPECTED_METADATA_SHA256 = {
    "encoder_config.json": "a7c28f6317cba9894b73c4998537a1e2ab78dd8efe3de0bacd963d9bcc209317",
    "training_stats.json": "44c11d1bebc0a49987b3fd9cec757fbfdb1911731bce015f1c696a8814abb2af",
    "labels.json": "f2ddd325d9e5d63a581ef8e4845524f928687cffcd89b3f68e4d7497ace3155a",
    "calibration.json": "3e029daa948f36f9ac27aa96befa2e967009c094ba8835909c177c87cc018aa5",
    "tokenizer_config/tokenizer.json": "ba8be26de5e1ce82644c8100658a3357a7cd597ce393c344750d3c3f36106753",
    "tokenizer_config/tokenizer_config.json": "6b17a6f2e13aa5f1de8157848d65836fcb8e0ca8beb4f1a0e8d82676a835ea13",
    "tokenizer_config/vocab.txt": "c6149e12b5bee96260c78f51a28f2c2fa029307c404ce7b3238f9d43e24e39cb",
}
REQUIRED_FILES = (
    "pytorch_model.bin", "encoder_config.json", "training_stats.json",
    "labels.json", "calibration.json", "tokenizer_config/tokenizer.json",
    "tokenizer_config/tokenizer_config.json", "tokenizer_config/vocab.txt",
)


class RecoveryError(ValueError):
    """A recovery safety or verification gate failed."""


def _release_exception_frames(error):
    """Release finished traceback consumers, retaining error chains and locations."""
    pending, seen = [error], set()
    while pending:
        current = pending.pop()
        if current is None or id(current) in seen:
            continue
        seen.add(id(current))
        traceback.clear_frames(current.__traceback__)
        pending.extend((current.__cause__, current.__context__))


class _SnapshotResult(dict):
    """Own private source files until their mapped consumers are released."""

    def __init__(self, values=(), *, temporary=None):
        super().__init__(values)
        self._temporary = temporary if temporary is not None else tempfile.TemporaryDirectory(
            prefix="soter-verified-source-", dir=os.environ["TMPDIR"],
        )
        self.snapshot_dir = Path(self._temporary.name)

    def close(self):
        self.clear()
        gc.collect()
        if self._temporary is None:
            return
        delays = (0.05, 0.1, 0.2, 0.4, 0.8, 1.0, 1.5, 2.0)
        for attempt, delay in enumerate(delays):
            try:
                self._temporary.cleanup()
                self._temporary = None
                return
            except OSError as exc:
                if not isinstance(exc, PermissionError) or attempt == len(delays) - 1:
                    rejection = RecoveryError(f"verified snapshot cleanup failed: {exc}")
                    for note in getattr(exc, "__notes__", []):
                        rejection.add_note(note)
                    raise rejection from exc
                time.sleep(delay)

    def __enter__(self):
        return self

    def _finish(self, error):
        _release_exception_frames(error)
        try:
            self.close()
        except RecoveryError as cleanup_error:
            if error is None:
                raise
            error.add_note(f"Required private cleanup rejected: {cleanup_error}")
            for note in getattr(cleanup_error, "__notes__", []):
                error.add_note(note)

    def __exit__(self, exc_type, error, tb):
        self._finish(error)

    def __del__(self):
        if getattr(self, "_temporary", None) is not None:
            self.close()


def validate_paths(source_dir: Path, output_dir: Path):
    source = source_dir.resolve()
    output = output_dir.resolve()
    if not source.is_dir():
        raise RecoveryError(f"source directory does not exist: {source}")
    if output == source or output.is_relative_to(source) or source.is_relative_to(output):
        raise RecoveryError(f"output overlaps source: {output}")
    if not output.is_relative_to(RECOVERY_ROOT.resolve()):
        raise RecoveryError(f"output is outside recovery subtree: {output}")
    if output.exists() or output_dir.is_symlink():
        raise RecoveryError(f"output already exists; choose a new directory: {output}")
    # Reject links/junctions rather than trusting a path that can redirect writes.
    for path in (output_dir, *output_dir.parents):
        if path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction()):
            raise RecoveryError(f"output contains a link or junction: {path}")
    return source, output


class _OutputPath(type(Path())):
    """Keep Path write hooks, but write through an exclusively owned descriptor."""

    def __init__(self, *segments, guard):
        super().__init__(*segments)
        self._guard = guard

    def with_segments(self, *segments):
        return type(self)(*segments, guard=self._guard)

    def open(self, mode="r", buffering=-1, encoding=None, errors=None, newline=None) -> Any:
        if mode[0] not in "wax":
            return super().open(mode, buffering, encoding, errors, newline)
        fd = self._guard.write_fd(self)
        try:
            if mode[0] == "w":
                os.ftruncate(fd, 0)
            os.lseek(fd, 0, os.SEEK_END if mode[0] == "a" else os.SEEK_SET)
            return os.fdopen(fd, mode, buffering, encoding, errors, newline)
        except BaseException:
            os.close(fd)
            raise


class _OutputGuard(set):
    """Own output creation and pin its native directory chain until all writes end."""

    def __init__(self, output):
        super().__init__()
        self.output = output.absolute()
        self._handles = []
        self._directories = set()
        self._file_fds = {}

    def _pin(self, path, share=0x01):
        import ctypes
        from ctypes import wintypes

        class AttributeTag(ctypes.Structure):
            _fields_ = [("attributes", wintypes.DWORD), ("tag", wintypes.DWORD)]

        # OPEN_REPARSE_POINT opens the entry itself, not a redirected target.
        # Omit SHARE_DELETE and SHARE_WRITE: neither rename nor reparse-point
        # mutation may redirect the path while path-based exporters consume it.
        # GENERIC_READ participates in Windows sharing checks; a metadata-only
        # FILE_READ_ATTRIBUTES handle does not prevent directory replacement.
        handle = self._kernel.CreateFileW(str(path), 0x80000000, share, None, 3, 0x02200000, None)
        if handle == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        self._handles.append(handle)
        info = AttributeTag()
        if not self._kernel.GetFileInformationByHandleEx(handle, 9, ctypes.byref(info), ctypes.sizeof(info)):
            raise ctypes.WinError(ctypes.get_last_error())
        if info.attributes & 0x400 or not info.attributes & 0x10:
            raise RecoveryError(f"output contains a link, junction or non-directory: {path}")

    def __enter__(self):
        if os.name != "nt":
            raise RecoveryError("race-safe output anchoring requires native Windows directory handles")
        import ctypes
        from ctypes import wintypes

        self._kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        self._kernel.CreateFileW.argtypes = (
            wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID,
            wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE,
        )
        self._kernel.CreateFileW.restype = wintypes.HANDLE
        self._kernel.GetFileInformationByHandleEx.argtypes = (
            wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD,
        )
        self._kernel.GetFileInformationByHandleEx.restype = wintypes.BOOL
        self._kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
        self._kernel.CloseHandle.restype = wintypes.BOOL
        try:
            # Top down: every existing prefix is pinned before looking up or
            # creating its child. Missing parents remain inside the pinned chain.
            for path in reversed(self.output.parents):
                try:
                    self._pin(path)
                except FileNotFoundError:
                    path.mkdir(exist_ok=True)
                    self._pin(path)
        except BaseException as exc:
            self.__exit__(type(exc), exc, exc.__traceback__)
            if isinstance(exc, OSError):
                rejection = RecoveryError(f"output anchoring failed: {exc}")
                for note in getattr(exc, "__notes__", []):
                    rejection.add_note(note)
                raise rejection from exc
            raise
        return self

    def add(self, output):
        # Called only after exclusive mkdir succeeds; rejected competitors never
        # gain failure-record ownership. Pin before allowing any bundle writes.
        import ctypes

        self._pin(output)
        strict_index = len(self._handles) - 1
        # Child atomic renames require WRITE sharing on their immediate parent.
        # First make this directory permanently nonempty while held: NTFS rejects
        # junction installation on a nonempty directory, and this open marker
        # cannot be deleted/renamed. Keep the marker as ordinary bundle evidence.
        marker = self._kernel.CreateFileW(
            str(output / ".recovery-directory-anchor"), 0x80000000, 0x01, None, 1, 0x00200000, None,
        )
        if marker == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        self._handles.append(marker)
        self._pin(output, share=0x03)
        if not self._kernel.CloseHandle(self._handles[strict_index]):
            raise ctypes.WinError(ctypes.get_last_error())
        self._handles.pop(strict_index)
        super().add(output)
        self._directories.add(output.absolute())

    def directory(self, path):
        """Pin each descendant before resolving or writing through its children."""
        path = path.absolute()
        relative = path.relative_to(self.output)
        if ".." in relative.parts or self.output not in self._directories:
            raise RecoveryError(f"unowned output directory: {path}")
        current = self.output
        for name in relative.parts:
            current = current / name
            if current not in self._directories:
                try:
                    current.mkdir(exist_ok=False)
                except FileExistsError:
                    pass
                # Strict sharing is sufficient for sidecar directories: they
                # need child writes, not child atomic replacement. A junction
                # inserted during mkdir is opened without following it/rejected.
                self._pin(current)
                self._directories.add(current)

    def file_path(self, path):
        return _OutputPath(path, guard=self)

    def _create_file(self, path, access, share):
        import ctypes

        self.directory(path.parent)
        # CREATE_NEW never follows or truncates an existing link/file. The
        # directory chain is already pinned before resolving this final name.
        handle = self._kernel.CreateFileW(str(path), access, share, None, 1, 0x00200000, None)
        if handle == ctypes.c_void_p(-1).value:
            raise ctypes.WinError(ctypes.get_last_error())
        return handle

    def write_fd(self, path):
        import msvcrt

        key = Path(path).absolute()
        if key not in self._file_fds:
            # Only this descriptor writes Python-owned destinations. Do not
            # grant external write/delete sharing or reopen the pathname.
            handle = self._create_file(key, 0xC0000000, 0x01)
            try:
                fd = msvcrt.open_osfhandle(handle, os.O_RDWR | os.O_BINARY)
            except BaseException:
                self._kernel.CloseHandle(handle)
                raise
            self._file_fds[key] = fd
        return os.dup(self._file_fds[key])

    def native_destination(self, path):
        # The fixed exporter reopens these two files for writing. Reserve both
        # exclusively before entering it; omit DELETE sharing throughout export
        # so neither can be replaced with a link to an existing outside file.
        self._handles.append(self._create_file(path, 0x80000000, 0x03))

    def release_file(self, path):
        fd = self._file_fds.pop(Path(path).absolute(), None)
        if fd is not None:
            os.close(fd)

    def __exit__(self, exc_type, error, tb):
        import ctypes

        failures = []
        while self._file_fds:
            _, fd = self._file_fds.popitem()
            try:
                os.close(fd)
            except OSError as exc:
                failures.append(str(exc))
        while self._handles:
            if not self._kernel.CloseHandle(self._handles.pop()):
                failures.append(str(ctypes.WinError(ctypes.get_last_error())))
        if failures:
            diagnostic = "output handle release failed: " + "; ".join(failures)
            if error is not None:
                error.add_note(diagnostic)
            else:
                raise RecoveryError(diagnostic)


def load_metadata(source: Path):
    for relative in REQUIRED_FILES:
        path = source / relative
        if not path.is_file():
            raise RecoveryError(f"required source file is missing: {relative}")
    # The verified v18 candidate has no additional tokenizer or threshold metadata.
    tokenizer_files = {"tokenizer.json", "tokenizer_config.json", "vocab.txt"}
    for path in (source / "tokenizer_config").iterdir():
        if path.name not in tokenizer_files:
            raise RecoveryError(f"unexpected source metadata: tokenizer_config/{path.name}")
    thresholds = source / "thresholds.json"
    if thresholds.exists() or thresholds.is_symlink():
        raise RecoveryError("unexpected source metadata: thresholds.json")
    data, captured = {}, {}
    for name in ("encoder_config", "training_stats", "labels", "calibration"):
        try:
            captured[f"{name}.json"] = (source / f"{name}.json").read_bytes()
            data[name] = json.loads(captured[f"{name}.json"].decode("utf-8"))
        except (OSError, ValueError) as exc:
            raise RecoveryError(f"invalid JSON in {name}.json: {exc}") from exc
        if not isinstance(data[name], dict):
            raise RecoveryError(f"invalid JSON object in {name}.json")
    stats, config = data["training_stats"], data["encoder_config"]
    if stats.get("product_version") != "v18-student-candidate":
        raise RecoveryError("source must identify v18-student-candidate")
    label_names = stats.get("labels")
    if (not isinstance(label_names, list) or len(label_names) != 14
            or label_names[0] != "SAFE" or len(set(label_names)) != 14
            or data["labels"] != {str(i): name for i, name in enumerate(label_names)}
            or stats.get("num_labels") != 14):
        raise RecoveryError("source label order does not match the classifier contract")
    if config.get("model_type") != "distilbert":
        raise RecoveryError("encoder model_type must be distilbert")
    fields = ("dim", "hidden_dim", "n_heads", "n_layers", "vocab_size", "max_position_embeddings")
    if (any(type(config.get(key)) is not int or config[key] <= 0 for key in fields)
            or config["dim"] % config["n_heads"] != 0):
        raise RecoveryError("invalid encoder configuration")
    arch = stats.get("architecture", {})
    dropout = arch.get("dropout")
    if (arch.get("hidden_size") != config["dim"]
            or arch.get("head_layers") != [config["dim"], 512, 256, 14]
            or arch.get("max_length") != 256 or not arch.get("aux_attack_head")
            or type(dropout) not in (int, float) or not math.isfinite(dropout)
            or not 0 <= dropout < 1 or config["max_position_embeddings"] < 256):
        raise RecoveryError("saved classifier architecture is inconsistent")
    temperature = data["calibration"].get("temperature")
    if type(temperature) not in (int, float) or not math.isfinite(temperature) or temperature <= 0:
        raise RecoveryError("calibration temperature must be a positive finite number")
    for relative, expected in EXPECTED_METADATA_SHA256.items():
        if relative not in captured:
            captured[relative] = (source / relative).read_bytes()
        observed = hashlib.sha256(captured[relative]).hexdigest()
        if observed != expected:
            raise RecoveryError(f"source metadata fingerprint mismatch: {relative}")
    data["label_names"] = label_names
    data["temperature"] = float(temperature)
    data["_verified_metadata"] = types.MappingProxyType(captured)
    return data


def load_state(source: Path, expected_sha256: str = EXPECTED_WEIGHTS_SHA256):
    if re.fullmatch(r"[0-9a-f]{64}", expected_sha256) is None:
        raise RecoveryError("expected source SHA256 must be exactly 64 lowercase hex characters")
    path = source / "pytorch_model.bin"
    snapshot = _SnapshotResult()
    state = tensor = None
    try:
        snapshot_path = snapshot.snapshot_dir / "pytorch_model.bin"
        fingerprint = hashlib.sha256()
        with path.open("rb") as stream, snapshot_path.open("xb") as captured:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                captured.write(block)
                fingerprint.update(block)
        digest = fingerprint.hexdigest()
        if digest != expected_sha256:
            raise RecoveryError(f"source SHA256 mismatch: expected {expected_sha256}, got {digest}")
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
        import torch
        try:
            state = torch.load(snapshot_path, weights_only=True, map_location="cpu", mmap=True)
        except Exception as exc:
            raise RecoveryError(f"weights_only CPU loading failed: {type(exc).__name__}: {exc}") from exc
        if not isinstance(state, Mapping) or not state or any(
            not isinstance(name, str) or not isinstance(value, torch.Tensor)
            for name, value in state.items()
        ):
            raise RecoveryError("source state must be a nonempty string-to-tensor mapping")
        snapshot.update(state)
        state = None
        for name, tensor in snapshot.items():
            if tensor.dtype != torch.float32 or tensor.device.type != "cpu":
                raise RecoveryError(f"source tensor must be CPU float32 without casting: {name}")
            if not torch.isfinite(tensor).all().item():
                raise RecoveryError(f"source tensor contains nonfinite values: {name}")
        return snapshot, digest
    except BaseException as exc:
        state = tensor = None
        snapshot._finish(exc)
        raise


def state_sha256(state):
    digest = hashlib.sha256()
    for name in sorted(state):
        tensor = state[name].detach()
        descriptor = json.dumps([name, str(tensor.dtype), list(tensor.shape)], separators=(",", ":"))
        digest.update(descriptor.encode("utf-8") + b"\n")
        digest.update(memoryview(tensor.numpy()).cast("B"))
    return digest.hexdigest()


def repository_definitions():
    # The live v14 trainer lacks encoder_config; the verified, local v18 bundle
    # contains its original config-based constructor. Execute ONLY the two
    # reviewed classes and their constants, never trainer imports or main().
    member = "scripts/ml/train-soterllm-v14-fullft.py"
    bundle_path = ROOT / "artifacts/ml/soterai-v18-colab-bundle.zip"
    expected = "279bffa4e2b2990c535387d819ef1da533e7b2eb9c5779a7a8086727f81918da"
    try:
        with zipfile.ZipFile(bundle_path) as bundle:
            payload = bundle.read(member)
    except (OSError, KeyError, zipfile.BadZipFile) as exc:
        raise RecoveryError(f"verified local v18 trainer bundle unavailable: {exc}") from exc
    digest = hashlib.sha256(payload).hexdigest()
    if digest != expected:
        raise RecoveryError(f"v18 bundled trainer SHA256 mismatch: {digest}")
    source_text = payload.decode("utf-8")
    tree = ast.parse(source_text)
    current_text = (ROOT / member).read_text(encoding="utf-8")
    current_tree = ast.parse(current_text)
    names = {"HEAD_HIDDEN_1", "HEAD_HIDDEN_2", "ALL_LABELS", "SoterLLMv14", "OnnxWrapper"}
    def declarations(parsed):
        return {node.name if isinstance(node, ast.ClassDef) else node.targets[0].id: node
                for node in parsed.body
                if isinstance(node, ast.ClassDef) and node.name in names
                or isinstance(node, ast.Assign) and len(node.targets) == 1
                and isinstance(node.targets[0], ast.Name) and node.targets[0].id in names}
    chosen, current = declarations(tree), declarations(current_tree)
    if set(chosen) != names or set(current) != names:
        raise RecoveryError("repository model declarations are incomplete")
    for name in names - {"SoterLLMv14"}:
        if ast.dump(chosen[name], include_attributes=False) != ast.dump(current[name], include_attributes=False):
            raise RecoveryError(f"live and bundled repository definitions disagree: {name}")
    def methods(node):
        return {item.name: item for item in node.body if isinstance(item, ast.FunctionDef)}
    saved_methods, live_methods = methods(chosen["SoterLLMv14"]), methods(current["SoterLLMv14"])
    for name in ("encode", "forward"):
        if ast.dump(saved_methods[name]) != ast.dump(live_methods[name]):
            raise RecoveryError(f"live and bundled classifier {name} disagree")
    if ([ast.dump(item) for item in saved_methods["__init__"].body[2:]]
            != [ast.dump(item) for item in live_methods["__init__"].body[2:]]):
        raise RecoveryError("live and bundled classifier topology disagree")
    import torch
    from transformers import AutoModel
    origin = f"{bundle_path.as_posix()}!{member}"
    module = types.ModuleType("soter_v18_recovery_definition")
    module.__dict__.update(torch=torch, nn=torch.nn, AutoModel=AutoModel)
    sys.modules[module.__name__] = module
    linecache.cache[origin] = (len(source_text), None, source_text.splitlines(keepends=True), origin)
    selected = [node for node in tree.body if node in chosen.values()]
    exec(compile(ast.Module(body=selected, type_ignores=[]), origin, "exec"), module.__dict__)
    return module, {
        "definition_source": origin, "definition_source_sha256": digest,
        "live_trainer_path": str(ROOT / member),
        "live_trainer_sha256": hashlib.sha256(current_text.encode("utf-8")).hexdigest(),
        "live_topology_and_wrapper_match_bundle": True,
        "construction": "SoterLLMv14(encoder_config=DistilBertConfig.from_dict(saved_config)); AutoModel.from_config",
        "executed_declarations_only": sorted(names),
    }


def load_model(source: Path, expected_sha256: str = EXPECTED_WEIGHTS_SHA256):
    metadata = load_metadata(source)
    state, source_digest = load_state(source, expected_sha256)
    loaded = _SnapshotResult(temporary=state._temporary)
    state._temporary = None
    model = wrapper = loaded_state = None
    try:
        for relative, payload in metadata["_verified_metadata"].items():
            target = loaded.snapshot_dir / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as stream:
                stream.write(payload)
        import torch
        from transformers import AutoTokenizer, DistilBertConfig
        definitions, provenance = repository_definitions()
        if metadata["label_names"] != definitions.ALL_LABELS:
            raise RecoveryError("source label order differs from the exact repository model")
        config = DistilBertConfig.from_dict(metadata["encoder_config"])
        model = definitions.SoterLLMv14(
            metadata["training_stats"]["base_model"], len(metadata["label_names"]),
            dropout=metadata["training_stats"]["architecture"]["dropout"],
            grad_checkpoint=False, encoder_config=config,
        )
        try:
            model.load_state_dict(state, strict=True, assign=True)
        except RuntimeError as exc:
            raise RecoveryError(f"strict state loading failed: {exc}") from exc
        model.eval()
        model.requires_grad_(False)
        loaded_state = model.state_dict()
        if set(loaded_state) != set(state) or any(not torch.equal(state[k], loaded_state[k]) for k in state):
            raise RecoveryError("loaded model changed source tensor values")
        source_state_digest = state_sha256(state)
        loaded_state_digest = state_sha256(loaded_state)
        info = {
            "source_weights_path": str(source / "pytorch_model.bin"), "source_sha256": source_digest,
            "source_weights_bytes": (loaded.snapshot_dir / "pytorch_model.bin").stat().st_size,
            "state_tensors": len(state), "state_elements": sum(t.numel() for t in state.values()),
            "source_state_sha256": source_state_digest, "loaded_state_sha256": loaded_state_digest,
            "all_source_tensors_equal_loaded": True, "strict_state_load": True,
            "weights_only": True, "map_location": "cpu", "dtype": "float32",
            "mmap": True, "strict_assign": True,
            "architecture_provenance": provenance,
        }
        tokenizer = AutoTokenizer.from_pretrained(
            str(loaded.snapshot_dir / "tokenizer_config"), local_files_only=True, trust_remote_code=False,
        )
        vocab = tokenizer.get_vocab()
        words = metadata["_verified_metadata"]["tokenizer_config/vocab.txt"].decode("utf-8").splitlines()
        if (len(vocab) != config.vocab_size or len(words) != len(vocab)
                or any(vocab.get(word) != index for index, word in enumerate(words))):
            raise RecoveryError("saved tokenizer JSON and vocab.txt do not match encoder vocabulary")
        wrapper = definitions.OnnxWrapper(model, metadata["temperature"]).eval()
        loaded.update(model=model, wrapper=wrapper, tokenizer=tokenizer, metadata=metadata, info=info)
        state.clear()
        return loaded
    except BaseException as exc:
        state.clear()
        model = wrapper = loaded_state = None
        loaded._finish(exc)
        raise


def _record_failure(output, error, owned_outputs):
    """Persist rejection, or attach the persistence refusal to its diagnostic."""
    try:
        owned_outputs.file_path(output / "RECOVERY_FAILED.json").write_text(
            json.dumps({"status": "failed", "error_type": type(error).__name__,
                        "error": str(error), "notes": getattr(error, "__notes__", []),
                        "release_ready": False}, indent=2), encoding="utf-8",
        )
    except OSError as recording_error:
        error.add_note(f"Failure record could not be written: {type(recording_error).__name__}: {recording_error}")


def export_bundle(loaded, output: Path, *, _owned_outputs: _OutputGuard | None = None):
    """Verify serialization; return its manifest without publishing final success."""
    if _owned_outputs is None:
        with _OutputGuard(output) as owned_outputs:
            return export_bundle(loaded, output, _owned_outputs=owned_outputs)
    import numpy as np
    import onnx
    import onnxruntime as ort
    import torch
    import transformers

    output.parent.mkdir(parents=True, exist_ok=True)
    required_free = loaded["info"]["source_weights_bytes"] * 3 + 100 * 1024 * 1024
    if shutil.disk_usage(output.parent).free < required_free:
        raise RecoveryError(f"insufficient disk space for isolated export: need {required_free} bytes")
    output.mkdir(exist_ok=False)
    if _owned_outputs is not None:
        _owned_outputs.add(output)
    model_path = output / "model.onnx"
    sample = loaded["tokenizer"](
        ["Please summarize this customer support note in two sentences.", "Namaste."],
        return_tensors="pt", padding=True, truncation=True, max_length=256,
    )
    batch = torch.export.Dim("batch", min=1, max=16)
    sequence = torch.export.Dim("sequence", min=2, max=256)
    try:
        _owned_outputs.native_destination(model_path)
        _owned_outputs.native_destination(output / "model.onnx.data")
        with torch.no_grad():
            torch.onnx.export(
                loaded["wrapper"], (sample["input_ids"], sample["attention_mask"]),
                str(model_path), input_names=["input_ids", "attention_mask"],
                output_names=["logits"], opset_version=20, dynamo=True,
                external_data=True, optimize=False, report=False,
                verify=False, profile=False, dump_exported_program=False,
                dynamic_shapes=({0: batch, 1: sequence}, {0: batch, 1: sequence}),
                artifacts_dir=str(output),
            )
        onnx.checker.check_model(str(model_path), full_check=True)
        options = ort.SessionOptions()
        options.intra_op_num_threads, options.inter_op_num_threads = 2, 1
        session = ort.InferenceSession(str(model_path), sess_options=options,
                                       providers=["CPUExecutionProvider"])
        if ([(item.name, item.type) for item in session.get_inputs()]
                != [("input_ids", "tensor(int64)"), ("attention_mask", "tensor(int64)")]
                or [item.name for item in session.get_outputs()] != ["logits"]):
            raise RecoveryError("exported inputs/outputs violate the serving contract")
        checks = []
        cases = [
            ("short_batch1", ["What is the capital of France?"], False),
            ("padded256_batch1", ["What is the capital of France?"], True),
            ("varied_batch2", ["Namaste, meri booking ka status kya hai?",
                               "Summarize this support email."], False),
            ("padded256_batch2", ["Namaste, meri booking ka status kya hai?",
                                   "Summarize this support email."], True),
        ]
        for name, texts, fixed in cases:
            encoded = loaded["tokenizer"](
                texts, return_tensors="pt", truncation=True, max_length=256,
                padding="max_length" if fixed else True,
            )
            feed = {key: encoded[key].numpy().astype(np.int64, copy=False)
                    for key in ("input_ids", "attention_mask")}
            actual = session.run(["logits"], feed)[0]
            with torch.inference_mode():
                reference = loaded["wrapper"](
                    encoded["input_ids"], encoded["attention_mask"],
                ).numpy()
            if actual.shape != reference.shape or not np.isfinite(actual).all():
                raise RecoveryError(f"invalid ONNX logits for {name}")
            difference = float(np.max(np.abs(actual - reference)))
            argmax_equal = bool(np.array_equal(actual.argmax(axis=1), reference.argmax(axis=1)))
            try:
                np.testing.assert_allclose(actual, reference, atol=1e-4, rtol=1e-4)
            except AssertionError as exc:
                raise RecoveryError(f"numerical parity failed for {name}: {difference}: {exc}") from exc
            if difference > 0.001 or not argmax_equal:
                raise RecoveryError(f"logit/argmax parity failed for {name}: {difference}")
            checks.append({"name": name, "shape": list(feed["input_ids"].shape),
                           "max_abs_logit_difference": difference,
                           "argmax_equal": argmax_equal, "allclose": True})
        if state_sha256(loaded["model"].state_dict()) != loaded["info"]["source_state_sha256"]:
            raise RecoveryError("export altered learned parameter values")
        for relative in EXPECTED_METADATA_SHA256:
            target = _owned_outputs.file_path(output / relative)
            _owned_outputs.directory(target.parent)
            target.write_bytes(loaded["metadata"]["_verified_metadata"][relative])
        artifact_files = []
        for path in sorted(output.rglob("*")):
            if path.is_file():
                with path.open("rb") as stream:
                    digest = hashlib.file_digest(stream, "sha256").hexdigest()
                artifact_files.append({"path": path.relative_to(output).as_posix(),
                                       "bytes": path.stat().st_size, "sha256": digest})
        copied_fingerprints = {item["path"]: item["sha256"] for item in artifact_files}
        for relative, expected in EXPECTED_METADATA_SHA256.items():
            if copied_fingerprints.get(relative) != expected:
                raise RecoveryError(f"exported metadata fingerprint mismatch: {relative}")
        model_digest = next(item["sha256"] for item in artifact_files if item["path"] == "model.onnx")
        manifest = {
            **loaded["info"], "status": "verified_serialization_recovery",
            "created_utc": datetime.now(timezone.utc).isoformat(),
            "output_directory": str(output), "model_sha256": model_digest,
            "onnx_checker_passed": True, "temperature": loaded["metadata"]["temperature"],
            "temperature_applications": 1, "learned_parameter_changes": False,
            "exporter": {"dynamo": True, "opset": 20, "external_data": True,
                         "optimize": False},
            "runtime": {"python": sys.version, "torch": torch.__version__,
                        "transformers": transformers.__version__, "onnx": onnx.__version__,
                        "onnxruntime": ort.__version__, "provider": "CPUExecutionProvider",
                        "threads": 2},
            "parity": {"cases": checks, "atol": 1e-4, "rtol": 1e-4,
                       "max_abs_logit_difference": max(item["max_abs_logit_difference"] for item in checks)},
            "artifact_files": artifact_files,
            "release_ready": False,
            "limitations": ["Serialization parity only; no new training or accuracy claim.",
                            "CPU only; production signature/trust gate and real serving not tested.",
                            "Original broken ONNX artifacts left untouched."],
        }
        return manifest
    except Exception as exc:
        # Preserve a failed isolated attempt; never reuse it or edit the source.
        _record_failure(output, exc, _owned_outputs)
        if isinstance(exc, RecoveryError):
            raise
        rejection = RecoveryError(f"ONNX export/verification failed: {type(exc).__name__}: {exc}")
        for note in getattr(exc, "__notes__", []):
            rejection.add_note(note)
        raise rejection from exc


def _recover_bundle(source, output):
    """Complete consumption and required private cleanup before final publication."""
    with _OutputGuard(output) as owned_outputs:
        return _recover_anchored(source, output, owned_outputs)


def _recover_anchored(source, output, owned_outputs):
    """Keep directory anchors alive through success and failure publication."""
    try:
        with load_model(source) as loaded:
            manifest = export_bundle(loaded, output, _owned_outputs=owned_outputs)
        final_path = owned_outputs.file_path(output / "recovery_manifest.json")
        # A direct write can fail at close after leaving complete readable bytes.
        # The canonical path must therefore remain non-verified until commit.
        final_path.write_text(
            json.dumps({"status": "publication_pending", "verified": False,
                        "release_ready": False}, indent=2), encoding="utf-8",
        )
        # A .pending file is never an authoritative manifest. Flush and close
        # it before atomically publishing; retain interrupted staging evidence.
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=output, prefix=".recovery-",
            suffix=".pending", delete=False,
        ) as staged:
            staged.write(json.dumps(manifest, indent=2, allow_nan=False))
            staged.flush()
            os.fsync(staged.fileno())
            staged_path = staged.name
        # Replacing the directory entry does not write through a colliding
        # hardlink/reparse target. Release our destination only for this rename.
        owned_outputs.release_file(final_path)
        os.replace(staged_path, final_path)
        return manifest
    except Exception as exc:
        if output in owned_outputs:
            _record_failure(output, exc, owned_outputs)
        if isinstance(exc, RecoveryError):
            raise
        rejection = RecoveryError(f"recovery finalization failed: {type(exc).__name__}: {exc}")
        for note in getattr(exc, "__notes__", []):
            rejection.add_note(note)
        raise rejection from exc


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--expected-source-sha256", default=EXPECTED_WEIGHTS_SHA256)
    args = parser.parse_args(argv)
    try:
        if re.fullmatch(r"[0-9a-f]{64}", args.expected_source_sha256) is None:
            raise RecoveryError("expected source SHA256 must be exactly 64 lowercase hex characters")
        if args.expected_source_sha256 != EXPECTED_WEIGHTS_SHA256:
            raise RecoveryError(
                f"expected source SHA256 must equal the fixed v18 digest: {EXPECTED_WEIGHTS_SHA256}"
            )
        source, output = validate_paths(args.source_dir, args.output_dir)
        load_metadata(source)
        import torch
        torch.set_num_threads(2)
        manifest = _recover_bundle(source, output)
    except RecoveryError as exc:
        print(f"[recovery rejected] {exc}", file=sys.stderr)
        for note in getattr(exc, "__notes__", []):
            print(f"[recovery detail] {note}", file=sys.stderr)
        return 2
    print(json.dumps({"status": manifest["status"], "output_directory": str(output),
                      "source_sha256": manifest["source_sha256"],
                      "model_sha256": manifest["model_sha256"],
                      "max_abs_logit_difference": manifest["parity"]["max_abs_logit_difference"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
