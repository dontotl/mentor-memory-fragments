"""Loopback-only speech service. Downloads are explicit; inference is local only."""
from __future__ import annotations

import io
import logging
import os
from pathlib import Path
import shutil
import threading
import time
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from typing import Literal

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'models'
os.environ['HF_HOME'] = str(MODELS / 'cache' / 'huggingface')
os.environ['NUMBA_CACHE_DIR'] = str(MODELS / 'cache' / 'numba')
os.environ['TORCH_HOME'] = str(MODELS / 'cache' / 'torch')
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['GRADIO_ANALYTICS_ENABLED'] = 'False'
os.environ['DO_NOT_TRACK'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['OMP_NUM_THREADS'] = '4'
os.environ['MKL_NUM_THREADS'] = '4'

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

SPECS = {
    'stt': {'repo': 'Systran/faster-whisper-small', 'revision': '536b0662742c02347bc0e980a01041f333bce120', 'reserve': 1_200_000_000},
    'tts': {'repo': 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice', 'revision': '85e237c12c027371202489a0ec509ded67b5e4b5', 'reserve': 3_500_000_000},
}
MAX_AUDIO_BYTES = 12 * 1024 * 1024


class DownloadInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: Literal['stt', 'tts']


class TTSInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    text: str = Field(min_length=1, max_length=500)

    @field_validator('text')
    @classmethod
    def nonblank(cls, text):
        if not text.strip():
            raise ValueError('읽을 내용을 입력해 주세요.')
        return text.strip()


class ModelManager:
    def __init__(self, directory=MODELS):
        self.directory = Path(directory)
        self.states = {kind: {'status': 'missing', 'detail': '로컬 모델을 내려받아 주세요.'} for kind in SPECS}
        self.models = {}
        self.guard = threading.Lock()
        self.inference = threading.Lock()
        self.worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix='model-setup')

    def health(self):
        with self.guard:
            return {kind: {**state, 'model': SPECS[kind]['repo'], 'path': str(self.directory / kind),
                           'filesReceived': sum(1 for p in (self.directory / kind).rglob('*') if p.is_file() and '.cache' not in p.parts)}
                    for kind, state in self.states.items()}

    def set_state(self, kind, status, detail):
        with self.guard:
            self.states[kind] = {'status': status, 'detail': detail}

    def load(self, kind):
        # All paths are fixed local directories. Never use model identifiers for inference.
        directory = str(self.directory / kind)
        if kind == 'stt':
            import onnxruntime
            onnxruntime.disable_telemetry_events()
            from faster_whisper import WhisperModel
            model = WhisperModel(directory, device='cpu', compute_type='int8', cpu_threads=4,
                                 num_workers=1, local_files_only=True)
        else:
            import torch
            from qwen_tts import Qwen3TTSModel
            torch.set_num_threads(4)
            model = Qwen3TTSModel.from_pretrained(directory, device_map='cpu', dtype=torch.float32,
                                                attn_implementation='sdpa', local_files_only=True)
            if 'sohee' not in [s.lower() for s in model.model.get_supported_speakers()]:
                raise RuntimeError('Sohee 음성이 없는 모델입니다.')
        self.models[kind] = model
        self.set_state(kind, 'ready', 'CPU 로컬 모델 로드 완료 · 전체 구간 처리')

    def initialize(self):
        for kind in SPECS:
            if (self.directory / kind / 'config.json').exists():
                self.set_state(kind, 'downloading', '저장된 모델을 로드하고 검증하는 중입니다.')
                self.worker.submit(self.prepare, kind, False)

    def prepare(self, kind, download=True):
        try:
            if download:
                self.directory.mkdir(parents=True, exist_ok=True)
                required = SPECS[kind]['reserve']
                if shutil.disk_usage(self.directory).free < required:
                    raise RuntimeError(f'디스크 공간이 부족합니다. {required / 1e9:.1f} GB 이상 확보한 후 다시 시도해 주세요.')
                from huggingface_hub import snapshot_download
                self.set_state(kind, 'downloading', '공식 모델 파일을 내려받고 있습니다. 완료 파일 수를 확인해 주세요.')
                snapshot_download(SPECS[kind]['repo'], local_dir=str(self.directory / kind),
                                  revision=SPECS[kind]['revision'],
                                  allow_patterns=['*.json', '*.bin', '*.safetensors', '*.txt', '*.model', 'speech_tokenizer/*'],
                                  max_workers=2)
            self.set_state(kind, 'downloading', '모델 다운로드 확인 완료 · CPU 로딩 및 검증 중')
            with self.inference:
                self.load(kind)
        except Exception as exc:
            logging.exception('Local %s model preparation failed', kind)
            self.models.pop(kind, None)
            self.set_state(kind, 'error', f'{type(exc).__name__}: {str(exc)[:350]}')

    def download(self, kind):
        with self.guard:
            if self.states[kind]['status'] in ('downloading', 'ready'):
                return self.states[kind]['status']
            self.states[kind] = {'status': 'downloading', 'detail': '다운로드 대기 중 · 준비 완료까지 시간이 걸립니다.'}
        self.worker.submit(self.prepare, kind)
        return 'downloading'

    def require(self, kind):
        if self.health()[kind]['status'] != 'ready' or kind not in self.models:
            raise HTTPException(503, '로컬 음성 모델이 준비되지 않았습니다. 설정에서 상태를 확인해 주세요.')
        if not self.inference.acquire(blocking=False):
            raise HTTPException(429, '다른 음성을 처리하고 있습니다. 잠시 후 다시 시도해 주세요.')
        return self.models[kind]


def create_app(manager=None):
    manager = manager or ModelManager()

    @asynccontextmanager
    async def lifespan(app):
        manager.initialize()
        yield
        manager.worker.shutdown(wait=False, cancel_futures=True)

    app = FastAPI(title='기억의 조각 로컬 음성', lifespan=lifespan, docs_url=None, redoc_url=None)

    @app.middleware('http')
    async def limit_request(request: Request, call_next):
        # Only same-host server proxy calls are expected. Block browser-originated mutations.
        if request.method != 'GET' and request.headers.get('origin'):
            return JSONResponse({'error': '브라우저 직접 요청은 허용하지 않습니다.'}, status_code=403)
        try:
            size = int(request.headers.get('content-length', '0'))
        except ValueError:
            return JSONResponse({'error': '잘못된 요청 길이입니다.'}, status_code=400)
        limit = MAX_AUDIO_BYTES + 65536 if request.url.path == '/stt' else 8192
        if size > limit:
            return JSONResponse({'error': '요청이 너무 큽니다.'}, status_code=413)
        # Bound chunked bodies too, before multipart/JSON parsing can allocate arbitrary data.
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > limit:
                return JSONResponse({'error': '요청이 너무 큽니다.'}, status_code=413)
        request._body = bytes(body)
        return await call_next(request)

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return JSONResponse({'error': str(exc.detail)}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return JSONResponse({'error': '입력을 확인해 주세요. 음성 종류는 stt/tts, 낭독은 1~500자입니다.'}, status_code=422)

    @app.get('/health')
    def health():
        return manager.health()

    @app.post('/models/download', status_code=202)
    def download(data: DownloadInput):
        return {'status': manager.download(data.kind)}

    @app.post('/stt')
    def stt(audio: UploadFile = File(...)):
        payload = audio.file.read(MAX_AUDIO_BYTES + 1)
        if not payload or len(payload) > MAX_AUDIO_BYTES:
            raise HTTPException(413 if payload else 422, '음성은 비어 있지 않은 12 MB 이하 파일이어야 합니다.')
        model = manager.require('stt')
        started = time.perf_counter()
        try:
            # PyAV decodes locally. Check duration before inference, including containers with no duration metadata.
            import av
            import numpy as np
            with av.open(io.BytesIO(payload)) as container:
                stream = container.streams.audio[0]
                resampler = av.AudioResampler(format='flt', layout='mono', rate=16000)
                samples, count = [], 0
                for frame in container.decode(stream):
                    for converted in resampler.resample(frame):
                        value = converted.to_ndarray().reshape(-1)
                        count += value.size
                        if count > 120 * 16000:
                            raise HTTPException(413, '녹음은 120초 이하로 제한됩니다.')
                        samples.append(value)
                for converted in resampler.resample(None):
                    samples.append(converted.to_ndarray().reshape(-1))
            if not samples:
                raise HTTPException(422, '인식할 음성이 없습니다.')
            waveform = np.concatenate(samples)
            if len(waveform) > 120 * 16000:
                raise HTTPException(413, '녹음은 120초 이하로 제한됩니다.')
            segments, _ = model.transcribe(waveform, language='ko', beam_size=3, vad_filter=True,
                                          condition_on_previous_text=False)
            return {'text': ' '.join(segment.text.strip() for segment in segments).strip(),
                    'provider': 'local:faster-whisper-small-cpu-int8',
                    'elapsedMs': round((time.perf_counter() - started) * 1000)}
        except HTTPException:
            raise
        except Exception:
            logging.exception('Local STT failed')
            raise HTTPException(422, '음성을 처리하지 못했습니다. 파일 형식을 확인하거나 텍스트로 입력해 주세요.')
        finally:
            manager.inference.release()
            audio.file.close()

    @app.post('/tts')
    def tts(data: TTSInput):
        model = manager.require('tts')
        started = time.perf_counter()
        try:
            import soundfile as sf
            wavs, rate = model.generate_custom_voice(text=data.text, language='Korean', speaker='Sohee',
                                                      max_new_tokens=1536)
            buffer = io.BytesIO()
            sf.write(buffer, wavs[0], rate, format='WAV', subtype='PCM_16')
            return Response(buffer.getvalue(), media_type='audio/wav', headers={
                'X-Elapsed-Ms': str(round((time.perf_counter() - started) * 1000)),
                'X-Speech-Provider': 'local:qwen3-tts-0.6b-sohee-cpu', 'Cache-Control': 'no-store'})
        except Exception:
            logging.exception('Local TTS failed')
            raise HTTPException(500, '로컬 낭독 생성에 실패했습니다. 글은 그대로 보관됩니다.')
        finally:
            manager.inference.release()

    return app


app = create_app()
