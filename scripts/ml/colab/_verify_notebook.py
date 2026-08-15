"""Verify soterllm-v7-train.ipynb is valid JSON and every code cell is real Python.

Colab reports a broken notebook as a vague load failure, and a cell with a syntax
error only surfaces when you run it — often after the GPU is already attached and
the runtime clock is burning. Cheaper to check here.

IPython strips lines starting with ! or % before compiling, so this mimics that
before parsing; otherwise the legitimate `!pip install` lines look like syntax
errors. Backslash-continued shell magics (the multi-line `!python train...` call)
leave dangling argument lines behind, which get the same treatment.
"""

import ast
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))                    # scripts/ml/colab
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))       # project root
NB = os.path.join(HERE, "soterllm-v7-train.ipynb")


def strip_magics(src: str) -> str:
    out, in_magic = [], False
    for line in src.split("\n"):
        if re.match(r"^\s*[!%]", line):
            in_magic = line.rstrip().endswith("\\")
            out.append("pass")
        elif in_magic:
            in_magic = line.rstrip().endswith("\\")
            out.append("pass")
        else:
            out.append(line)
    return "\n".join(out)


def main() -> int:
    try:
        nb = json.load(open(NB, encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"FAIL: notebook is not valid JSON: {e}")
        return 1

    print(f"nbformat {nb['nbformat']}.{nb['nbformat_minor']}  cells {len(nb['cells'])}")
    if nb.get("metadata", {}).get("accelerator") != "GPU":
        print("WARN: metadata.accelerator is not GPU")

    failed = False
    for i, cell in enumerate(nb["cells"]):
        src = "".join(cell["source"])
        if cell["cell_type"] != "code":
            print(f"  {i}  markdown  {len(src):5} chars  OK")
            continue
        try:
            ast.parse(strip_magics(src))
            print(f"  {i}  code      {len(src):5} chars  OK")
        except SyntaxError as e:
            failed = True
            line = (src.split("\n")[e.lineno - 1] if e.lineno else "")[:100]
            print(f"  {i}  code      SYNTAX ERROR line {e.lineno}: {e.msg}\n       >> {line}")

    # The bundle the notebook pins must be the one sitting in the project root,
    # or the runtime warns on a hash the user cannot reproduce.
    import hashlib

    # Torch 2.9's ONNX exporter requires onnxscript; its absence crashes the run
    # AFTER training (45+ min of GPU) at the export stage. Cell 2 must install it.
    cell2 = "".join(nb["cells"][2]["source"])
    if "onnxscript" not in cell2:
        failed = True
        print("\nFAIL: cell 2 does not install onnxscript — export will crash post-training")
    # The recovery cell must survive edits: without it, a crashed export means
    # re-running 45+ minutes of training instead of a 2-minute re-export.
    sources = ["".join(c["source"]) for c in nb["cells"]]
    if not any("4b/5" in s for s in sources):
        failed = True
        print("\nFAIL: recovery cell 4b is missing (re-export without retraining)")
    if not any("pytorch_model.bin" in s for s in sources):
        failed = True
        print("FAIL: nothing references pytorch_model.bin — recovery cannot find the checkpoint")

    m = re.search(r'EXPECTED_SHA = "([0-9a-f]{64})"', cell2)
    bundle = os.path.join(ROOT, "soterai-train-bundle.zip")
    if m and os.path.exists(bundle):
        actual = hashlib.sha256(open(bundle, "rb").read()).hexdigest()
        if actual == m.group(1):
            print(f"\nbundle sha256 matches the notebook pin: {actual[:16]}...")
        else:
            failed = True
            print(f"\nFAIL: notebook pins {m.group(1)[:16]}... but bundle is {actual[:16]}...")
    elif not m:
        failed = True
        print("\nFAIL: could not find EXPECTED_SHA in cell 2")
    else:
        failed = True
        print(f"\nFAIL: no bundle at {bundle} — run scripts/ml/colab/_rebuild_bundle.py")

    # rsync is not guaranteed present on a Colab image. The Drive mirror is the only
    # thing between a recycled runtime and another lost 45-minute train, so it must
    # not depend on a binary that may be missing — and, worse, fail quietly.
    # Match an invocation, not the word: the cells legitimately explain in comments
    # why shutil is used *instead of* rsync, and that prose must not trip the check.
    for i, s in enumerate(sources):
        if re.search(r"""["']rsync["']|^\s*!\s*rsync""", s, re.M):
            failed = True
            print(f"FAIL: cell {i} shells out to rsync — use shutil, it may not exist")

    # Cross-references must name the cell TITLE, not a number: adding the recovery
    # cell shifted every number, which is how "run cell 5" started pointing at the
    # wrong cell. Colab numbers cells 1..N by position, so a bare number rots.
    for i, s in enumerate(sources):
        for bad in re.findall(r"run cell \d\S*", s):
            failed = True
            print(f"FAIL: cell {i} says '{bad}' — reference the cell title instead")

    # The mirror must be reachable from the recovery path too, or a wiped /content
    # is unrecoverable even though a Drive copy exists.
    mirror_path = "/content/drive/MyDrive/soterai-v7-artifacts"
    writers = [i for i, s in enumerate(sources) if mirror_path in s]
    if len(writers) < 2:
        failed = True
        print(f"FAIL: {mirror_path} in {len(writers)} cell(s); need both write + restore")

    print("\nColab numbers these 1..N — use these numbers when giving steps:")
    for i, cell in enumerate(nb["cells"]):
        head = "".join(cell["source"]).lstrip("#").strip().split("\n")[0][:56]
        print(f"  Colab cell {i + 1}  ({cell['cell_type'][:4]})  {head}")

    print("\nALL CELLS PARSE" if not failed else "\nFAILED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
