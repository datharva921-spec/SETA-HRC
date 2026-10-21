import uvicorn
import os

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    reload = os.getenv("RELOAD", "True").lower() == "true"
    print(f"Starting SETA-HRC Backend on http://{host}:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)
