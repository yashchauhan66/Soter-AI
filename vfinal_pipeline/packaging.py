"""Transport package with full membership pins; never a production trust signature."""
from pathlib import Path
from .common import canonical, captured, decode, identity, relative, write_new


def package(source, destination, gate):
    if gate.get('release_ready') is not False:
        raise ValueError('offline package cannot grant deployment authorization')
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if destination.is_relative_to(source) or source.is_relative_to(destination):
        raise ValueError('source/destination must be disjoint')
    paths = sorted(source.rglob('*'))
    if any(p.is_symlink() for p in paths):
        raise ValueError('symlinks refused')
    if not (source/'MODEL_CARD.md').is_file():
        raise ValueError('MODEL_CARD.md required')
    if (source/'bundle.json').exists() or (source/'release-gate.json').exists():
        raise ValueError('reserved package metadata already present')
    destination.mkdir(parents=True, exist_ok=False)
    descriptors = []
    for path in paths:
        if path.is_file():
            name = path.relative_to(source).as_posix()
            raw = path.read_bytes()
            target = relative(destination,name)
            target.parent.mkdir(parents=True,exist_ok=True)
            descriptors.append({**write_new(target,raw),'path':name})
    descriptors.append(write_new(destination/'release-gate.json',canonical(gate)))
    result = {'schema':'vfinal-bundle/v1','files':descriptors,'release_ready':False,
              'authorization':'QUARANTINE_ONLY; existing production trust gates unchanged'}
    result['identity'] = identity(result)
    write_new(destination/'bundle.json',canonical(result))
    return verify(destination)


def verify(directory):
    directory = Path(directory)
    result = decode((directory/'bundle.json').read_bytes())
    actual = dict(result)
    declared = actual.pop('identity')
    if identity(actual) != declared or result['release_ready'] is not False:
        raise ValueError('invalid bundle identity/authorization')
    names = [x['path'] for x in result['files']]
    if len(names) != len(set(names)):
        raise ValueError('duplicate package file')
    paths = list(directory.rglob('*'))
    if any(p.is_symlink() for p in paths):
        raise ValueError('symlinks refused')
    if {p.relative_to(directory).as_posix() for p in paths if p.is_file()} != set(names)|{'bundle.json'}:
        raise ValueError('package membership mismatch')
    for descriptor in result['files']:
        captured(directory, descriptor)
    return result
