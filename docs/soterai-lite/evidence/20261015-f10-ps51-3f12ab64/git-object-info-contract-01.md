# F10 object-info and loose-object link regression contract

Same-lineage LOW fixture supplement, frozen before the corresponding regression fixture file and any matching production correction. No process/test execution is claimed by this note.

The finite checked Git route admits only an empty canonical ordinary `.git/objects/info` directory, if present. Any child entry, including `commit-graph` or `commit-graphs`, withholds without reading child bodies or traversing child namespaces. This conservative restriction avoids implicit commit-graph or other object-store metadata reads outside the declared finite format. Descriptor `available()` observes subsequent entry creation and stays unavailable once drift is observed.

Every loose object admitted by the existing bounded two-hex directory/thirty-eight-hex filename rules must be an ordinary canonical single-link file. A synthetic hardlinked object filename refuses before Git execution; a later extra link revokes an existing descriptor. The paired ordinary file is admitted by metadata only; these tests do not claim that its intentionally uninterpreted bytes are a valid Git object. No test reads an object body, and no actual Git operation consumes those fake object bytes.

New `checkedGitMetadataObjectInfo.test.ts` uses only retained synthetic roots/empty alias targets/files, ordinary Node filesystem creation and the production preparation API. Tests assert preflight refusal/admission and drift, not an instrumented proof of every filesystem read. Root must capture a new failing baseline before changing production, then the corresponding focused acceptance. This is not a VSIX/native/independent/human result or a numerical rating.
