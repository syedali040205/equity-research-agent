"""FastAPI entry point. Phase 2: tool endpoints + health check."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.research import router as research_router
from api.tools import router as tools_router
from db import healthcheck

app = FastAPI(title="Equity Research Agent API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tools_router)
app.include_router(research_router)


@app.get("/health")
def health():
    return {"status": "ok", **healthcheck()}
