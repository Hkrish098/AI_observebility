from fastapi import APIRouter, HTTPException

from db.supabase_client import get_supabase
from models.schemas import TraceDetail, TraceSummary

router = APIRouter(prefix="/api/traces", tags=["traces"])


@router.get("", response_model=list[TraceSummary])
async def list_traces(flagged_only: bool = False, limit: int = 25):
    client = get_supabase()
    if client is None:
        return []
    query = client.table("agent_traces").select("*").order("created_at", desc=True).limit(limit)
    if flagged_only:
        query = query.eq("is_flagged", True)
    response = query.execute()
    return response.data or []


@router.get("/{trace_id}", response_model=TraceDetail)
async def get_trace(trace_id: str):
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured yet.")
    traces = client.table("agent_traces").select("*").eq("trace_id", trace_id).limit(1).execute()
    if not traces.data:
        raise HTTPException(status_code=404, detail="Trace not found")
    spans = (
        client.table("trace_spans")
        .select("*")
        .eq("trace_id", trace_id)
        .order("created_at")
        .execute()
    )
    row = traces.data[0]
    row["spans"] = spans.data or []
    row["faithfulness_score"] = row.get("evaluation_score")
    return row
