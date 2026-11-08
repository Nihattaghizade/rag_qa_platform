$ErrorActionPreference = "Stop"
$RootDir = "C:\Users\NihatTaghizadeNovumL\Desktop\rag_qa_platform"
$BackendDir = "$RootDir\backend"
$FrontendDir = "$RootDir\frontend"

Set-Location $RootDir
docker compose up -d

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; .\.venv\Scripts\Activate.ps1; celery -A app.workers.celery_app worker -Q q_parser -n parser@%h --pool=solo -c 1 -l info"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; .\.venv\Scripts\Activate.ps1; celery -A app.workers.celery_app worker -Q q_embedding -n embedding@%h --pool=solo -c 1 -l info"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; .\.venv\Scripts\Activate.ps1; celery -A app.workers.celery_app worker -Q q_chat -n chat@%h --pool=solo -c 1 -l info"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; .\.venv\Scripts\Activate.ps1; celery -A app.workers.celery_app worker -Q q_maintenance -n maintenance@%h --pool=solo -c 1 -l info"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendDir'; npm run dev"