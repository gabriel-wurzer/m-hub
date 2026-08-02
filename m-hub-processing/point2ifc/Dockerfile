# Point2IFC job-service: Punktwolke -> reduziertes IFC (async, ein Worker).
# Schwer (open3d/ifcopenshell), daher eigener Container getrennt vom Plausi-Service.
FROM python:3.12-slim

# open3d braucht libGL + OpenMP zur Laufzeit
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./

ENV PYTHONUTF8=1 \
    PYTHONUNBUFFERED=1 \
    POINT2IFC_HOST=0.0.0.0 \
    POINT2IFC_PORT=8972 \
    POINT2IFC_WORK=/data/point2ifc

EXPOSE 8972
CMD ["python", "job_api.py"]
