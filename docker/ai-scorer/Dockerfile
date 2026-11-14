# AI writing scorer (https://github.com/linhma139/ai-language-evaluator): a Python worker that
# consumes exam.writing.submitted, asks the LLM server (ai-llm) to grade the essay and publishes
# exam.writing.scored. Built from a pinned commit so the image is reproducible; bump
# EVALUATOR_REF to update it.
FROM python:3.12.12-slim AS source
ARG EVALUATOR_REF=cfa908c79df0317a99e84b656ff9ad8d9abef851
RUN python - <<PY
import io, tarfile, urllib.request
url = "https://github.com/linhma139/ai-language-evaluator/archive/${EVALUATOR_REF}.tar.gz"
with urllib.request.urlopen(url) as r:
    tarfile.open(fileobj=io.BytesIO(r.read())).extractall("/tmp/src", filter="data")
PY
RUN mv /tmp/src/ai-language-evaluator-* /src

FROM python:3.12.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY --from=source /src/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=source /src/app ./app
USER nobody
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=4 \
	CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8081/health', timeout=2)"
CMD ["python", "app/main.py"]
