"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStore = void 0;
exports.sanitizeMemoryEvent = sanitizeMemoryEvent;
exports.estimateContentSize = estimateContentSize;
const Redactor_1 = require("./Redactor");
/**
 * Scrub a memory event so no raw secret can ever be persisted, exported, or shown
 * in a webview. Returns a shallow clone; the input is untouched.
 */
function sanitizeMemoryEvent(event) {
    const scrub = (v) => {
        if (v === undefined)
            return undefined;
        // Redact first (masks known secret shapes incl. the canary token), then
        // hard-drop anything that still smells like a raw secret.
        const red = (0, Redactor_1.redactForSharing)(v);
        return (0, Redactor_1.containsRawSecret)(red) ? "[REDACTED]" : red;
    };
    return {
        ...event,
        redactedEvidence: scrub(event.redactedEvidence),
        // Hashes must never contain secrets; drop any that somehow do.
        requestHash: event.requestHash && !(0, Redactor_1.containsRawSecret)(event.requestHash) ? event.requestHash : undefined,
        responseHash: event.responseHash && !(0, Redactor_1.containsRawSecret)(event.responseHash) ? event.responseHash : undefined,
        filePaths: event.filePaths?.map((p) => ((0, Redactor_1.containsRawSecret)(p) ? "[REDACTED_PATH]" : p)),
        model: scrub(event.model),
        provider: scrub(event.provider),
    };
}
class MemoryStore {
    sessions = new Map();
    startSession(input) {
        const session = {
            sessionId: input.sessionId,
            startedAt: input.startedAt ?? new Date().toISOString(),
            tool: input.tool,
            provider: input.provider,
            source: input.source,
            filesIncluded: [],
            filesBlocked: [],
            protectedFilesAttempted: [],
            riskCategories: [],
            requestHashes: [],
            responseHashes: [],
            contentSizeEstimate: 0,
            decisions: [],
            approvals: [],
            canaryExposed: false,
            events: [],
        };
        this.sessions.set(session.sessionId, session);
        return session;
    }
    /** Append a (sanitized) event and update session aggregates. */
    addEvent(sessionId, event) {
        const session = this.sessions.get(sessionId) ?? this.startSession({ sessionId, source: event.source });
        const clean = sanitizeMemoryEvent(event);
        session.events.push(clean);
        for (const c of clean.categories) {
            if (!session.riskCategories.includes(c))
                session.riskCategories.push(c);
        }
        if (clean.requestHash)
            session.requestHashes.push(clean.requestHash);
        if (clean.responseHash)
            session.responseHashes.push(clean.responseHash);
        if (typeof clean.contentSize === "number")
            session.contentSizeEstimate += clean.contentSize;
        session.decisions.push(clean.decision);
        if (clean.canaryExposed)
            session.canaryExposed = true;
        for (const p of clean.filePaths ?? []) {
            if (clean.protectedFileAttempt || clean.decision === "block") {
                if (!session.filesBlocked.includes(p))
                    session.filesBlocked.push(p);
                if (clean.protectedFileAttempt && !session.protectedFilesAttempted.includes(p)) {
                    session.protectedFilesAttempted.push(p);
                }
            }
            else if (!session.filesIncluded.includes(p)) {
                session.filesIncluded.push(p);
            }
        }
        if (clean.kind === "approval_granted")
            session.approvals.push(clean.eventId);
        return clean;
    }
    endSession(sessionId, endedAt) {
        const s = this.sessions.get(sessionId);
        if (s)
            s.endedAt = endedAt ?? new Date().toISOString();
        return s;
    }
    clearSession(sessionId) {
        this.sessions.delete(sessionId);
    }
    clearAll() {
        this.sessions.clear();
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    listSessions() {
        return [...this.sessions.values()];
    }
    /**
     * Export all sessions as a redacted report. Every event is re-sanitized on
     * the way out so an export can never contain a raw secret or canary.
     */
    exportRedacted() {
        const sessions = this.listSessions().map((s) => ({
            ...s,
            events: s.events.map(sanitizeMemoryEvent),
        }));
        return { generatedAt: new Date().toISOString(), sessions };
    }
}
exports.MemoryStore = MemoryStore;
/** Rough size estimate for content without storing it. */
function estimateContentSize(text) {
    return text.length;
}
//# sourceMappingURL=MemorySession.js.map