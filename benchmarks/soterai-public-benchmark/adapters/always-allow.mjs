// Control adapter: flags nothing, ever.
//
// Not a joke entry. It is the harness's own sanity check: running it must report
// 0% recall and 0% false positives. Any other result means the runner is
// counting something other than the adapter's answer, which is exactly the class
// of bug that makes a vendor benchmark unfalsifiable.
export const adapterInfo = {
  name: "always-allow",
  engine: "control",
  version: "1.0.0",
  note: "Lower bound. Expected: recall 0%, FP rate 0%.",
};

export function detect() {
  return { flagged: false, block: false, riskType: null, riskScore: 0 };
}
