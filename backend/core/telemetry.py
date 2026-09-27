from __future__ import annotations

import asyncio
import functools
import inspect
import json
import time
import traceback
from contextvars import ContextVar
from typing import Any, Awaitable, Callable
from uuid import UUID, uuid4

from db.supabase_client import get_supabase
from models.schemas import SpanRecord, SpanType

current_trace_id: ContextVar[UUID | None] = ContextVar("current_trace_id", default=None)
_span_buffer: ContextVar[list[SpanRecord] | None] = ContextVar("span_buffer", default=None)


def json_safe(value: Any) -> Any:
    try:
        json.dumps(value)
        return value
    except TypeError:
        if hasattr(value, "model_dump"):
            return value.model_dump(mode="json")
        if isinstance(value, dict):
            return {str(k): json_safe(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [json_safe(v) for v in value]
        return str(value)


def bind_trace(trace_id: UUID) -> None:
    current_trace_id.set(trace_id)
    _span_buffer.set([])


def collected_spans() -> list[SpanRecord]:
    return list(_span_buffer.get() or [])


def _record_span(record: SpanRecord) -> None:
    buffer = _span_buffer.get()
    if buffer is None:
        buffer = []
        _span_buffer.set(buffer)
    buffer.append(record)


async def persist_span(record: SpanRecord) -> None:
    client = get_supabase()
    if client is None:
        return
    payload = {
        "span_id": str(record.span_id),
        "trace_id": str(record.trace_id),
        "span_type": record.span_type,
        "input_payload": record.input_payload,
        "output_payload": record.output_payload,
        "latency_ms": record.latency_ms,
        "status": record.status,
    }
    try:
        await asyncio.to_thread(lambda: client.table("trace_spans").insert(payload).execute())
    except Exception:
        return


async def persist_trace(row: dict[str, Any]) -> bool:
    client = get_supabase()
    if client is None:
        return False
    try:
        await asyncio.to_thread(lambda: client.table("agent_traces").insert(row).execute())
        return True
    except Exception:
        return False


async def update_trace(trace_id: UUID, values: dict[str, Any]) -> None:
    client = get_supabase()
    if client is None:
        return
    try:
        await asyncio.to_thread(
            lambda: client.table("agent_traces").update(values).eq("trace_id", str(trace_id)).execute()
        )
    except Exception:
        return


class SpanContext:
    def __init__(self, span_type: SpanType, input_payload: dict[str, Any] | None = None):
        self.span_type = span_type
        self.span_id = uuid4()
        self.trace_id = current_trace_id.get() or uuid4()
        self.input_payload = json_safe(input_payload) if input_payload is not None else {}
        self.output_payload: dict[str, Any] = {}
        self.status = "ok"
        self._started = 0.0
        self.latency_ms = 0

    def set_output(self, value: Any) -> None:
        self.output_payload = json_safe(value) if isinstance(value, dict) else {"result": json_safe(value)}


class observe_span:
    """Use as `async with observe_span("router", payload)` or `@observe_span("llm")`."""

    def __init__(self, span_type: SpanType, input_payload: dict[str, Any] | None = None):
        self.span_type = span_type
        self.input_payload = input_payload
        self._span: SpanContext | None = None

    def __call__(self, fn: Callable[..., Awaitable[Any]]):
        if not inspect.iscoroutinefunction(fn):
            raise TypeError("@observe_span can only wrap async functions")

        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any):
            payload = {"args": json_safe(args[1:] if args else []), "kwargs": json_safe(kwargs)}
            async with observe_span(self.span_type, payload) as span:
                result = await fn(*args, **kwargs)
                span.set_output(result)
                return result

        return wrapper

    async def __aenter__(self) -> SpanContext:
        self._span = SpanContext(self.span_type, self.input_payload)
        self._span._started = time.perf_counter()
        return self._span

    async def __aexit__(self, exc_type, exc, tb) -> None:
        span = self._span
        if span is None:
            return
        if exc is not None:
            span.status = "error"
            span.output_payload = {"error": str(exc), "traceback": traceback.format_exc()}
        span.latency_ms = int((time.perf_counter() - span._started) * 1000)
        record = SpanRecord(
            span_id=span.span_id,
            trace_id=span.trace_id,
            span_type=span.span_type,
            input_payload=span.input_payload,
            output_payload=span.output_payload,
            latency_ms=span.latency_ms,
            status=span.status,
        )
        _record_span(record)
        asyncio.create_task(persist_span(record))
