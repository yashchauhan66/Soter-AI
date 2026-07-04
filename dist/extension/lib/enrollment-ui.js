export function enrollmentMarkup(state) {
    if (state.enrollmentStatus === "enrolled")
        return "";
    return `
    <section class="enrollment" data-enrollment-view="not-enrolled">
      <h2>Connect to your Soter organization</h2>
      <p class="help">Enter the enrollment code supplied by your administrator.</p>
      <label>Enrollment code<input data-enrollment-code type="password" autocomplete="off" spellcheck="false" /></label>
      <label>API base URL<input data-api-base-url type="url" value="${escapeHtml(state.config.apiBaseUrl || "http://localhost:3000")}" /></label>
      <button data-enroll>Connect</button>
      <p class="error" data-enrollment-error hidden></p>
    </section>`;
}
export function enrollmentStatusLabel(state) {
    if (state.policy?.emergencyLockdown?.enabled)
        return "Emergency lockdown active";
    if (state.policySyncStatus === "offline")
        return "Offline cached policy";
    if (state.policySyncStatus === "error")
        return "Policy sync failed";
    if (state.enrollmentMode === "managed")
        return "Managed by organization";
    if (state.enrollmentStatus === "enrolled")
        return "Enrolled";
    return "Not enrolled";
}
export function wireEnrollment(root, onComplete) {
    root.querySelector("[data-enroll]")?.addEventListener("click", () => {
        const button = root.querySelector("[data-enroll]");
        const code = root.querySelector("[data-enrollment-code]")?.value.trim() ?? "";
        const apiBaseUrl = root.querySelector("[data-api-base-url]")?.value.trim().replace(/\/$/, "") ?? "";
        const error = root.querySelector("[data-enrollment-error]");
        if (!code || !apiBaseUrl) {
            if (error) {
                error.hidden = false;
                error.textContent = "Enrollment code and API URL are required.";
            }
            return;
        }
        if (button) {
            button.disabled = true;
            button.textContent = "Enrolling…";
        }
        chrome.runtime.sendMessage({ type: "SOTER_ENROLL", enrollmentCode: code, apiBaseUrl }, (response) => {
            const result = response;
            if (result?.ok && result.state)
                return onComplete(result.state);
            if (button) {
                button.disabled = false;
                button.textContent = "Connect";
            }
            if (error) {
                error.hidden = false;
                error.textContent = result?.error ?? "Enrollment failed. Check the code and API URL.";
            }
        });
    });
}
export function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] ?? char));
}
