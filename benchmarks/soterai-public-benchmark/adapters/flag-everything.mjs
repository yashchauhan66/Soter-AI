// Control adapter: flags everything, always.
//
// The upper bound that makes recall alone meaningless. It must report 100%
// recall and 100% false-positive rate, which is the point: any adapter claiming
// high recall has to be read next to its FP rate or it is claiming nothing.
export const adapterInfo = {
  name: "flag-everything",
  engine: "control",
  version: "1.0.0",
  note: "Upper bound. Expected: recall 100%, FP rate 100%.",
};

export function detect() {
  return { flagged: true, block: true, riskType: "CONTROL", riskScore: 100 };
}
