#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export UV_CACHE_DIR="$PWD/models/cache/uv"
mkdir -p models/cache
SPEECH_PYTHON="${SPEECH_PYTHON:-python3.11}"
"$SPEECH_PYTHON" -c 'import shutil,sys; free=shutil.disk_usage(".").free; sys.exit("Please free at least 8 GB for local speech runtime and models before setup.") if free < 8_000_000_000 else None'
if command -v uv >/dev/null 2>&1; then
  uv venv --allow-existing --python "$SPEECH_PYTHON" .venv
  uv pip install --python .venv/bin/python --no-cache -r speech/requirements.txt
else
  "$SPEECH_PYTHON" -m venv .venv
  .venv/bin/python -m pip install --no-cache-dir -r speech/requirements.txt
fi
printf '%s\n' 'Run: .venv/bin/python -m uvicorn speech.service:app --host 127.0.0.1 --port 8765'
printf '%s\n' 'Download approved models from the app Settings, or python -m speech.download.'
