"""Identical-context comparison. Offline mechanics never authorize deployment."""
import math
from .common import canonical, identity
from eval_harness.core import Case, ScoreBatch, aggregate_metrics, cases_fingerprint
from eval_harness.data import group_cases


def default_contract():
    return {'schema': 'vfinal-gate/v1', 'status': 'PROVISIONAL_PREDECLARE_BEFORE_HOLDOUT',
            'required_models': ['v14', 'v17-multilingual', 'other-a', 'other-b', 'v-final'],
            'candidate': 'v-final', 'recall_baselines': ['v14', 'v17-multilingual'], 'fpr_baseline': 'v14',
            'languages': ['en','hi','hi-Latn','es','fr','de','ar','zh'],
            'min_positive': 200, 'min_negative': 200, 'bootstrap_samples': 2000, 'seed': 42,
            'recall_noninferiority': -0.01, 'fpr_upper_delta': 0.005,
            'max_ece': 0.05, 'global_max_fpr': 0.02,
            'cpu_service_p95_ms': 100.0, 'cpu_service_p99_ms': 200.0, 'end_to_end_p95_ms': 150.0,
            'min_latency_samples': 1000, 'min_seeds': 3,
            'required_ablations': ['no_distillation','no_hard_negatives','no_class_balance','no_calibration','fp32_vs_int8'],
            'required_paths': ['api','n8n','ide','whitelist_single','whitelist_repeated','whitelist_plus_injection'],
            'required_latency_contexts': ['cpu_batch1','cpu_concurrency','gpu_batch1','gpu_concurrency']}


def paired_interval(truth, candidate, baseline, candidate_threshold, baseline_threshold,
                    metric, groups, samples, seed):
    import numpy as np
    y = np.asarray(truth, dtype=bool)
    a, b = np.asarray(candidate) >= candidate_threshold, np.asarray(baseline) >= baseline_threshold
    support = y if metric == 'recall' else ~y
    if metric not in ('recall', 'fpr') or not support.any():
        raise ValueError('paired statistic requires supported recall/fpr')
    delta = a.astype(float) - b.astype(float)
    blocks = [np.flatnonzero(np.asarray(groups) == g) for g in sorted(set(groups))]
    rng = np.random.default_rng(seed)
    boot = []
    for _ in range(samples):
        indices = np.concatenate([blocks[i] for i in rng.integers(0,len(blocks),len(blocks))])
        selected = indices[support[indices]]
        if len(selected):
            boot.append(float(delta[selected].mean()))
    if len(boot) < samples // 2:
        raise ValueError('insufficient supported cluster-bootstrap draws')
    from scipy.stats import binomtest
    discordant_a = int(((a == y) & (b != y) & support).sum())
    discordant_b = int(((a != y) & (b == y) & support).sum())
    n = discordant_a + discordant_b
    return {'point_delta': float(delta[support].mean()),
            'lower95': float(np.quantile(boot, .025)), 'upper95': float(np.quantile(boot, .975)),
            'cluster_bootstrap_valid': len(boot), 'cluster_count': len(blocks),
            'mcnemar_exact_p': float(binomtest(discordant_a,n,.5).pvalue) if n else 1.0,
            'multiplicity': 'unadjusted per-comparison; not a familywise superiority claim'}


def evaluate(rows, arms, contract):
    import numpy as np
    canonical([rows, arms, contract])
    cases = [Case.from_dict(r) for r in rows]
    names = [a['name'] for a in arms]
    if len(set(names)) != len(names) or set(names) != set(contract['required_models']):
        raise ValueError('exact complete required model set required')
    if contract['min_positive'] < 200 or contract['min_negative'] < 200 or contract['min_seeds'] < 3:
        raise ValueError('release support/seed floors cannot be lowered')
    context = arms[0]['context']
    required = {'dataset_sha256','hardware_id','preprocessing','batch_size','runtime','sequence_policy','serving_path'}
    if not required <= context.keys() or context['dataset_sha256'] != cases_fingerprint(cases):
        raise ValueError('identical context must bind exact case content and order')
    if any(canonical(a['context']) != canonical(context) for a in arms):
        raise ValueError('identical context required for all arms')
    failures, table, reports, by_name = [], [], {}, {a['name']: a for a in arms}
    for arm in arms:
        score = ScoreBatch(tuple(arm['case_ids']), tuple(arm['scores']), (None,)*len(cases),
                           'risk', arm['model_identity'], context['dataset_sha256'])
        report = aggregate_metrics(cases, score, target='risk', threshold=arm['threshold'],
                                  declared_languages=contract['languages'], expected_model_identity=arm['model_identity'])
        reports[arm['name']] = report
        timing = arm['latencies_ms']
        if not timing or any(type(t) not in (int,float) or not math.isfinite(t) or t < 0 for t in timing):
            raise ValueError('finite nonnegative latency observations required')
        latency = {f'p{q}': float(np.percentile(timing,q)) for q in (50,95,99)}
        table.append({'name': arm['name'], 'metrics': report, 'latency_ms': latency,
                      'latency_n': len(timing), 'cold_load_ms': arm.get('cold_load_ms'),
                      'memory_bytes': arm.get('memory_bytes'), 'size_bytes': arm.get('size_bytes')})
        if arm.get('evidence_class') != 'genuine_real_serving':
            failures.append(arm['name'] + ': evidence_class=' + str(arm.get('evidence_class')))
        if len(timing) < contract['min_latency_samples']:
            failures.append(arm['name'] + ': insufficient_latency_samples')
        if any(type(arm.get(k)) not in (float,int) or arm[k] <= 0 for k in ('memory_bytes','size_bytes','cold_load_ms')):
            failures.append(arm['name'] + ': missing_measured_size_memory_cold')
    # Metrics are recomputed, not accepted from caller-provided summary JSON.
    candidate = by_name[contract['candidate']]
    truth = [c.truth_for('risk') for c in cases]
    if any(y is None for y in truth):
        failures.append('missing risk truth')
    groups = group_cases(cases).case_to_group
    selections = {'overall': list(range(len(cases)))}
    from eval_harness.core import REQUIRED_SLICES
    selections.update({'slice:'+s: [i for i,c in enumerate(cases) if s in c.slices] for s in REQUIRED_SLICES})
    selections.update({'language:'+s: [i for i,c in enumerate(cases) if c.language == s] for s in contract['languages']})
    from eval_harness.core import binary_metrics
    comparisons = {}
    for name, selected in selections.items():
        ix = [i for i in selected if truth[i] is not None]
        y = [truth[i] for i in ix]
        p = [candidate['scores'][i] for i in ix]
        metric = binary_metrics(y,p,candidate['threshold'])
        comparisons[name] = {'candidate': metric, 'paired': {}}
        if metric['positives'] < contract['min_positive'] or metric['negatives'] < contract['min_negative']:
            failures.append(name + ': insufficient_support')
            continue
        if metric['ece'] is None or metric['ece'] > contract['max_ece']:
            failures.append(name + ': ECE gate failed')
        if name == 'overall' and metric['fpr'] > contract['global_max_fpr']:
            failures.append('overall: benign FPR gate failed')
        for baseline_name in contract['recall_baselines']:
            baseline = by_name[baseline_name]
            for stat in (['recall','fpr'] if baseline_name == contract['fpr_baseline'] else ['recall']):
                ci = paired_interval(y,p,[baseline['scores'][i] for i in ix],candidate['threshold'],baseline['threshold'],
                                     stat,[groups[cases[i].id] for i in ix],contract['bootstrap_samples'],contract['seed'])
                comparisons[name]['paired'][baseline_name+':'+stat] = ci
                passed = (ci['point_delta'] >= 0 and ci['lower95'] >= contract['recall_noninferiority']) if stat == 'recall' else (
                    ci['point_delta'] <= 0 and ci['upper95'] <= contract['fpr_upper_delta'])
                if not passed:
                    failures.append(name+': '+baseline_name+' '+stat+' regression')
    latency = next(r['latency_ms'] for r in table if r['name'] == contract['candidate'])
    baseline_latency = next(r['latency_ms'] for r in table if r['name'] == contract['fpr_baseline'])
    if context['batch_size'] != 1 or context['serving_path'] != 'cpu_service_local':
        failures.append('CPU batch1 real-serving context required')
    if latency['p95'] > min(contract['cpu_service_p95_ms'], baseline_latency['p95']) or latency['p99'] > contract['cpu_service_p99_ms']:
        failures.append('service latency SLO failed')
    evidence = candidate.get('evidence', {})
    # These are separately collected artifacts, not an offline bypass switch.
    for key in ('untouched_holdout','complete_exposure_audit','semantic_duplicate_review','privacy_review','production_policy_regressions_fixed'):
        if evidence.get(key) is not True:
            failures.append('missing independent evidence: '+key)
    seeds = evidence.get('seed_runs', [])
    if len({r.get('seed') for r in seeds if type(r.get('seed')) is int and r.get('genuine') is True}) < contract['min_seeds']:
        failures.append('three genuine distinct seed runs required')
    for key, required_values in [('ablations',contract['required_ablations']),('paths',contract['required_paths']),
                                  ('latency_contexts',contract['required_latency_contexts'])]:
        if any(v not in evidence.get(key, {}) or evidence[key][v].get('passed') is not True for v in required_values):
            failures.append('missing required '+key)
    e2e = evidence.get('end_to_end_p95_ms')
    if type(e2e) not in (int,float) or not 0 <= e2e <= contract['end_to_end_p95_ms']:
        failures.append('end-to-end latency gate missing/failed')
    return {'schema': 'vfinal-gate-result/v1', 'contract_identity': identity(contract),
            'context_identity': identity(context), 'criteria_pass': not failures, 'release_ready': False,
            'deployment_authorization': 'NEVER_GRANTED_BY_OFFLINE_JSON; independent signed serving-path review required',
            'failures': failures, 'master_table': table, 'comparisons': comparisons,
            'claim': 'NOT RUN or failed/incomplete' if failures else 'provisional noninferiority; not strongest-on-every-axis'}
