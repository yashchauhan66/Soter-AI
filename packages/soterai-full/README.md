# SoterAI Full scaffold

This package is a dependency-only scaffold. It contains no extension entrypoint,
controller, VM deployment, mTLS transport or installer. It requires SoterAI Lite.
Future Full settings use `soterai.full.*`; its independent isolation guarantees
require their own implementation and verification before any release.

The historical Full reference sources remain in `apps/privacy-controller` and
unactivated compatibility directories. They are excluded from the Lite runtime
inputs and VSIX. Installing Lite does not install or start them.
