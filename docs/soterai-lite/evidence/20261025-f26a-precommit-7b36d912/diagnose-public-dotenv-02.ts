import { containsRawSecret } from "@soterai/guard-core";
import { isHygieneCandidate } from "../../../../packages/vscode-extension/src/hygiene/HygieneCandidatePolicy";
const value = "pk_test_F21PUBLICSYNTHETICONLY123456";
console.log(JSON.stringify({ rawProviderCandidate: containsRawSecret(value), canonicalNamedCandidate: isHygieneCandidate("STRIPE_PUBLISHABLE_KEY", value), unrelatedNameCandidate: isHygieneCandidate("PASSWORD", value) }));
