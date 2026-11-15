"""Transport package with full membership pins; never a production trust signature."""
from pathlib import Path
import stat
from .common import canonical, captured, decode, identity, relative, write_new


def plain_path(path):
    """Admit existing components without following links, including NTFS reparse points.

    This is preexisting-tree admission, not isolation from concurrent hostile writers.
    """
    path = Path(path).absolute()
    for component in reversed([path, *path.parents]):
        try:
            info = component.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise ValueError('package links/junctions/reparse points refused')
    return path.resolve()


def plain_tree(directory):
    paths = []
    pending = [directory]
    while pending:
        parent = pending.pop()
        for path in sorted(parent.iterdir()):
            plain_path(path)
            info = path.lstat()
            if stat.S_ISDIR(info.st_mode):
                pending.append(path)
            elif not stat.S_ISREG(info.st_mode):
                raise ValueError('plain package files/directories required')
            paths.append(path)
    return sorted(paths)


def package(source, destination, gate):
    if gate.get('release_ready') is not False:
        raise ValueError('offline package cannot grant deployment authorization')
    source, destination = plain_path(source), plain_path(destination)
    if destination.is_relative_to(source) or source.is_relative_to(destination):
        raise ValueError('source/destination must be disjoint')
    paths = plain_tree(source)
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
    directory = plain_path(directory)
    paths = plain_tree(directory)
    result = decode((directory/'bundle.json').read_bytes())
    actual = dict(result)
    declared = actual.pop('identity')
    if identity(actual) != declared or result['release_ready'] is not False:
        raise ValueError('invalid bundle identity/authorization')
    names = [x['path'] for x in result['files']]
    if len(names) != len(set(names)):
        raise ValueError('duplicate package file')

    if {p.relative_to(directory).as_posix() for p in paths if p.is_file()} != set(names)|{'bundle.json'}:
        raise ValueError('package membership mismatch')
    for descriptor in result['files']:
        captured(directory, descriptor)
    return result
