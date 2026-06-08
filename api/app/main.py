from fastapi import FastAPI

from app.routes.health import router as health_router
from app.routes.progress import router as progress_router
from app.routes.trips import router as trips_router
from app.routes.vessels import router as vessels_router


def create_app() -> FastAPI:
    app = FastAPI(title="SeaDays API", version="0.1.0")
    app.include_router(health_router)
    app.include_router(progress_router, prefix="/v1")
    app.include_router(trips_router, prefix="/v1")
    app.include_router(vessels_router, prefix="/v1")
    return app


app = create_app()
