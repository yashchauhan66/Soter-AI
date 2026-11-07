"""Capture release metadata only: never install/download packages or weights."""
import json
from pathlib import Path
import shutil
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
VERSIONS = {'torch': '2.6.0', 'transformers': '4.48.3', 'numpy': '2.1.3',
            'tokenizers': '0.21.0', 'huggingface-hub': '0.28.1', 'safetensors': '0.5.2',
            'onnx': '1.17.0', 'onnxruntime': '1.20.1', 'nbformat': '5.10.4',
            'scikit-learn': '1.6.1', 'packaging': '24.2'}


def main():
    assert shutil.disk_usage(str(ROOT)).free >= 933930572
    result = {}
    for name, version in VERSIONS.items():
        url = f'https://pypi.org/pypi/{name}/{version}/json'
        with urllib.request.urlopen(url, timeout=30) as response:
            data = json.load(response)
        info = data['info']
        assert info['version'] == version
        result[name] = {'version': version, 'url': url, 'requires_python': info['requires_python'],
                        'requires_dist': info['requires_dist'],
                        'linux_python312_wheel_examples': [x['filename'] for x in data['urls']
                            if ('cp312' in x['filename'] and ('linux' in x['filename'] or 'manylinux' in x['filename']))
                            or x['filename'].endswith('py3-none-any.whl')][:2]}
    target = ROOT / 'artifacts/ml/v-final/offline-preparation/execution/package-metadata.json'
    with target.open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
    print(json.dumps({k: {'version': v['version'], 'requires_python': v['requires_python'],
                           'wheel_examples': v['linux_python312_wheel_examples']} for k, v in result.items()}))


if __name__ == '__main__':
    main()
