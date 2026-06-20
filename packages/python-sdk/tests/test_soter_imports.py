"""Test the soter namespace module re-exports."""

from __future__ import annotations


def test_soter_main_imports():
    """All key names are accessible from the soter top-level module."""
    from soter import (  # noqa: F811
        AsyncCyberRakshakGuard,
        AsyncSoter,
        CyberRakshakAuthError,
        CyberRakshakConfigError,
        CyberRakshakError,
        CyberRakshakGuard,
        CyberRakshakNetworkError,
        CyberRakshakRateLimitError,
        CyberRakshakValidationError,
        ExcludedRagSource,
        GuardFinding,
        GuardResult,
        ProtectChatResult,
        ProtectRagResult,
        RagSource,
        SafeRagSource,
        Soter,
        SoterAuthError,
        SoterConfigError,
        SoterError,
        SoterNetworkError,
        SoterRateLimitError,
        SoterValidationError,
        __version__,
    )
    assert Soter is CyberRakshakGuard
    assert SoterError is CyberRakshakError
    assert SoterConfigError is CyberRakshakConfigError
    assert SoterAuthError is CyberRakshakAuthError
    assert SoterRateLimitError is CyberRakshakRateLimitError
    assert SoterValidationError is CyberRakshakValidationError
    assert SoterNetworkError is CyberRakshakNetworkError
    assert isinstance(__version__, str)


def test_soter_submodule_exceptions():
    """Sub-module soter.exceptions re-exports all error classes."""
    from soter.exceptions import (  # noqa: F811
        CyberRakshakAuthError,
        CyberRakshakConfigError,
        CyberRakshakError,
        CyberRakshakNetworkError,
        CyberRakshakRateLimitError,
        CyberRakshakValidationError,
        SoterAuthError,
        SoterConfigError,
        SoterError,
        SoterNetworkError,
        SoterRateLimitError,
        SoterValidationError,
    )

    assert SoterError is CyberRakshakError


def test_soter_submodule_types():
    """Sub-module soter.types re-exports all type/result classes."""
    from soter.types import (  # noqa: F811
        ExcludedRagSource,
        GuardAction,
        GuardDirection,
        GuardFinding,
        GuardResult,
        LLM_SAFE_ACTIONS,
        ProtectChatResult,
        ProtectRagResult,
        RagSource,
        SafeRagSource,
    )

    assert isinstance(LLM_SAFE_ACTIONS, frozenset)
    assert "ALLOW" in LLM_SAFE_ACTIONS


def test_soter_submodule_client():
    """Sub-module soter.client re-exports the sync client."""
    from soter.client import CyberRakshakGuard
    from cyberrakshak_guard import CyberRakshakGuard as _Original

    assert CyberRakshakGuard is _Original


def test_soter_submodule_async_client():
    """Sub-module soter.async_client re-exports the async client."""
    from soter.async_client import AsyncCyberRakshakGuard
    from cyberrakshak_guard.async_client import AsyncCyberRakshakGuard as _Original

    assert AsyncCyberRakshakGuard is _Original


def test_soter_submodule_fastapi():
    """Sub-module soter.fastapi re-exports create_chat_route."""
    from soter.fastapi import create_chat_route
    from cyberrakshak_guard.fastapi import create_chat_route as _Original

    assert create_chat_route is _Original


def test_soter_submodule_flask():
    """Sub-module soter.flask re-exports create_chat_view."""
    from soter.flask import create_chat_view
    from cyberrakshak_guard.flask import create_chat_view as _Original

    assert create_chat_view is _Original


def test_soter_submodule_langchain():
    """Sub-module soter.langchain re-exports protect_langchain_chain."""
    from soter.langchain import protect_langchain_chain
    from cyberrakshak_guard.langchain import protect_langchain_chain as _Original

    assert protect_langchain_chain is _Original


def test_soter_submodule_llamaindex():
    """Sub-module soter.llamaindex re-exports protect_query_engine."""
    from soter.llamaindex import protect_query_engine
    from cyberrakshak_guard.llamaindex import protect_query_engine as _Original

    assert protect_query_engine is _Original


def test_soter_submodule_rag():
    """Sub-module soter.rag re-exports RAG type classes."""
    from soter.rag import (  # noqa: F811
        ExcludedRagSource,
        ProtectRagResult,
        RagSource,
        SafeRagSource,
    )

    from soter import RagSource as _TopLevel
    assert RagSource is _TopLevel
