"""Resume-only receipt destination; preserve the original runner and evidence."""
from . import native_checks
import sys
import subprocess


def main():
    # The fixed original harness still enforces mutex, env, pins and capture.
    pattern = sys.argv[2] if len(sys.argv) > 2 else 'test_*.py'
    if not pattern.startswith('test_') or not pattern.endswith('.py') or '/' in pattern or '\\' in pattern:
        raise ValueError('scoped unittest filename pattern required')
    original_run = subprocess.run
    def scoped_run(command, **kwargs):
        command[command.index('-p') + 1] = pattern
        return original_run(command, **kwargs)
    native_checks.subprocess.run = scoped_run
    native_checks.EVIDENCE = native_checks.REPO / 'artifacts/ml/v-final/offline-preparation/execution-resume-1'
    try:
        return native_checks.main()
    finally:
        native_checks.subprocess.run = original_run


if __name__ == '__main__':
    raise SystemExit(main())
