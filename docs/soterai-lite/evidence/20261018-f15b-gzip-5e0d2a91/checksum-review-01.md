# Checksum compatibility review before correction

Installed @types/node/zlib.d.ts documents crc32 sincev22.2.0. The manifest still declares VSCode^1.85.0. The tested installed Code/Node runtimes provide this function; the initial helper unnecessarily depends on a newer primitive. This is a compatibility concern, not a secret leak finding. No older editor/runtime has been executed or graded here.

Add G10 after the initial implementation and before correction: temporarily remove only that optional primitive in the test process, retain a complete public gzip control, restore the descriptor in finally. Run this selected fixture against the existing implementation. The remaining test-name-filtered cases are SKIP, not PASS. If the concern reproduces, use a bounded private portable CRC32 implementation and rerun affected current compiler/focused/backend/full/new exact object and native checks. Do not assign new results to initial attempt01.
