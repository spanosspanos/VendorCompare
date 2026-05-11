import os
import sys
import uvicorn

if __name__ == '__main__':
    if not getattr(sys, 'frozen', False):
        # Dev mode: make sure backend/ is on sys.path so 'app' resolves
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    # Direct import — PyInstaller follows this statically and bundles app.*
    from app.main import app as fastapi_app
    uvicorn.run(fastapi_app, host='127.0.0.1', port=8000, log_level='info')
