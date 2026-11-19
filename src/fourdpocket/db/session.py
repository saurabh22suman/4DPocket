"""Database session management."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import event
from sqlmodel import Session, create_engine

from fourdpocket.config import get_settings

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        db_url = settings.database.url

        if db_url.startswith("sqlite"):
            db_path = db_url.replace("sqlite:///", "")
            if db_path.startswith("./"):
                Path(db_path).parent.mkdir(parents=True, exist_ok=True)
            connect_args = {"check_same_thread": False}
        else:
            connect_args = {}

        _engine = create_engine(
            db_url,
            echo=settings.database.echo,
            connect_args=connect_args,
        )

        # Enable SQLite foreign key enforcement
        if db_url.startswith("sqlite"):
            @event.listens_for(_engine, "connect")
            def _set_sqlite_pragma(dbapi_conn, connection_record):
                cursor = dbapi_conn.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

    return _engine


def get_session():
    engine = get_engine()
    with Session(engine) as session:
        yield session


def init_db():
    """Bring the configured database to the Alembic head revision."""
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).parent / "migrations"))

    with get_engine().connect() as connection:
        sqlite = connection.dialect.name == "sqlite"
        if sqlite:
            # Alembic batch migrations may rebuild referenced SQLite tables.
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            connection.commit()
        config.attributes["connection"] = connection
        try:
            command.upgrade(config, "head")
        finally:
            if sqlite:
                if connection.in_transaction():
                    connection.rollback()
                connection.exec_driver_sql("PRAGMA foreign_keys=ON")
                connection.commit()


def reset_engine():
    """Reset engine for testing."""
    global _engine
    _engine = None
