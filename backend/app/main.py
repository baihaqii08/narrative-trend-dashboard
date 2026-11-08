from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, dashboard, entities, graph, posts, search, sentiment, topics
from app.core.config import settings


FALLBACK_API_PREFIXES = ("/api/v1", "")


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
    )
    _configure_cors(application)
    _register_primary_routers(application)
    _register_compatibility_aliases(application)
    return application


def _configure_cors(application: FastAPI) -> None:
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_origin_regex=r".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _register_primary_routers(application: FastAPI) -> None:
    primary_prefix = settings.API_V1_STR
    application.include_router(auth.router, prefix=f"{primary_prefix}/auth", tags=["auth"])
    application.include_router(dashboard.router, prefix=f"{primary_prefix}/dashboard", tags=["dashboard"])
    application.include_router(sentiment.router, prefix=f"{primary_prefix}/sentiment", tags=["sentiment"])
    application.include_router(topics.router, prefix=f"{primary_prefix}/topics", tags=["topics"])
    application.include_router(graph.router, prefix=f"{primary_prefix}/graph", tags=["graph"])
    application.include_router(search.router, prefix=f"{primary_prefix}/search", tags=["search"])
    application.include_router(posts.router, prefix=f"{primary_prefix}/posts", tags=["posts"])
    application.include_router(entities.router, prefix=f"{primary_prefix}/entities", tags=["entities"])


def _register_compatibility_aliases(application: FastAPI) -> None:
    primary_prefix = settings.API_V1_STR
    application.include_router(
        sentiment.router,
        prefix=f"{primary_prefix}/dashboard/sentiment",
        include_in_schema=False,
    )
    application.include_router(
        entities.router,
        prefix=f"{primary_prefix}/dashboard/entities",
        include_in_schema=False,
    )
    application.include_router(
        dashboard.router,
        prefix=primary_prefix,
        include_in_schema=False,
    )

    for prefix in FALLBACK_API_PREFIXES:
        application.include_router(auth.router, prefix=f"{prefix}/auth", include_in_schema=False)
        application.include_router(dashboard.router, prefix=f"{prefix}/dashboard", include_in_schema=False)
        application.include_router(sentiment.router, prefix=f"{prefix}/sentiment", include_in_schema=False)
        application.include_router(topics.router, prefix=f"{prefix}/topics", include_in_schema=False)
        application.include_router(graph.router, prefix=f"{prefix}/graph", include_in_schema=False)
        application.include_router(search.router, prefix=f"{prefix}/search", include_in_schema=False)
        application.include_router(posts.router, prefix=f"{prefix}/posts", include_in_schema=False)
        application.include_router(entities.router, prefix=f"{prefix}/entities", include_in_schema=False)


app = create_application()


@app.middleware("http")
async def log_requests(request: Request, call_next):
    client_host = request.client.host if request.client else "unknown"
    print(f"\n📡 [INCOMING REQUEST] {request.method} {request.url.path} from {client_host}")
    response = await call_next(request)
    print(f"   ↳ [STATUS CODE] {response.status_code}")
    return response


@app.get("/")
def read_root():
    return {"message": "Welcome to Medallion Data Pipeline API"}
