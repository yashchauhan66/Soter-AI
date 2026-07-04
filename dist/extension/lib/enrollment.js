/**
 * Employee enrollment flow for the Soter extension.
 *
 * Supports two modes:
 * A. Managed Enterprise Mode - config from chrome.storage.managed
 * B. Self-Service Enrollment Mode - enrollment code/magic link
 */
import { getState, setState } from "./storage.js";
export const ENROLLMENT_STATUS_KEY = "soter.enrollment.status";
/**
 * Check chrome.storage.managed for enterprise-managed configuration.
 * This is set via Chrome/Edge group policy (ADM/GPO/MDM).
 */
export async function readManagedConfig() {
    try {
        const storage = (typeof chrome !== "undefined" ? chrome : null);
        if (!storage?.storage?.managed)
            return null;
        const config = await new Promise((resolve) => {
            storage.storage.managed.get(null, (result) => resolve(result));
        });
        if (!config.organizationId && !config.apiBaseUrl)
            return null;
        return config;
    }
    catch {
        return null;
    }
}
/**
 * Validate that a managed config has the minimum required fields.
 */
export function validateManagedConfig(config) {
    const required = ["organizationId"];
    const missing = required.filter(key => !config[key]);
    return { valid: missing.length === 0, missing };
}
/**
 * Try to enroll from managed configuration.
 */
export async function enrollFromManagedConfig() {
    const managed = await readManagedConfig();
    if (!managed) {
        return { mode: "unenrolled", status: "unenrolled", managedValid: false };
    }
    const validation = validateManagedConfig(managed);
    if (!validation.valid) {
        return {
            mode: "managed",
            status: "unenrolled",
            managedValid: false,
            organizationId: managed.organizationId,
        };
    }
    // Build config from managed settings
    const config = {
        apiBaseUrl: managed.apiBaseUrl || "https://api.soter.ai",
        organizationId: managed.organizationId,
        employeeId: managed.employeeId || managed.email || "unknown",
        employeeEmail: managed.email,
        department: managed.department,
        role: managed.role,
        deviceToken: managed.deviceToken,
    };
    await setState({
        config: config,
        enrollmentStatus: "enrolled",
        enrollmentMode: "managed",
    });
    return {
        mode: "managed",
        status: "enrolled",
        organizationId: managed.organizationId,
        employeeId: managed.employeeId || managed.email,
        department: managed.department,
        role: managed.role,
        deviceToken: managed.deviceToken,
        enrolledAt: new Date().toISOString(),
        managedValid: true,
    };
}
/**
 * Self-service enrollment using an enrollment code.
 * Calls POST /api/extension/enroll with the code.
 */
export async function enrollWithCode(apiBaseUrl, enrollmentCode) {
    try {
        const response = await fetch(`${apiBaseUrl}/api/extension/enroll`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ enrollmentCode }),
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            return { ok: false, error: body.message || `Enrollment failed: ${response.status}` };
        }
        const data = await response.json();
        // Store only safe credentials locally
        const config = {
            apiBaseUrl: typeof data.apiBaseUrl === "string" ? data.apiBaseUrl : apiBaseUrl,
            organizationId: data.organizationId,
            organizationName: data.organizationName,
            employeeId: data.employeeId,
            employeeEmail: data.employeeEmail,
            department: data.department,
            role: data.role,
            deviceToken: data.deviceToken,
        };
        await setState({
            config,
            enrollmentStatus: "enrolled",
            enrollmentMode: "self_service",
            policySyncStatus: "fresh",
        });
        return {
            ok: true,
            info: {
                mode: "self_service",
                status: "enrolled",
                organizationId: data.organizationId,
                employeeId: data.employeeId,
                department: data.department,
                role: data.role,
                deviceToken: data.deviceToken,
                enrolledAt: new Date().toISOString(),
                managedValid: false,
            },
        };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Enrollment request failed",
        };
    }
}
/**
 * Get the current enrollment status from state.
 */
export async function getEnrollmentStatus() {
    const state = await getState();
    // Check managed config first
    const managed = await readManagedConfig();
    if (managed && managed.organizationId) {
        const validation = validateManagedConfig(managed);
        return {
            mode: "managed",
            status: validation.valid ? "enrolled" : "unenrolled",
            organizationId: managed.organizationId,
            employeeId: managed.employeeId || managed.email,
            department: managed.department,
            role: managed.role,
            managedValid: validation.valid,
            enrolledAt: state.enrollmentStatus === "enrolled" ? state.lastHeartbeatAt : undefined,
        };
    }
    if (state.enrollmentStatus === "enrolled") {
        return {
            mode: "self_service",
            status: "enrolled",
            organizationId: state.config.organizationId,
            employeeId: state.config.employeeId,
            department: state.config.department,
            role: state.config.role,
            deviceToken: state.config.deviceToken,
            enrolledAt: state.lastHeartbeatAt,
            managedValid: false,
        };
    }
    return { mode: "unenrolled", status: "unenrolled", managedValid: false };
}
/**
 * Unenroll (remove local state).
 */
export async function unenroll() {
    await setState({
        enrollmentStatus: "unenrolled",
        enrollmentMode: undefined,
        config: {
            apiBaseUrl: "http://localhost:3000",
            organizationId: "",
            employeeId: "",
        },
        policySyncStatus: "never",
        policy: undefined,
    });
    // Clear enrollment-specific storage (chrome.storage available at runtime only)
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ext = (typeof chrome !== "undefined" ? chrome : null);
        if (ext?.storage?.local?.remove)
            ext.storage.local.remove([ENROLLMENT_STATUS_KEY]);
    }
    catch { /* storage not available */ }
}
