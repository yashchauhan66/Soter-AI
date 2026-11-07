"""Accepted source manifests -> decontaminated train/validation/frozen holdout.

Reuses eval_harness Case, lineage grouping and deterministic partition APIs.
Lexical audit is exhaustive over shared character-5-grams, not semantic proof.
"""
from collections import Counter, defaultdict
from dataclasses import replace
from pathlib import Path
import re
import unicodedata

from eval_harness.core import Case
from eval_harness.data import group_cases, partition_cases
from .common import canonical, captured, checked_token, decode, digest, identity, write_new

PREPROCESSING = 'exact-text-or-role-newline/v1;NFKC-casefold-space-audit-only'
NATIVE_LABELS = ('SAFE', 'PROMPT_INJECTION', 'JAILBREAK', 'SYSTEM_PROMPT_LEAK_ATTEMPT',
                 'PII', 'SECRET', 'UNSAFE_OUTPUT', 'RAG_POISONING', 'DATA_EXFILTRATION_ATTEMPT',
                 'TOOL_CALL_ABUSE', 'ENCODING_OBFUSCATION', 'MULTI_TURN_ESCALATION',
                 'MODEL_EXTRACTION', 'TOXICITY_HARASSMENT')


def admit_labels(manifest, unit_only):
    if type(unit_only) is not bool:
        raise ValueError('explicit boolean unit_only required')
    if not unit_only:
        if manifest.get('unit_only') is True:
            raise ValueError('UNIT-only data cannot enter a genuine experiment')
        if manifest['labels'] != list(NATIVE_LABELS):
            raise ValueError('exact native 14-label order required')


def model_text(row):
    if row.get('text') is not None:
        return row['text']
    return '\n'.join('[' + t['role'] + ']\n' + t['text'] for t in row['turns'])


def normalized(text):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', text).casefold()).strip()


def build(input_path, destination):
    input_path, destination = Path(input_path), Path(destination)
    manifest_raw = input_path.read_bytes()
    spec = decode(manifest_raw)
    if spec.get('schema') != 'vfinal-input/v1' or spec.get('accepted') is not True:
        raise ValueError('accepted input manifest required; template is NOT accepted')
    labels = spec['labels']
    if not labels or labels[0] != 'SAFE' or len(labels) != len(set(labels)):
        raise ValueError('explicit unique SAFE-first label order required')
    # Legacy frozen fixtures explicitly declare UNIT-ONLY on every source.
    unit_only = spec.get('unit_only', bool(spec['sources']) and
                         all(s.get('license') == 'UNIT-ONLY' for s in spec['sources']))
    admit_labels(spec, unit_only)
    if type(spec['seed']) is not int:
        raise ValueError('integer seed required')
    fraction = spec['validation_fraction']
    near = spec['near_jaccard']
    if type(fraction) not in (int, float) or not 0 < fraction < 1:
        raise ValueError('validation fraction must be between zero and one')
    if type(near) not in (int, float) or not 0 < near <= 1:
        raise ValueError('positive near-duplicate threshold required')
    limit = spec['max_candidate_pairs']
    if type(limit) is not int or limit <= 0:
        raise ValueError('positive lexical pair budget required')
    rows, cases, roles, quarantine, source_pins = [], [], [], [], []
    seen, audit_only, exposure_records = set(), set(), []
    for source in spec['sources']:
        if source.get('accepted') is not True or not source.get('license'):
            raise ValueError('source acceptance and license required')
        role = source['role']
        if role not in ('development', 'frozen_holdout', 'exposure'):
            raise ValueError('unknown source role')
        raw = captured(input_path.parent, source)
        source_pins.append(dict(source))
        for index, line in enumerate(raw.splitlines(), 1):
            row = decode(line)
            rid = row.get('id')
            if type(rid) is not str or not rid or rid in seen:
                raise ValueError('missing/duplicate exact case ID')
            seen.add(rid)
            missing_label = row.get('label') is None
            if missing_label:
                if role != 'development':
                    raise ValueError('holdout/exposure missing label requires adjudication')
            # Validate all audit metadata even for unlearnable targets. The
            # placeholder is only for Case's grouping API, never emitted as truth.
            case = Case.from_dict({**row, 'label': 'SAFE'} if missing_label else row)
            if role == 'exposure':
                provenance = row.get('provenance') or {}
                for key in ('candidate_identity', 'partition'):
                    if key in source and key in provenance and source[key] != provenance[key]:
                        raise ValueError('conflicting exposure candidate/partition provenance')
                candidate = provenance.get('candidate_identity', source.get('candidate_identity'))
                partition = provenance.get('partition', source.get('partition', 'unknown'))
                if partition not in ('training', 'teacher_training', 'validation', 'calibration', 'unknown'):
                    raise ValueError('unknown exposure partition provenance')
                if candidate is not None:
                    checked_token(candidate)
                if partition != 'unknown' and candidate is None:
                    raise ValueError('exposure candidate identity required for partition provenance')
                exposure_records.append({'case_id': rid, 'candidate_identity': candidate,
                                         'partition': partition, 'source_sha256': source['sha256']})
            if case.license != source['license'] or case.license_status != 'verified':
                raise ValueError('verified record license must match accepted source')
            if case.label not in labels:
                raise ValueError('label absent from explicit alignment')
            # Whitelist outcomes must never become raw classification targets.
            if missing_label or case.target == 'policy':
                audit_only.add(len(cases))
                quarantine.append({'id': rid, 'reason': 'missing_label' if missing_label else
                                   'policy_only_not_raw_training', 'record_sha256': digest(line)})
            rows.append({**case.to_dict(), 'label': None} if missing_label else case.to_dict())
            cases.append(case)
            roles.append(role)
    if 'frozen_holdout' not in roles:
        raise ValueError('explicit frozen holdout required before teacher selection')
    grouping = group_cases(cases)
    parent = list(range(len(cases)))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    def union(i, j):
        parent[root(j)] = root(i)
    by_id = {c.id: i for i, c in enumerate(cases)}
    for component in grouping.components:
        for rid in component[1:]:
            union(by_id[component[0]], by_id[rid])
    texts = [normalized(model_text(row)) for row in rows]
    exact, conflicts = {}, set()
    postings, grams, lexical_pairs = defaultdict(list), [], 0
    for i, text in enumerate(texts):
        if not text:
            raise ValueError('empty normalized text')
        if text in exact:
            j = exact[text]
            union(i, j)
            if i not in audit_only and j not in audit_only and rows[i]['label'] != rows[j]['label']:
                conflicts.update((i, j))
            if j in audit_only and i not in audit_only:
                exact[text] = i
        else:
            exact[text] = i
        tokens = {text[k:k + 5] for k in range(max(1, len(text) - 4))}
        candidates = set()
        for token in tokens:
            candidates.update(postings[token])
        lexical_pairs += len(candidates)
        if lexical_pairs > limit:
            raise ValueError('lexical candidate budget exceeded; no partial audit accepted')
        for j in candidates:
            other = grams[j]
            if len(tokens & other) / len(tokens | other) >= near:
                union(i, j)
        grams.append(tokens)
        for token in tokens:
            postings[token].append(i)
    components = defaultdict(list)
    for i in range(len(cases)):
        components[root(i)].append(i)
    dev, held, dedup_seen = [], [], set()
    for members in components.values():
        member_roles = {roles[i] for i in members}
        if {'frozen_holdout', 'exposure'} <= member_roles:
            raise ValueError('holdout overlaps declared baseline/teacher exposure')
        if set(members) & conflicts:
            if 'frozen_holdout' in member_roles:
                raise ValueError('holdout label contradiction requires adjudication')
            for i in members:
                quarantine.append({'id': cases[i].id, 'reason': 'contradictory_raw_labels',
                                   'record_sha256': identity(rows[i])})
            continue
        group = identity(sorted(cases[i].id for i in members))
        for i in members:
            if i in audit_only:
                continue
            if roles[i] == 'frozen_holdout':
                held.append(i)
            elif roles[i] == 'development':
                reason = 'holdout_connected' if 'frozen_holdout' in member_roles else None
                if not reason and texts[i] in dedup_seen:
                    reason = 'normalized_duplicate'
                if reason:
                    quarantine.append({'id': cases[i].id, 'reason': reason, 'record_sha256': identity(rows[i])})
                else:
                    dedup_seen.add(texts[i])
                    dev.append((i, replace(cases[i], template_family=group)))
    dev.sort()
    plan = partition_cases([c for _, c in dev], seed=spec['seed'],
                           proportions={'train': 1 - fraction, 'validation': fraction})
    splits = {name: [rows[by_id[rid]] for rid in ids] for name, ids in plan.partitions.items()}
    validation_roots = {root(by_id[rid]) for rid in plan.partitions['validation']}
    for exposure in exposure_records:
        if exposure['partition'] in ('training', 'teacher_training') and root(by_id[exposure['case_id']]) in validation_roots:
            raise ValueError('teacher-training exposure overlaps selection validation; rebuild a disjoint partition')
    splits['holdout'] = [rows[i] for i in sorted(held)]
    if any(not records for records in splits.values()):
        raise ValueError('empty partition; more independent accepted families required')
    destination.mkdir(parents=True, exist_ok=False)
    files = {name: write_new(destination / (name + '.jsonl'),
                            b''.join(canonical(row) + b'\n' for row in records))
             for name, records in splits.items()}
    result = {'schema': 'vfinal-data/v1', 'input_manifest_sha256': digest(manifest_raw),
              'sources': source_pins, 'labels': labels, 'seed': spec['seed'],
              'teacher_exposure': exposure_records,
              'unit_only': unit_only,
              'preprocessing': PREPROCESSING, 'counts': {n: len(r) for n, r in splits.items()},
              'files': files, 'partition_plan_sha256': plan.sha256,
              'distributions': {n: {'labels': dict(Counter(r['label'] for r in records)),
                                    'languages': dict(Counter(r['language'] for r in records)),
                                    'slices': dict(Counter(s for r in records for s in r['slices']))}
                                for n, records in splits.items()},
              'quarantine': quarantine, 'lexical_candidate_pairs': lexical_pairs,
              'near_jaccard': near, 'semantic_near_duplicate': 'NOT RUN',
              'exposure_audit_complete': spec.get('exposure_audit_complete') is True,
              'release_ready': False}
    result['identity'] = identity(result)
    write_new(destination / 'manifest.json', canonical(result))
    card = '# DATA_CARD\n\nNOT a benchmark or independence certificate. release_ready=false.\n\n'
    card += 'Raw text/turns are preserved. Missing labels and policy-only labels are quarantined, not SAFE.\n'
    card += 'Frozen holdout excluded from development, teacher inference/training, mining and calibration.\n'
    card += 'Declared family connectivity + exhaustive normalized character-5-gram Jaccard candidate audit.\n'
    card += 'Semantic/paraphrase contamination NOT RUN; historical exposure completeness requires external review.\n\n'
    card += '```json\n' + canonical(result).decode('utf-8') + '\n```\n'
    write_new(destination / 'DATA_CARD.md', card.encode('utf-8'))
    return result


def load_manifest(directory, expected_identity):
    from .common import checked_token
    checked_token(expected_identity)
    result = decode((Path(directory) / 'manifest.json').read_bytes())
    actual = dict(result)
    declared = actual.pop('identity')
    if declared != expected_identity or identity(actual) != expected_identity:
        raise ValueError('dataset manifest identity mismatch')
    return result


def load_split(directory, expected_identity, split):
    if split not in ('train', 'validation', 'holdout'):
        raise ValueError('unknown split')
    result = load_manifest(directory, expected_identity)
    raw = captured(directory, result['files'][split])
    records = [decode(line) for line in raw.splitlines()]
    if len(records) != result['counts'][split]:
        raise ValueError('split count mismatch')
    for row in records:
        Case.from_dict(row)
    return records
