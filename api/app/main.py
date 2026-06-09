from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes.health import router as health_router
from app.routes.profiles import router as profiles_router
from app.routes.progress import router as progress_router
from app.routes.trips import router as trips_router
from app.routes.vessels import router as vessels_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="SeaDays API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(profiles_router, prefix="/v1")
    app.include_router(progress_router, prefix="/v1")
    app.include_router(trips_router, prefix="/v1")
    app.include_router(vessels_router, prefix="/v1")
    return app


app = create_app()
