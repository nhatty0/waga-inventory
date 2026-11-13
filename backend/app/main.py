from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import auth
from app.routers.clients import router as clients_router
from app.routers.inventory import router as inventory_router
from app.routers.orders import ledger_router, orders_router
from app.routers.products import router as products_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables on startup (with multi-tenant schema check)
    init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Fast, lightweight inventory tracking and peer-lending management backend "
        "tailored for electronics shops in Gondar, Ethiopia. Supports Merkato freight "
        "inbound tracking, rural wholesale dispatches, and neighbor 'amarech' peer-lending ledger."
    ),
    lifespan=lifespan,
)

# CORS middleware configured for mobile devices and deployed frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers under /api
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(products_router, prefix=settings.API_PREFIX)
app.include_router(inventory_router, prefix=settings.API_PREFIX)
app.include_router(clients_router, prefix=settings.API_PREFIX)
app.include_router(orders_router, prefix=settings.API_PREFIX)
app.include_router(ledger_router, prefix=settings.API_PREFIX)


@app.get("/", tags=["Health"])
def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "location": "Gondar, Ethiopia",
        "status": "online",
        "docs_url": "/docs",
    }


@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "system": "Waga Inventory",
    }
