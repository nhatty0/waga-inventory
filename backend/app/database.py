from typing import Generator
from sqlalchemy import event, inspect
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings
import app.models  # Ensure models are imported for SQLModel metadata

# Render/Neon sometimes provide postgres:// instead of postgresql://
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

is_sqlite = db_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

# pool_pre_ping=True prevents dropped cloud Postgres connections
engine = create_engine(
    db_url,
    echo=False,
    connect_args=connect_args,
    pool_pre_ping=True,
)


# Enforce foreign key constraints ONLY when running on SQLite
if is_sqlite:
    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def init_db() -> None:
    """
    Create all tables in the database.
    If an existing database is detected without the multi-tenant shop table / shop_id columns,
    safely drop old tables once and recreate them with the fresh multi-tenant schema.
    """
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    needs_reset = False
    if "product" in table_names:
        if "shop" not in table_names:
            needs_reset = True
        else:
            columns = [c["name"] for c in inspector.get_columns("product")]
            if "shop_id" not in columns:
                needs_reset = True

    if needs_reset:
        SQLModel.metadata.drop_all(engine)

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Dependency yielding a database session per request."""
    with Session(engine) as session:
        yield session