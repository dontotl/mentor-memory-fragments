"""Synthetic text-only browser flow; does not test microphone or real TTS."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('MEMORY_TEST_URL', 'http://127.0.0.1:3000')
OUTPUT = Path(__file__).resolve().parents[1] / 'test-results'
OUTPUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    page = context.new_page()
    page.set_default_timeout(20000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    record_id = None
    try:
        page.goto(BASE)
        expect(page.get_by_role('heading', name='사진 한 장에 담긴 이야기')).to_be_visible(timeout=30000)
        page.screenshot(path=str(OUTPUT / 'home-mobile.png'), full_page=True)
        # Deterministic guided fallback, scoped to this brand-new test cookie.
        settings = context.request.get(BASE + '/api/settings').json()
        settings['inputMode'] = 'text'
        settings['llm']['baseUrl'] = 'http://127.0.0.1:11435'
        response = context.request.put(BASE + '/api/settings', data=settings)
        assert response.ok, response.text()
        page.goto(BASE + '/start')
        page.get_by_role('button', name='가상 소풍 사진으로 체험하기', exact=False).click()
        page.get_by_role('checkbox').check()
        page.get_by_role('button', name='이 사진으로 이야기 시작').click()
        page.wait_for_url('**/interview/*')
        record_id = page.url.rsplit('/', 1)[-1]
        page.get_by_label('내 이야기', exact=True).fill('봄에 가족과 소풍을 갔어요. 정확한 연도는 기억나지 않아요.')
        page.get_by_role('button', name='확인하고 엽서 만들기').click()
        page.wait_for_url('**/postcard/*', timeout=60000)
        page.get_by_role('button', name='확인하고 엽서 저장').click()
        expect(page.get_by_text('보관함에 엽서를 저장했어요.')).to_be_visible()
        with page.expect_download() as download_info:
            page.get_by_role('button', name='엽서 PNG 내려받기').click()
        download = download_info.value
        download.save_as(str(OUTPUT / 'sample-postcard.png'))
        page.screenshot(path=str(OUTPUT / 'postcard-mobile.png'), full_page=True)
        page.get_by_role('link', name='이야기 더 들려주기').click()
        page.get_by_label('내 이야기', exact=True).fill('어머니가 싸 주신 김밥이 참 맛있었어요.')
        page.get_by_role('button', name='확인한 이야기 보내기').click()
        expect(page.get_by_role('heading', name='지금까지 남긴 이야기 2개')).to_be_visible()
        page.get_by_role('button', name='여기까지 회고록으로 남기기').click()
        page.wait_for_url('**/memoir/*', timeout=60000)
        expect(page.get_by_label('회고록 본문')).to_be_visible()
        assert '정확한 연도는 기억나지 않아요.' in page.get_by_label('회고록 본문').input_value()
        draft = page.get_by_label('회고록 본문').input_value() + '\n직접 편집한 가상 문장입니다.'
        page.get_by_label('회고록 본문').fill(draft)
        page.locator('summary').filter(has_text='이야기 1 · 수정 0회').click()
        source_editor = page.get_by_label('현재 이야기 수정').first
        source_editor.fill(source_editor.input_value() + ' 그날 기분이 좋았어요.')
        page.get_by_role('button', name='수정 이력 남기기').first.click()
        expect(page.get_by_role('button', name='내용을 확인했고, 승인하여 저장')).to_be_disabled()
        expect(page.get_by_label('회고록 본문')).to_have_value(draft)
        page.get_by_role('button', name='원문으로 초안 다시 만들기').click()
        expect(page.get_by_label('회고록 본문')).not_to_have_value(draft)
        page.get_by_role('button', name='내용을 확인했고, 승인하여 저장').click()
        expect(page.get_by_text('승인한 회고록을 보관함에 저장했어요.')).to_be_visible()
        page.reload()
        expect(page.get_by_text('내가 승인한 회고록', exact=False)).to_be_visible()
        page.screenshot(path=str(OUTPUT / 'memoir-mobile.png'), full_page=True)
        page.goto(BASE + '/settings')
        page.get_by_label('화면 테마', exact=False).select_option('dark')
        page.get_by_role('button', name='설정 저장', exact=True).click()
        expect(page.get_by_text('설정을 저장했어요.', exact=False)).to_be_visible()
        page.evaluate('scrollTo(0, 0)')
        page.screenshot(path=str(OUTPUT / 'settings-dark-mobile.png'), full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'mobile horizontal overflow'
        page.get_by_label('화면 선택', exact=True).select_option('/preview')
        expect(page.get_by_role('heading', name='한 장의 엽서가 되기까지')).to_be_visible()
        page.get_by_role('link', name='홈', exact=True).click()
        expect(page.get_by_role('heading', name='사진 한 장에 담긴 이야기')).to_be_visible()
        page.set_viewport_size({'width': 320, 'height': 812})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'small mobile horizontal overflow'
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.goto(BASE + '/preview')
        page.screenshot(path=str(OUTPUT / 'preview-desktop.png'), full_page=True)
        page.goto(BASE + '/library')
        page.once('dialog', lambda dialog: dialog.accept())
        page.get_by_role('button', name='삭제', exact=False).click()
        expect(page.get_by_text('아직 첫 장을 기다리고 있어요')).to_be_visible()
        record_id = None
        # Exercise actual multipart file upload, distinct from selecting bundled sample.
        page.goto(BASE + '/start')
        page.get_by_label('사진 파일 선택').set_input_files(str(Path(__file__).resolve().parents[1] / 'public/samples/spring-picnic.png'))
        page.get_by_role('checkbox').check()
        page.get_by_role('button', name='이 사진으로 이야기 시작').click()
        page.wait_for_url('**/interview/*')
        record_id = page.url.rsplit('/', 1)[-1]
        expect(page.get_by_role('heading', name='사진 속으로, 천천히')).to_be_visible()
        assert not errors, errors
        print(json.dumps({'status': 'passed', 'mode': 'synthetic-text-guided', 'pageErrors': errors, 'screenshots': str(OUTPUT)}, ensure_ascii=False))
    except Exception:
        page.screenshot(path=str(OUTPUT / 'failure.png'), full_page=True)
        print(json.dumps({'pageErrors': errors, 'body': page.locator('body').inner_text()[:4000]}, ensure_ascii=False))
        raise
    finally:
        if record_id:
            context.request.delete(BASE + '/api/interviews/' + record_id)
        browser.close()
