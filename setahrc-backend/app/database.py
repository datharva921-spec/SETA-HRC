import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger("seta_hrc.database")

Base = declarative_base()

def get_engine():
    db_url = settings.DATABASE_URL
    try:
        if db_url.startswith("sqlite"):
            engine = create_engine(
                db_url,
                connect_args={"check_same_thread": False}
            )
            logger.info("Connected to SQLite database: %s", db_url)
            return engine
        
        # Try connecting to MySQL
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_recycle=3600,
            pool_size=10,
            max_overflow=20
        )
        # Test connection
        with engine.connect() as conn:
            logger.info("Successfully connected to MySQL database: %s", db_url)
        return engine
    except Exception as exc:
        if settings.SQLITE_FALLBACK:
            sqlite_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "seta_hrc.db"))
            sqlite_url = f"sqlite:///{sqlite_path}"
            logger.warning("Could not connect to MySQL (%s). Falling back to SQLite at: %s", exc, sqlite_url)
            engine = create_engine(
                sqlite_url,
                connect_args={"check_same_thread": False}
            )
            return engine
        raise exc


engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
