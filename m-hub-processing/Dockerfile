# Plausibilitaets-Service (Processing-Core). material_markov laedt Wolfgangs
# Katalog beim Import; plausibility_api beantwortet POST /check fuer node-red.
FROM python:3.12-slim

WORKDIR /app
RUN pip install --no-cache-dir pandas openpyxl

COPY material_markov.py plausibility_api.py ./
COPY data/aufbauten_katalog.xlsx ./data/aufbauten_katalog.xlsx

ENV PLAUSIBILITY_HOST=0.0.0.0
EXPOSE 8971
CMD ["python", "plausibility_api.py"]
