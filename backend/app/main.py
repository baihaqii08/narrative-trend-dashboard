from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, dashboard, entities, graph, posts, search, sentiment, topics
from app.core.config import settings
from app.core.database import Base, engine, neo4j_conn


API_PREFIXES = (settings.API_V1_STR, "/api")


@asynccontextmanager
async def lifespan(application: FastAPI):
    _initialize_database_schema()
    yield
    neo4j_conn.close()


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        lifespan=lifespan,
    )
    _configure_cors(application)
    _register_all_routers(application)
    return application


def _initialize_database_schema() -> None:
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as schema_error:
        print(f"Database initialization warning: {schema_error}")


def _configure_cors(application: FastAPI) -> None:
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _register_all_routers(application: FastAPI) -> None:
    route_specs = [
        (auth.router, "auth", ["Authentication"]),
        (dashboard.router, "dashboard", ["Dashboard"]),
        (sentiment.router, "sentiment", ["Sentiment Analysis"]),
        (topics.router, "topics", ["Topics"]),
        (entities.router, "entities", ["Entities"]),
        (graph.router, "graph", ["Knowledge Graph"]),
        (posts.router, "posts", ["Social Posts"]),
        (search.router, "search", ["Search"]),
    ]

    for prefix in API_PREFIXES:
        for router, resource_path, tags in route_specs:
            application.include_router(
                router,
                prefix=f"{prefix}/{resource_path}",
                tags=tags if prefix == settings.API_V1_STR else [f"{tags[0]} (Alias)"],
            )

        application.include_router(
            graph.router,
            prefix=f"{prefix}/knowledge-graph",
            tags=["Knowledge Graph (Alias)"],
        )


app = create_application()


@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs": "/docs",
    }
