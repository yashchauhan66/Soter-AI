import { detectIndiaPII } from "../guard-core/src/index";
const variants = [
    "aadhaar: 234567890123",
    "aadhaar: 2345 6789 0123",
    "aadhaar: 9876-5432-1098",
    "upi: rahul@okhdfcbank",
    "ifsc HDFC0001234",
    "gstIN: 29ABCDE1234F1Z5",
    "voter id ABC1234567",
];
for (const v of variants) {
    const r = detectIndiaPII(v);
    console.log(`${v} -> matches=${r.matches.length} ${r.matches.map((m) => m.label).join(",")}`);
}
