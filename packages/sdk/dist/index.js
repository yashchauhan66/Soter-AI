"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CyberRakshakGuard = exports.normalizeDecision = exports.createClient = exports.GuardClient = exports.CyberRakshakClient = void 0;
__exportStar(require("./types"), exports);
__exportStar(require("./errors"), exports);
var client_1 = require("./client");
Object.defineProperty(exports, "CyberRakshakClient", { enumerable: true, get: function () { return client_1.CyberRakshakClient; } });
Object.defineProperty(exports, "GuardClient", { enumerable: true, get: function () { return client_1.GuardClient; } });
Object.defineProperty(exports, "createClient", { enumerable: true, get: function () { return client_1.createClient; } });
Object.defineProperty(exports, "normalizeDecision", { enumerable: true, get: function () { return client_1.normalizeDecision; } });
const client_2 = require("./client");
/**
 * Class form kept for backwards compatibility: `new CyberRakshakGuard({ apiKey })`.
 * Identical surface to {@link CyberRakshakClient}; prefer `CyberRakshakClient` in new code.
 */
class CyberRakshakGuard extends client_2.CyberRakshakClient {
    constructor(options) {
        super(options);
    }
}
exports.CyberRakshakGuard = CyberRakshakGuard;
