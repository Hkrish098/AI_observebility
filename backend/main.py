from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routers import chat, traces
from services.rag_local import rag_chunk_count, rag_ready

app = FastAPI(
    title="Enterprise Support Agent Observability",
    version="0.1.0",
    description="Trace, score, and flag every step of the support agent pipeline.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://ai-observebility(-[a-z0-9-]+)?\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(traces.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "env": settings.app_env,
        "supabase_configured": settings.supabase_configured,
        "groq_configured": settings.groq_configured,
        "gemini_configured": settings.gemini_configured,
        "cohere_configured": settings.cohere_configured,
        "llm_configured": settings.llm_configured,
        "models": {
            "router": settings.groq_router_model,
            "generation": settings.gemini_model,
            "embedding": settings.gemini_embedding_model,
            "rerank": settings.cohere_rerank_model,
        },
        "prompt_version": settings.prompt_version,
        "rag_ready": rag_ready(),
        "rag_chunks": rag_chunk_count(),
        "rag_embed_model": settings.gemini_embedding_model,
    }
