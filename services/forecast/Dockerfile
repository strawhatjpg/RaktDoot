# Forecast service image (Render / Railway free tier). Build from the REPO ROOT:
#   docker build -f services/forecast/Dockerfile -t raktdoot-forecast .
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app/services/forecast

COPY services/forecast/requirements.txt .
RUN pip install -r requirements.txt

COPY services/forecast/ .
COPY data/seed/historical_demand_synthetic.csv /app/data/seed/historical_demand_synthetic.csv

# Free hosts inject $PORT; default 8000 locally. Training runs once at startup (~20 s).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
