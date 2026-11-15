"use strict";
const summary = require("./summary.cjs");
exports.start = signal => {
    if (signal.aborted) return;
    process.stdout.write(summary.publicMessage());
};
