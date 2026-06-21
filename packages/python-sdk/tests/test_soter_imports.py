"""Test the soter namespace module re-exports."""

from __future__ import annotations

import subprocess
import sys
import textwrap
from pathlib import Path


def test_soter_main_imports():
    """All key names are accessible from the soter top-level module."""
    from soter import (  # noqa: F811
        AsyncSoter,
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

    assert Soter.__name__ == "Soter"
    assert AsyncSoter.__name__ == "AsyncSoter"
    assert issubclass(SoterConfigError, SoterError)
    assert issubclass(SoterAuthError, SoterError)
    assert issubclass(SoterRateLimitError, SoterError)
    assert issubclass(SoterValidationError, SoterError)
    assert issubclass(SoterNetworkError, SoterError)
    assert isinstance(__version__, str)


def test_soter_submodule_exceptions():
    """Sub-module soter.exceptions exports all error classes."""
    from soter.exceptions import (  # noqa: F811
        SoterAuthError,
        SoterConfigError,
        SoterError,
        SoterNetworkError,
        SoterRateLimitError,
        SoterValidationError,
    )

    assert issubclass(SoterConfigError, SoterError)
    assert issubclass(SoterAuthError, SoterError)
    assert issubclass(SoterRateLimitError, SoterError)
    assert issubclass(SoterValidationError, SoterError)
    assert issubclass(SoterNetworkError, SoterError)


def test_soter_submodule_types():
    """Sub-module soter.types exports all type/result classes."""
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
    """Sub-module soter.client exports the sync client."""
    from soter import Soter as TopLevelSoter
    from soter.client import Soter

    assert Soter is TopLevelSoter


def test_soter_submodule_async_client():
    """Sub-module soter.async_client exports the async client."""
    from soter import AsyncSoter as TopLevelAsyncSoter
    from soter.async_client import AsyncSoter

    assert AsyncSoter is TopLevelAsyncSoter


def test_soter_submodule_fastapi():
    """Sub-module soter.fastapi exports create_chat_route."""
    from soter.fastapi import create_chat_route

    assert callable(create_chat_route)


def test_soter_submodule_flask():
    """Sub-module soter.flask exports create_chat_view."""
    from soter.flask import create_chat_view

    assert callable(create_chat_view)


def test_soter_submodule_langchain():
    """Sub-module soter.langchain exports protect_langchain_chain."""
    from soter.langchain import protect_langchain_chain

    assert callable(protect_langchain_chain)


def test_soter_submodule_llamaindex():
    """Sub-module soter.llamaindex exports protect_query_engine."""
    from soter.llamaindex import protect_query_engine

    assert callable(protect_query_engine)


def test_soter_submodule_rag():
    """Sub-module soter.rag exports RAG type classes."""
    from soter import RagSource as TopLevelRagSource
    from soter.rag import ExcludedRagSource, ProtectRagResult, RagSource, SafeRagSource

    assert RagSource is TopLevelRagSource


def test_sync_imports_do_not_require_httpx():
    """Plain sync imports must not require the optional async dependency."""
    script = textwrap.dedent(
        """
        import builtins

        original_import = builtins.__import__

        def blocked_import(name, globals=None, locals=None, fromlist=(), level=0):
            if name == "httpx" or name.startswith("httpx."):
                raise ImportError("blocked httpx for regression test")
            return original_import(name, globals, locals, fromlist, level)

        builtins.__import__ = blocked_import

        import soter

        assert soter.Soter.__name__ == "Soter"

        namespace = {}
        exec("from soter import *", namespace)
        assert namespace["Soter"].__name__ == "Soter"
        assert "AsyncSoter" not in namespace
        """
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=Path(__file__).resolve().parents[1],
        text=True,
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
