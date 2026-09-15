"""Browser recorder lifecycle using synthetic microphone + mocked speech APIs."""
import io
import json
import wave
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:3000'
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'])
    context = browser.new_context(permissions=['microphone'], viewport={'width': 390, 'height': 844})
    page = context.new_page()
    page.set_default_timeout(20000)
    page.add_init_script('''
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async function(options) {
        const stream = await original(options);
        window.testStream = stream;
        return stream;
      };
    ''')
    captured = []
    page.route('**/api/stt', lambda route: (captured.append(route.request.post_data_buffer), route.fulfill(json={'text': '가상 마이크 상태 테스트입니다.', 'provider': 'mock', 'elapsedMs': 1})))
    wav = io.BytesIO()
    with wave.open(wav, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b'\x00\x00' * 16000 * 3)
    page.route('**/api/tts', lambda route: route.fulfill(content_type='audio/wav', body=wav.getvalue()))
    record_id = None
    try:
        page.goto(BASE + '/start')
        page.get_by_role('button', name='가상 소풍 사진으로 체험하기', exact=False).click()
        page.get_by_role('checkbox').check()
        page.get_by_role('button', name='이 사진으로 이야기 시작').click()
        page.wait_for_url('**/interview/*')
        record_id = page.url.rsplit('/', 1)[-1]
        page.get_by_role('button', name='녹음 시작').click()
        expect(page.get_by_role('button', name='잠깐 생각할게요')).to_be_visible(timeout=20000)
        page.get_by_role('button', name='잠깐 생각할게요').click()
        expect(page.get_by_text('생각하는 시간이에요. 마이크가 꺼져 있어요.')).to_be_visible()
        assert page.evaluate('testStream.getAudioTracks().every(t => !t.enabled)')
        page.get_by_role('button', name='다시 시작', exact=True).click()
        assert page.evaluate('testStream.getAudioTracks().every(t => t.enabled)')
        page.get_by_role('button', name='다 말했어요').click()
        expect(page.get_by_label('내 말 확인하고 고치기')).to_have_value('가상 마이크 상태 테스트입니다.')
        assert page.evaluate('testStream.getAudioTracks().every(t => t.readyState === "ended")')
        assert captured and record_id.encode() in captured[0], 'STT omitted interview snapshot ID'
        # STT completion must not automatically submit an interview turn.
        record = context.request.get(BASE + '/api/interviews/' + record_id).json()['interview']
        assert not record['fragments']
        page.get_by_role('button', name='질문 듣기').click()
        expect(page.get_by_role('button', name='재생 중단')).to_be_visible()
        page.get_by_role('button', name='재생 중단').click()
        expect(page.get_by_role('button', name='질문 듣기')).to_be_visible()
        print(json.dumps({'status': 'passed', 'mode': 'synthetic-microphone-mocked-speech', 'checks': ['pause-disables-mic', 'resume', 'manual-finish', 'stt-review-before-send', 'snapshot-id', 'playback-stop']}, ensure_ascii=False))
    except Exception:
        print(page.locator('body').inner_text())
        print(page.evaluate('({stream: !!window.testStream, tracks:window.testStream?.getAudioTracks().map(t=>({enabled:t.enabled,state:t.readyState}))})'))
        raise
    finally:
        if record_id:
            context.request.delete(BASE + '/api/interviews/' + record_id)
        browser.close()
