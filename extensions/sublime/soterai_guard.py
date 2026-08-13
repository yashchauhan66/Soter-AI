"""SoterAI IDE Guard - Sublime Text package (thin adapter).

This plugin is intentionally thin. It captures editor content or selections and
forwards them to the local SoterAI broker over the documented loopback HTTP
contract. It does not reimplement any detector, redactor or policy: those live
in the shared Local AI Broker.

Network calls run on a background thread so the Sublime plugin host is never
blocked. Any edit that changes the buffer (redaction) is applied back on the
main thread through a dedicated TextCommand, because Sublime `edit` tokens are
only valid inside the originating command run.
"""

import threading

import sublime
import sublime_plugin

try:
    from . import broker_client
except (ImportError, ValueError):  # pragma: no cover - standalone import fallback
    import broker_client

SETTINGS_FILE = "SoterAI Guard.sublime-settings"
PANEL_NAME = "soterai_guard"


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _settings():
    return sublime.load_settings(SETTINGS_FILE)


def _build_client():
    """Construct a broker client from settings on the calling (main) thread.

    Sublime API access (load_settings) happens here; the returned client is a
    plain object with no Sublime dependency and is safe to use from a worker
    thread.
    """
    settings = _settings()
    return broker_client.BrokerClient(
        settings.get("broker_url", broker_client.DEFAULT_BROKER_URL),
        broker_client.resolve_token(
            settings.get("token", "") or "",
            settings.get("token_path", "") or "",
        ),
        settings.get("timeout_seconds", 10),
    )


def _status(message):
    sublime.status_message(message)


def _show_output(window, text):
    if window is None:
        window = sublime.active_window()
    panel = window.create_output_panel(PANEL_NAME)
    panel.set_read_only(False)
    panel.run_command("append", {"characters": text})
    panel.set_read_only(True)
    window.run_command("show_panel", {"panel": "output." + PANEL_NAME})


def _run_async(task, on_done):
    """Run task() on a worker thread and deliver (result, error) on the main thread."""

    def worker():
        result = None
        error = None
        try:
            result = task()
        except Exception as exc:  # noqa: BLE001 - surfaced to the user, not swallowed
            error = exc
        sublime.set_timeout(lambda: on_done(result, error), 0)

    threading.Thread(target=worker, daemon=True).start()


def _yes_no(value):
    return "yes" if value else "no"


def _format_scan(result):
    lines = ["SoterAI IDE Guard - scan result", ""]
    lines.append("Decision: {}".format(result.get("decision", "unknown")))
    if "riskScore" in result:
        lines.append("Risk score: {}".format(result.get("riskScore")))
    if "safe" in result:
        lines.append("Safe: {}".format(_yes_no(result.get("safe"))))
    categories = result.get("categories") or []
    if categories:
        lines.append("Categories: {}".format(", ".join(str(c) for c in categories)))
    if "canaryInRequest" in result:
        lines.append("Canary token in content: {}".format(_yes_no(result.get("canaryInRequest"))))
    if result.get("contentHash"):
        lines.append("Content hash: {}".format(result.get("contentHash")))
    evidence = result.get("evidencePreview")
    if evidence:
        lines.append("")
        lines.append("Redacted evidence preview:")
        lines.append(str(evidence))
    lines.append("")
    lines.append(
        "Note: findings are produced locally by the broker. Raw source is not "
        "uploaded to SoterAI Cloud by default."
    )
    return "\n".join(lines)


def _handle_scan(window, result, error):
    if error is not None:
        _show_output(window, "Scan failed.\n\n{}".format(error))
        _status("SoterAI: scan failed.")
        return
    _show_output(window, _format_scan(result or {}))
    _status("SoterAI: scan complete ({}).".format((result or {}).get("decision", "unknown")))


# --------------------------------------------------------------------------
# scan commands
# --------------------------------------------------------------------------

class SoteraiScanFileCommand(sublime_plugin.TextCommand):
    def run(self, edit):
        window = self.view.window()
        content = self.view.substr(sublime.Region(0, self.view.size()))
        if not content.strip():
            _show_output(window, "Nothing to scan: the file is empty.")
            return
        client = _build_client()
        _status("SoterAI: scanning file...")
        _run_async(lambda: client.scan(content=content),
                   lambda result, error: _handle_scan(window, result, error))


class SoteraiScanSelectionCommand(sublime_plugin.TextCommand):
    def run(self, edit):
        window = self.view.window()
        parts = [self.view.substr(region) for region in self.view.sel() if not region.empty()]
        content = "\n".join(part for part in parts if part)
        if not content.strip():
            _show_output(window, "Select some text to scan first.")
            return
        client = _build_client()
        _status("SoterAI: scanning selection...")
        _run_async(lambda: client.scan(content=content),
                   lambda result, error: _handle_scan(window, result, error))


# --------------------------------------------------------------------------
# redaction commands
# --------------------------------------------------------------------------

class SoteraiApplyRedactionCommand(sublime_plugin.TextCommand):
    """Internal command: apply broker redactions back into the buffer.

    Replacements are [start, end, text]. They are applied from the end of the
    buffer backwards so earlier offsets are not invalidated by earlier edits.
    """

    def run(self, edit, replacements):
        ordered = sorted(replacements, key=lambda item: item[0], reverse=True)
        for start, end, text in ordered:
            self.view.replace(edit, sublime.Region(start, end), text)


class SoteraiRedactSelectionCommand(sublime_plugin.TextCommand):
    def run(self, edit):
        view = self.view
        window = view.window()
        regions = [region for region in view.sel() if not region.empty()]
        if not regions:
            _show_output(window, "Select some text to redact first.")
            return
        spans = [(region.begin(), region.end()) for region in regions]
        texts = [view.substr(region) for region in regions]
        client = _build_client()
        _status("SoterAI: redacting selection locally...")

        def task():
            return [client.redact(text) for text in texts]

        def on_done(redacted, error):
            if error is not None:
                _show_output(window, "Redaction failed.\n\n{}".format(error))
                _status("SoterAI: redaction failed.")
                return
            replacements = []
            for (start, end), text in zip(spans, redacted):
                replacements.append([start, end, text])
            view.run_command("soterai_apply_redaction", {"replacements": replacements})
            _status("SoterAI: selection redacted locally.")

        _run_async(task, on_done)


class SoteraiSafePromptCommand(sublime_plugin.TextCommand):
    """Redact the selection (or whole file) and copy the safe text to the clipboard.

    The buffer is not modified; only a redacted copy is placed on the clipboard.
    """

    def run(self, edit):
        view = self.view
        window = view.window()
        regions = [region for region in view.sel() if not region.empty()]
        if regions:
            source = "\n".join(view.substr(region) for region in regions)
        else:
            source = view.substr(sublime.Region(0, view.size()))
        if not source.strip():
            _show_output(window, "Nothing to redact: select text or open a non-empty file.")
            return
        client = _build_client()
        _status("SoterAI: preparing safe prompt...")

        def on_done(redacted, error):
            if error is not None:
                _show_output(window, "Safe prompt failed.\n\n{}".format(error))
                _status("SoterAI: safe prompt failed.")
                return
            sublime.set_clipboard(redacted or "")
            _show_output(
                window,
                "Redacted, safe-to-paste text copied to the clipboard.\n\n"
                "----- preview -----\n{}".format(redacted or ""),
            )
            _status("SoterAI: safe prompt copied to clipboard.")

        _run_async(lambda: client.redact(source), on_done)


# --------------------------------------------------------------------------
# broker / safe mode commands
# --------------------------------------------------------------------------

def _format_egress(url, result):
    action = (result or {}).get("action", "UNKNOWN")
    cleared = broker_client.egress_allows_send(action)
    lines = ["SoterAI IDE Guard - egress check", ""]
    lines.append("CLEARED TO SEND" if cleared else "NOT CLEARED TO SEND")
    lines.append("Destination: {}".format((result or {}).get("host") or url))
    lines.append("Action: {}".format(action))
    lines.append("Risk score: {}".format((result or {}).get("riskScore", 0)))
    reasons = (result or {}).get("reasonCodes") or []
    if reasons:
        lines.append("Reasons: {}".format(", ".join(str(r) for r in reasons)))
    explanation = (result or {}).get("explanation")
    if explanation:
        lines.append("")
        lines.append(str(explanation))
    return "\n".join(lines)


class SoteraiCheckEgressCommand(sublime_plugin.TextCommand):
    """Pre-send check: may this selection (or file) go to this destination?

    Prompts for the destination URL, then asks the broker's egress preflight.
    Nothing is transmitted to that destination by this command -- it only asks
    the local broker whether a send would be permitted.
    """

    def run(self, edit):
        view = self.view
        window = view.window()
        if window is None:
            return
        window.show_input_panel(
            "Destination URL:", "https://", self._on_url, None, None
        )

    def _on_url(self, url):
        view = self.view
        window = view.window()
        url = (url or "").strip()
        if not url:
            _status("SoterAI: no destination URL given.")
            return
        regions = [region for region in view.sel() if not region.empty()]
        if regions:
            source = "\n".join(view.substr(region) for region in regions)
        else:
            source = view.substr(sublime.Region(0, view.size()))
        if not source.strip():
            _show_output(window, "Nothing to check: select text or open a non-empty file.")
            return
        client = _build_client()
        _status("SoterAI: checking egress...")

        def on_done(result, error):
            if error is not None:
                # An unreachable broker is NOT clearance. Say so explicitly.
                _show_output(
                    window,
                    "Egress check failed - treat this as NOT cleared to send.\n\n{}".format(error),
                )
                _status("SoterAI: egress check failed (not cleared).")
                return
            _show_output(window, _format_egress(url, result or {}))
            action = (result or {}).get("action", "UNKNOWN")
            _status(
                "SoterAI: {} ({}).".format(
                    "cleared to send" if broker_client.egress_allows_send(action)
                    else "NOT cleared to send",
                    action,
                )
            )

        _run_async(lambda: client.check_egress(url, source), on_done)


class SoteraiBrokerStatusCommand(sublime_plugin.WindowCommand):
    def run(self):
        window = self.window
        client = _build_client()
        _status("SoterAI: checking broker...")

        def task():
            report = {}
            # Health needs no auth; try it first so we can always say something.
            try:
                report["health"] = client.health()
            except broker_client.BrokerError as exc:
                report["health_error"] = str(exc)
            try:
                report["version"] = client.version()
            except broker_client.BrokerError as exc:
                report["version_error"] = str(exc)
            try:
                report["safe_mode"] = client.safe_mode_status()
            except broker_client.BrokerError as exc:
                report["safe_mode_error"] = str(exc)
            return report

        def on_done(report, error):
            if error is not None:
                _show_output(window, "Broker status unavailable.\n\n{}".format(error))
                _status("SoterAI: broker unavailable.")
                return
            _show_output(window, _format_status(report or {}))
            _status("SoterAI: broker status ready.")

        _run_async(task, on_done)


def _format_status(report):
    lines = ["SoterAI IDE Guard - broker status", ""]
    lines.append("URL: {}".format(_settings().get("broker_url", broker_client.DEFAULT_BROKER_URL)))

    health = report.get("health")
    if health is not None:
        lines.append("Health: {}".format(health.get("status", "unknown")))
    elif report.get("health_error"):
        lines.append("Health: unreachable ({})".format(report["health_error"]))

    version = report.get("version")
    if version is not None:
        lines.append("Version: {}".format(version.get("version", "unknown")))
    elif report.get("version_error"):
        lines.append("Version: unavailable ({})".format(report["version_error"]))

    safe_mode = report.get("safe_mode")
    if safe_mode is not None:
        lines.append("Safe Mode: {} (level: {})".format(
            "on" if safe_mode.get("enabled") else "off",
            safe_mode.get("level", "n/a"),
        ))
    elif report.get("safe_mode_error"):
        lines.append("Safe Mode: unavailable ({})".format(report["safe_mode_error"]))

    return "\n".join(lines)


class SoteraiSafeModeToggleCommand(sublime_plugin.WindowCommand):
    def run(self):
        window = self.window
        client = _build_client()
        level = _settings().get("safe_mode_level", "developer")
        _status("SoterAI: toggling Safe Mode...")

        def task():
            status = client.safe_mode_status()
            if status.get("enabled"):
                client.safe_mode_disable()
                return False
            client.safe_mode_enable(level)
            return True

        def on_done(enabled, error):
            if error is not None:
                _show_output(window, "Safe Mode toggle failed.\n\n{}".format(error))
                _status("SoterAI: Safe Mode toggle failed.")
                return
            state = "ON (level: {})".format(level) if enabled else "OFF"
            _show_output(window, "Safe Mode is now {}.".format(state))
            _status("SoterAI: Safe Mode {}.".format("on" if enabled else "off"))

        _run_async(task, on_done)
