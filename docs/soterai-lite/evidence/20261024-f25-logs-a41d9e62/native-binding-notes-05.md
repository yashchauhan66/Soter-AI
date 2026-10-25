# Current native materialization preparation

Current selections: `native-template-inputs-03.json`, `host-current-binding-02.template.ps1`, `inspect-vsix-02.template.ps1`, `materialize-native-05.template.cjs`, `native-binding-required-04.json`. All remain UNBOUND/UNEXECUTED by this author; originals01/03/04 remain unchanged historical preparation.

Materializer05 retains latest full-input-lib02/full-inputs02 and932→934membership checks. It normalizes uppercase run-check SHA only when deriving the raw-output fact, and canonicalizes Windows package output backslashes to forwardslashes only for logical path comparison and stored artifact facts. Original raw package/receipt/acceptance bytes remain untouched. Acceptanceguard03 applies the same derived-artifact normalization.

Root reported actual final full03 3757tests/3753PASS/0FAIL/4SKIP, backend144tests/143PASS/1SKIP and new package1680590bytes/SHA60a32ab790cf2f6adbf2fe197c2aeebbc12c446d68d3842ba6f1572cec3be473/frontendcdfa7604796930081b199b7ceab6a1279bf7f34b23042032fcaea83373d7729a. These are parent-reported current facts, not a template-author execution or native result. Combined current934compiler/build20 was still running when this note was prepared. Root must bind actual completed receipt/provenance facts and parse/review new templates before materialization. No native PASS is inferred.

Compiler/nativeBuild role aliases may point to the same actual combined fresh TypeScript+20driver build raw/receipt. The acceptance gates array should contain that raw fact once; requiredGatePaths may map both roles to it. Materializer keys are distinct roles without a distinct-raw restriction. This never increases numerical native counts, which are recomputed from actual37native phases only.
