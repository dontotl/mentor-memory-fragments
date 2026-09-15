"""Explicit CLI installation of the two allowlisted local models."""
from speech.service import ModelManager

if __name__ == '__main__':
    manager = ModelManager()
    for kind in ('stt', 'tts'):
        manager.prepare(kind)
        print(kind, manager.health()[kind], flush=True)
    raise SystemExit(0 if all(s['status'] == 'ready' for s in manager.health().values()) else 1)
