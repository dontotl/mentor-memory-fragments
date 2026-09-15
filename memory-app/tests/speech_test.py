"""Boundary regressions: no false readiness, arbitrary downloads, or empty speech."""
from fastapi.testclient import TestClient
from speech.service import create_app, ModelManager
import shutil
import threading


def test_missing_models_are_not_ready(tmp_path):
    client = TestClient(create_app(ModelManager(tmp_path)))
    assert client.get('/health').json()['stt']['status'] == 'missing'
    assert client.post('/tts', json={'text': '안녕하세요'}).status_code == 503


def test_download_rejects_unknown_models_and_extra_paths(tmp_path):
    client = TestClient(create_app(ModelManager(tmp_path)))
    for payload in ({'kind': '../evil'}, {'kind': 'tts', 'path': '/tmp/custom'}):
        assert client.post('/models/download', json=payload).status_code == 422


def test_empty_and_oversized_text_rejected(tmp_path):
    client = TestClient(create_app(ModelManager(tmp_path)))
    for text in (' ', '', '가' * 501):
        assert client.post('/tts', json={'text': text}).status_code == 422


def test_cross_origin_mutation_rejected(tmp_path):
    client = TestClient(create_app(ModelManager(tmp_path)))
    response = client.post('/models/download', json={'kind': 'tts'}, headers={'origin': 'https://evil.example'})
    assert response.status_code == 403


def test_insufficient_disk_becomes_error_without_false_readiness(tmp_path, monkeypatch):
    manager = ModelManager(tmp_path)
    monkeypatch.setattr(shutil, 'disk_usage', lambda _: shutil._ntuple_diskusage(100, 99, 1))
    manager.prepare('tts')
    assert manager.health()['tts']['status'] == 'error'
    assert '공간' in manager.health()['tts']['detail']
    assert TestClient(create_app(manager)).post('/tts', json={'text': '안녕하세요'}).status_code == 503


def test_partial_model_files_never_report_ready(tmp_path):
    (tmp_path / 'stt').mkdir()
    (tmp_path / 'stt' / 'config.json').write_text('{}')
    manager = ModelManager(tmp_path)
    manager.prepare('stt', download=False)
    assert manager.health()['stt']['status'] == 'error'


def test_busy_inference_rejects_without_queueing(tmp_path):
    manager = ModelManager(tmp_path)
    # Model loading is an unavailable heavyweight boundary. Test the actual admission gate.
    manager.models['tts'] = object()
    manager.set_state('tts', 'ready', 'test-loaded')
    with manager.inference:
        response = TestClient(create_app(manager)).post('/tts', json={'text': '안녕하세요'})
    assert response.status_code == 429


def test_duplicate_downloads_share_one_background_job(tmp_path):
    manager = ModelManager(tmp_path)
    started, release = threading.Event(), threading.Event()
    manager.worker.submit(lambda: (started.set(), release.wait(2)))
    started.wait(2)
    try:
        assert manager.download('stt') == 'downloading'
        assert manager.download('stt') == 'downloading'
        assert manager.health()['stt']['status'] == 'downloading'
    finally:
        manager.worker.shutdown(wait=False, cancel_futures=True)
        release.set()


def test_oversized_request_and_empty_audio_rejected(tmp_path):
    client = TestClient(create_app(ModelManager(tmp_path)))
    assert client.post('/tts', content=b'x' * 8193).status_code == 413
    assert client.post('/stt', files={'audio': ('empty.wav', b'', 'audio/wav')}).status_code == 422
