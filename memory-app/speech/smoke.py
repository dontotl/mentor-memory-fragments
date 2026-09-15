"""Synthetic roundtrip only. Run after both /health statuses are ready."""
import io
import json
from pathlib import Path
import platform
import time

import httpx

TEXT = '봄에 가족과 소풍을 갔어요. 어머니가 싸 주신 김밥을 먹었어요.'

if __name__ == '__main__':
    output = Path(__file__).resolve().parents[1] / 'models' / 'smoke'
    output.mkdir(parents=True, exist_ok=True)
    with httpx.Client(base_url='http://127.0.0.1:8765', timeout=900) as client:
        health = client.get('/health').json()
        if any(health[k]['status'] != 'ready' for k in ('tts', 'stt')):
            raise SystemExit('Models are not ready; no synthetic result was created.')
        started = time.perf_counter()
        tts = client.post('/tts', json={'text': TEXT})
        tts.raise_for_status()
        elapsed = time.perf_counter() - started
        import soundfile as sf
        waveform, rate = sf.read(io.BytesIO(tts.content))
        (output / 'synthetic-sohee.wav').write_bytes(tts.content)
        stt = client.post('/stt', files={'audio': ('synthetic.wav', tts.content, 'audio/wav')})
        stt.raise_for_status()
        report = {'hardware': platform.platform(), 'inputText': TEXT, 'ttsWallSeconds': elapsed,
                  'ttsServerMs': tts.headers.get('x-elapsed-ms'), 'sampleRate': rate,
                  'audioSeconds': len(waveform) / rate, 'stt': stt.json(), 'health': health,
                  'scope': 'Synthetic TTS→STT smoke only; not elderly speech or microphone quality validation.'}
        (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(json.dumps(report, ensure_ascii=False, indent=2))
