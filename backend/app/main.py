from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import auth, dashboard, search, sentiment, graph, topics, posts, entities

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Logger Middleware to inspect incoming requests from FE
@app.middleware("http")
async def log_requests(request: Request, call_next):
    client_host = request.client.host if request.client else "unknown"
    print(f"\n📡 [INCOMING REQUEST] {request.method} {request.url.path} from {client_host}")
    response = await call_next(request)
    print(f"   ↳ [STATUS CODE] {response.status_code}")
    return response

# Set all CORS enabled origins (allow all origins during development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount primary routes under /api (Following PRD Section 12)
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["dashboard"])
app.include_router(sentiment.router, prefix=f"{settings.API_V1_STR}/sentiment", tags=["sentiment"])
app.include_router(topics.router, prefix=f"{settings.API_V1_STR}/topics", tags=["topics"])
app.include_router(graph.router, prefix=f"{settings.API_V1_STR}/graph", tags=["graph"])
app.include_router(search.router, prefix=f"{settings.API_V1_STR}/search", tags=["search"])
app.include_router(posts.router, prefix=f"{settings.API_V1_STR}/posts", tags=["posts"])
app.include_router(entities.router, prefix=f"{settings.API_V1_STR}/entities", tags=["entities"])

# Mount sentiment & entities under /api/dashboard/... as well for compatibility
app.include_router(sentiment.router, prefix=f"{settings.API_V1_STR}/dashboard/sentiment", include_in_schema=False)
app.include_router(entities.router, prefix=f"{settings.API_V1_STR}/dashboard/entities", include_in_schema=False)
# Mount dashboard directly under /api for compatibility with /api/overview
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}", include_in_schema=False)

# Fallback aliases to support common variations (/api/v1/... and direct root prefixes)
for prefix in ["/api/v1", ""]:
    app.include_router(auth.router, prefix=f"{prefix}/auth", include_in_schema=False)
    app.include_router(dashboard.router, prefix=f"{prefix}/dashboard", include_in_schema=False)
    app.include_router(sentiment.router, prefix=f"{prefix}/sentiment", include_in_schema=False)
    app.include_router(topics.router, prefix=f"{prefix}/topics", include_in_schema=False)
    app.include_router(graph.router, prefix=f"{prefix}/graph", include_in_schema=False)
    app.include_router(search.router, prefix=f"{prefix}/search", include_in_schema=False)
    app.include_router(posts.router, prefix=f"{prefix}/posts", include_in_schema=False)
    app.include_router(entities.router, prefix=f"{prefix}/entities", include_in_schema=False)

@app.get("/")
def read_root():
    return {"message": "Welcome to Medallion Data Pipeline API"}

