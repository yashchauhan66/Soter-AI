"""NO-MODEL regressions for cancellation-group cleanup diagnostics."""

import asyncio
import traceback

import pytest

from eval_harness.tests.test_inference import _unit_cleanup_diagnostic_action

SEAMS = (
    "capture", "constructor", "context-exit",
    "status-capture", "status-constructor", "status-context-exit",
)


def _group(label, nested):
    children = [
        KeyboardInterrupt(f"{label} keyboard cancellation"),
        SystemExit(7 if label == "primary" else 9),
        asyncio.CancelledError(f"{label} task cancellation"),
        ValueError(f"{label} ordinary child"),
    ]
    if nested:
        children = [BaseExceptionGroup(f"{label} inner", children)]
    group = BaseExceptionGroup(f"{label} group", children)
    group.add_note(f"{label} pre-existing note")
    return group


def _group_state(error):
    """Freeze every group/leaf payload, not mutable traceback or chaining state."""
    if not isinstance(error, BaseExceptionGroup):
        return []
    state = [(error, error.args, str(error), error.message, error.exceptions,
              tuple(getattr(error, "__notes__", ())), None)]
    for child in error.exceptions:
        if isinstance(child, BaseExceptionGroup):
            state.extend(_group_state(child))
        else:
            state.append((child, child.args, str(child), None, None,
                          tuple(getattr(child, "__notes__", ())),
                          child.code if isinstance(child, SystemExit) else None))
    return state


def _assert_group_state_unchanged(state):
    for error, args, text, message, children, notes, exit_code in state:
        assert error.args is args, "Cleanup diagnostics mutated a group/leaf payload"
        assert str(error) == text
        assert tuple(getattr(error, "__notes__", ()))[:len(notes)] == notes
        if isinstance(error, BaseExceptionGroup):
            assert error.message == message
            assert error.exceptions is children
        if isinstance(error, SystemExit):
            assert error.code == exit_code


def _assert_cleanup(state, seam):
    assert state["cleanup_calls"] == 1
    assert len(state["consumer_states"]) == (0 if seam.endswith("capture") else 1)
    assert all(all(row.values()) for row in state["consumer_states"])


@pytest.mark.parametrize("seam", SEAMS)
@pytest.mark.parametrize("nested", [False, True], ids=["flat", "nested"])
@pytest.mark.parametrize("pair", [
    "primary-group", "cleanup-group", "both-groups",
    "group-primary-scalar-cleanup", "scalar-primary-group-cleanup",
])
def test_group_cleanup_preserves_payload_and_supported_diagnostics(
        tmp_path, monkeypatch, seam, nested, pair):
    primary = ValueError("primary ordinary rejection")
    cleanup = PermissionError(13, "secondary cleanup rejection", "UNIT-ONLY/private")
    if pair in {"primary-group", "both-groups", "group-primary-scalar-cleanup"}:
        primary = _group("primary", nested)
    if pair in {"cleanup-group", "both-groups", "scalar-primary-group-cleanup"}:
        cleanup = _group("cleanup", nested)
    if pair == "group-primary-scalar-cleanup":
        cleanup = SystemExit(9)
    if pair == "scalar-primary-group-cleanup":
        primary = SystemExit(7)
    selected = primary if not isinstance(primary, Exception) else cleanup
    other = cleanup if selected is primary else primary
    primary_text, cleanup_text = str(primary), str(cleanup)
    frozen = _group_state(primary) + _group_state(cleanup)
    with monkeypatch.context() as patch:
        action, state = _unit_cleanup_diagnostic_action(
            tmp_path, patch, seam, primary, cleanup)
        # The real status API must propagate cancellation, never publish a record.
        with pytest.raises(BaseException) as caught:
            action()
        assert caught.value is selected
        assert selected.__cause__ is other
        _assert_cleanup(state, seam)
        _assert_group_state_unchanged(frozen)
        assert not isinstance(selected, Exception)
        for error, code in ((primary, 7), (cleanup, 9)):
            if isinstance(error, SystemExit):
                assert error.code == code
        rendered = "".join(traceback.format_exception(caught.value))
        assert primary_text in rendered
        assert cleanup_text in rendered
        for _, _, text, _, _, notes, _ in frozen:
            assert text in rendered
            assert all(note in rendered for note in notes)


@pytest.mark.parametrize("seam", SEAMS)
@pytest.mark.parametrize("nested", [False, True], ids=["flat", "nested"])
def test_group_primary_with_successful_cleanup_is_unchanged(
        tmp_path, monkeypatch, seam, nested):
    primary = _group("primary", nested)
    frozen = _group_state(primary)
    with monkeypatch.context() as patch:
        action, state = _unit_cleanup_diagnostic_action(
            tmp_path, patch, seam, primary, None)
        with pytest.raises(BaseExceptionGroup) as caught:
            action()
        assert caught.value is primary
        _assert_group_state_unchanged(frozen)
        _assert_cleanup(state, seam)


@pytest.mark.parametrize("nested", [False, True], ids=["flat", "nested"])
def test_group_cleanup_without_primary_is_unchanged(tmp_path, monkeypatch, nested):
    cleanup = _group("cleanup", nested)
    frozen = _group_state(cleanup)
    with monkeypatch.context() as patch:
        action, state = _unit_cleanup_diagnostic_action(
            tmp_path, patch, "context-exit", None, cleanup)
        with pytest.raises(BaseExceptionGroup) as caught:
            action()
        assert caught.value is cleanup
        _assert_group_state_unchanged(frozen)
        _assert_cleanup(state, "context-exit")
