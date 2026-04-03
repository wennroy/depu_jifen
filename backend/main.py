from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import DB_PATH
from backend.database import init_db
from backend.routers import rooms, players, admin, game
from backend.ws import handler as ws_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure data directory exists
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    init_db()
    yield


app = FastAPI(title="德扑筹码计分", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router)
app.include_router(players.router)
app.include_router(admin.router)
app.include_router(game.router)
app.include_router(ws_handler.router)

# Serve frontend static files in production
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
