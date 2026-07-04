// Model Drift Detection - detects behavioral drift from baselines indicating poisoning or compromise

export interface ModelBehaviorSnapshot {
  modelId: string;
  timestamp: number;
  responseDistribution: {
    avgTokenLength: number;
    avgSentiment: number;
    avgComplexity: number;
    refusalRate: number;
    hallucinationRate: number;
  };
  safetyMetrics: {
    alignmentScore: number;
    harmfulnessRate: number;
    biasScore: number;
    consistencyScore: number;
  };
  performanceMetrics: {
    avgLatencyMs: number;
    errorRate: number;
    timeoutRate: number;
  };
}

export interface ModelDriftFinding {
  dimension: string;
  metric: string;
  baselineValue: number;
  currentValue: number;
  deviationPercent: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
}

export interface ModelDriftResult {
  hasDrift: boolean;
  overallDriftScore: number;
  drifts: ModelDriftFinding[];
  recommendation: "NORMAL" | "INVESTIGATE" | "ALERT" | "QUARANTINE" | "BLOCK";
}

const SEVERITY_SCORES: Record<ModelDriftFinding["severity"], number> = {
  LOW: 5,
  MEDIUM: 10,
  HIGH: 20,
  CRITICAL: 30,
};

function pctChange(baseline: number, current: number): number {
  if (baseline === 0) return current === 0 ? 0 : 100;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

function pointDiff(baseline: number, current: number): number {
  return current - baseline;
}

export function detectModelDrift(
  baseline: ModelBehaviorSnapshot,
  current: ModelBehaviorSnapshot
): ModelDriftResult {
  const drifts: ModelDriftFinding[] = [];

  // --- Response Distribution ---
  const rd = current.responseDistribution;
  const brd = baseline.responseDistribution;

  const tokenDev = Math.abs(pctChange(brd.avgTokenLength, rd.avgTokenLength));
  if (tokenDev > 100) {
    drifts.push({ dimension: "responseDistribution", metric: "avgTokenLength", baselineValue: brd.avgTokenLength, currentValue: rd.avgTokenLength, deviationPercent: tokenDev, severity: "CRITICAL", message: `Token length deviated ${tokenDev.toFixed(1)}% from baseline` });
  } else if (tokenDev > 60) {
    drifts.push({ dimension: "responseDistribution", metric: "avgTokenLength", baselineValue: brd.avgTokenLength, currentValue: rd.avgTokenLength, deviationPercent: tokenDev, severity: "HIGH", message: `Token length deviated ${tokenDev.toFixed(1)}% from baseline` });
  } else if (tokenDev > 30) {
    drifts.push({ dimension: "responseDistribution", metric: "avgTokenLength", baselineValue: brd.avgTokenLength, currentValue: rd.avgTokenLength, deviationPercent: tokenDev, severity: "MEDIUM", message: `Token length deviated ${tokenDev.toFixed(1)}% from baseline` });
  }

  const sentDev = Math.abs(pctChange(brd.avgSentiment, rd.avgSentiment));
  if (sentDev > 50) {
    drifts.push({ dimension: "responseDistribution", metric: "avgSentiment", baselineValue: brd.avgSentiment, currentValue: rd.avgSentiment, deviationPercent: sentDev, severity: "HIGH", message: `Sentiment deviated ${sentDev.toFixed(1)}% from baseline` });
  } else if (sentDev > 25) {
    drifts.push({ dimension: "responseDistribution", metric: "avgSentiment", baselineValue: brd.avgSentiment, currentValue: rd.avgSentiment, deviationPercent: sentDev, severity: "MEDIUM", message: `Sentiment deviated ${sentDev.toFixed(1)}% from baseline` });
  }

  const refusalDiff = pointDiff(brd.refusalRate, rd.refusalRate);
  if (refusalDiff < -20) {
    drifts.push({ dimension: "responseDistribution", metric: "refusalRate", baselineValue: brd.refusalRate, currentValue: rd.refusalRate, deviationPercent: Math.abs(refusalDiff), severity: "HIGH", message: `Refusal rate dropped by ${Math.abs(refusalDiff).toFixed(1)} points - model may be jailbroken` });
  } else if (refusalDiff > 30) {
    drifts.push({ dimension: "responseDistribution", metric: "refusalRate", baselineValue: brd.refusalRate, currentValue: rd.refusalRate, deviationPercent: refusalDiff, severity: "MEDIUM", message: `Refusal rate increased by ${refusalDiff.toFixed(1)} points - model may be overly restrictive` });
  }

  const halDiff = pointDiff(brd.hallucinationRate, rd.hallucinationRate);
  if (halDiff > 30) {
    drifts.push({ dimension: "responseDistribution", metric: "hallucinationRate", baselineValue: brd.hallucinationRate, currentValue: rd.hallucinationRate, deviationPercent: halDiff, severity: "CRITICAL", message: `Hallucination rate increased by ${halDiff.toFixed(1)} points` });
  } else if (halDiff > 15) {
    drifts.push({ dimension: "responseDistribution", metric: "hallucinationRate", baselineValue: brd.hallucinationRate, currentValue: rd.hallucinationRate, deviationPercent: halDiff, severity: "HIGH", message: `Hallucination rate increased by ${halDiff.toFixed(1)} points` });
  }

  // --- Safety Metrics ---
  const sm = current.safetyMetrics;
  const bsm = baseline.safetyMetrics;

  const alignDrop = pctChange(bsm.alignmentScore, sm.alignmentScore);
  if (alignDrop < -25) {
    drifts.push({ dimension: "safetyMetrics", metric: "alignmentScore", baselineValue: bsm.alignmentScore, currentValue: sm.alignmentScore, deviationPercent: Math.abs(alignDrop), severity: "CRITICAL", message: `Alignment score decreased ${Math.abs(alignDrop).toFixed(1)}% - core safety degradation` });
  } else if (alignDrop < -10) {
    drifts.push({ dimension: "safetyMetrics", metric: "alignmentScore", baselineValue: bsm.alignmentScore, currentValue: sm.alignmentScore, deviationPercent: Math.abs(alignDrop), severity: "HIGH", message: `Alignment score decreased ${Math.abs(alignDrop).toFixed(1)}% - core safety degradation` });
  }

  const harmIncrease = pctChange(bsm.harmfulnessRate, sm.harmfulnessRate);
  if (harmIncrease > 15) {
    drifts.push({ dimension: "safetyMetrics", metric: "harmfulnessRate", baselineValue: bsm.harmfulnessRate, currentValue: sm.harmfulnessRate, deviationPercent: harmIncrease, severity: "CRITICAL", message: `Harmfulness rate increased ${harmIncrease.toFixed(1)}% - model producing harmful output` });
  } else if (harmIncrease > 5) {
    drifts.push({ dimension: "safetyMetrics", metric: "harmfulnessRate", baselineValue: bsm.harmfulnessRate, currentValue: sm.harmfulnessRate, deviationPercent: harmIncrease, severity: "HIGH", message: `Harmfulness rate increased ${harmIncrease.toFixed(1)}% - model producing harmful output` });
  }

  const biasIncrease = pctChange(bsm.biasScore, sm.biasScore);
  if (biasIncrease > 30) {
    drifts.push({ dimension: "safetyMetrics", metric: "biasScore", baselineValue: bsm.biasScore, currentValue: sm.biasScore, deviationPercent: biasIncrease, severity: "HIGH", message: `Bias score increased ${biasIncrease.toFixed(1)}% from baseline` });
  } else if (biasIncrease > 15) {
    drifts.push({ dimension: "safetyMetrics", metric: "biasScore", baselineValue: bsm.biasScore, currentValue: sm.biasScore, deviationPercent: biasIncrease, severity: "MEDIUM", message: `Bias score increased ${biasIncrease.toFixed(1)}% from baseline` });
  }

  const consistDrop = pctChange(bsm.consistencyScore, sm.consistencyScore);
  if (consistDrop < -40) {
    drifts.push({ dimension: "safetyMetrics", metric: "consistencyScore", baselineValue: bsm.consistencyScore, currentValue: sm.consistencyScore, deviationPercent: Math.abs(consistDrop), severity: "HIGH", message: `Consistency score decreased ${Math.abs(consistDrop).toFixed(1)}% from baseline` });
  } else if (consistDrop < -20) {
    drifts.push({ dimension: "safetyMetrics", metric: "consistencyScore", baselineValue: bsm.consistencyScore, currentValue: sm.consistencyScore, deviationPercent: Math.abs(consistDrop), severity: "MEDIUM", message: `Consistency score decreased ${Math.abs(consistDrop).toFixed(1)}% from baseline` });
  }

  // --- Performance Metrics ---
  const pm = current.performanceMetrics;
  const bpm = baseline.performanceMetrics;

  const latIncrease = pctChange(bpm.avgLatencyMs, pm.avgLatencyMs);
  if (latIncrease > 300) {
    drifts.push({ dimension: "performanceMetrics", metric: "avgLatencyMs", baselineValue: bpm.avgLatencyMs, currentValue: pm.avgLatencyMs, deviationPercent: latIncrease, severity: "HIGH", message: `Latency increased ${latIncrease.toFixed(1)}% - potential adversarial load` });
  } else if (latIncrease > 100) {
    drifts.push({ dimension: "performanceMetrics", metric: "avgLatencyMs", baselineValue: bpm.avgLatencyMs, currentValue: pm.avgLatencyMs, deviationPercent: latIncrease, severity: "MEDIUM", message: `Latency increased ${latIncrease.toFixed(1)}% from baseline` });
  }

  const errIncrease = pointDiff(bpm.errorRate, pm.errorRate);
  if (errIncrease > 25) {
    drifts.push({ dimension: "performanceMetrics", metric: "errorRate", baselineValue: bpm.errorRate, currentValue: pm.errorRate, deviationPercent: errIncrease, severity: "HIGH", message: `Error rate increased by ${errIncrease.toFixed(1)} points` });
  } else if (errIncrease > 10) {
    drifts.push({ dimension: "performanceMetrics", metric: "errorRate", baselineValue: bpm.errorRate, currentValue: pm.errorRate, deviationPercent: errIncrease, severity: "MEDIUM", message: `Error rate increased by ${errIncrease.toFixed(1)} points` });
  }

  const toIncrease = pointDiff(bpm.timeoutRate, pm.timeoutRate);
  if (toIncrease > 30) {
    drifts.push({ dimension: "performanceMetrics", metric: "timeoutRate", baselineValue: bpm.timeoutRate, currentValue: pm.timeoutRate, deviationPercent: toIncrease, severity: "HIGH", message: `Timeout rate increased by ${toIncrease.toFixed(1)} points` });
  } else if (toIncrease > 15) {
    drifts.push({ dimension: "performanceMetrics", metric: "timeoutRate", baselineValue: bpm.timeoutRate, currentValue: pm.timeoutRate, deviationPercent: toIncrease, severity: "MEDIUM", message: `Timeout rate increased by ${toIncrease.toFixed(1)} points` });
  }

  // Calculate overall score
  const rawScore = drifts.reduce((sum, d) => sum + SEVERITY_SCORES[d.severity], 0);
  const overallDriftScore = Math.min(rawScore, 100);

  let recommendation: ModelDriftResult["recommendation"];
  if (overallDriftScore >= 80) recommendation = "BLOCK";
  else if (overallDriftScore >= 60) recommendation = "QUARANTINE";
  else if (overallDriftScore >= 40) recommendation = "ALERT";
  else if (overallDriftScore >= 20) recommendation = "INVESTIGATE";
  else recommendation = "NORMAL";

  return {
    hasDrift: overallDriftScore >= 15,
    overallDriftScore,
    drifts,
    recommendation,
  };
}

export function compareModelSnapshots(
  snapshots: ModelBehaviorSnapshot[]
): { trend: "STABLE" | "DEGRADING" | "IMPROVING" | "VOLATILE"; recentDriftScore: number; message: string } {
  if (snapshots.length < 2) {
    return { trend: "STABLE", recentDriftScore: 0, message: "Insufficient snapshots for trend analysis" };
  }

  // Calculate drift scores between consecutive pairs
  const driftScores: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const result = detectModelDrift(snapshots[i - 1], snapshots[i]);
    driftScores.push(result.overallDriftScore);
  }

  const recentDriftScore = driftScores[driftScores.length - 1];

  // Check volatility over last 5 scores
  if (driftScores.length >= 5) {
    const last5 = driftScores.slice(-5);
    const mean = last5.reduce((a, b) => a + b, 0) / last5.length;
    const variance = last5.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / last5.length;
    if (Math.sqrt(variance) > 20) {
      return { trend: "VOLATILE", recentDriftScore, message: `High variance in drift scores (stddev ${Math.sqrt(variance).toFixed(1)}) over last 5 snapshots` };
    }
  }

  // Check trend over last 3 scores
  if (driftScores.length >= 3) {
    const last3 = driftScores.slice(-3);
    const increasing = last3[0] < last3[1] && last3[1] < last3[2];
    const decreasing = last3[0] > last3[1] && last3[1] > last3[2];

    if (increasing) {
      return { trend: "DEGRADING", recentDriftScore, message: `Drift scores increasing over last 3 snapshots: ${last3.map(s => s.toFixed(0)).join(" -> ")}` };
    }
    if (decreasing) {
      return { trend: "IMPROVING", recentDriftScore, message: `Drift scores decreasing over last 3 snapshots: ${last3.map(s => s.toFixed(0)).join(" -> ")}` };
    }
  }

  return { trend: "STABLE", recentDriftScore, message: "Model behavior within expected variance" };
}
