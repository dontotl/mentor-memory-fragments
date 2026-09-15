"""Public static guide: links, full plan, status and mobile layout."""
from pathlib import Path
import os
import hashlib
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('MEMORY_TEST_URL', 'http://127.0.0.1:3000')
APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent
DOC_SOURCES = {
    'project-prd.md': ROOT / 'docs/PRD.md',
}
with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={'width':1440,'height':1000})
    page = context.new_page()
    errors = []
    console_errors = []
    requests = []
    outbound = []
    def local_only(route):
        url = route.request.url
        if urlparse(url).scheme in ('http', 'https') and urlparse(url).netloc != urlparse(BASE).netloc:
            outbound.append(url)
            route.abort()
        else:
            route.continue_()
    page.context.route('**/*', local_only)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
    page.on('request', lambda r: requests.append((r.method, r.url)))
    page.goto(BASE + '/project.html')
    for anchor in ['journey', 'architecture', 'processing', 'decisions', 'privacy', 'evidence', 'plan', 'demo']:
        expect(page.locator('#' + anchor)).to_have_count(1)
    expect(page.locator('iframe')).to_have_count(0)
    expect(page.locator('.photo img')).to_have_attribute('loading', 'eager')
    for img in page.locator('.sample-output img, [data-preview]').all():
        expect(img).to_have_attribute('loading', 'lazy')
    assert not any(url.endswith(('architecture.html', 'interview-sequence.html', '/api/health')) for _, url in requests)
    for img in page.locator('img').all():
        img.scroll_into_view_if_needed()
        page.wait_for_function('(i) => i.complete', arg=img.element_handle())
        assert img.evaluate('(i) => i.complete && i.naturalWidth > 0')
    assert all(method == 'GET' and urlparse(url).netloc == urlparse(BASE).netloc for method, url in requests)
    page.set_viewport_size({'width':390,'height':844})
    menu = page.locator('#menu-toggle')
    expect(menu).to_have_attribute('aria-controls', 'nav-links')
    menu.focus()
    page.keyboard.press('Enter')
    expect(menu).to_have_attribute('aria-expanded', 'true')
    page.keyboard.press('Escape')
    expect(menu).to_be_focused()
    expect(menu).to_have_attribute('aria-expanded', 'false')
    menu.click()
    page.locator('#nav-links a[href="#decisions"]').click()
    expect(menu).to_have_attribute('aria-expanded', 'false')
    expect(page.locator('#decisions')).to_be_in_viewport()
    expect(page.locator('[data-viewer]').first).not_to_be_visible()
    page.set_viewport_size({'width':1440,'height':1000})
    page.locator('#architecture [data-viewer]').click()
    expect(page.locator('#architecture iframe')).to_have_attribute('title', '전체 구성 인터랙티브 다이어그램')
    expect(page.frame_locator('#architecture iframe').get_by_role('heading', level=1)).to_contain_text('구현 아키텍처')
    assert not outbound, f'Viewer attempted external requests: {outbound}'
    frame = page.frame_locator('#architecture iframe')
    before = frame.locator('html').get_attribute('data-theme')
    frame.locator('#btn-theme').click()
    assert frame.locator('html').get_attribute('data-theme') != before
    frame.get_by_role('button', name='Zoom in', exact=True).click()
    frame.locator('[data-view="reset"]').click()
    page.locator('#architecture iframe').screenshot(path=str(APP/'test-results/project-csp-embedded.png'), animations='disabled')
    policy = page.locator('meta[http-equiv="Content-Security-Policy"]').get_attribute('content')
    for path in ['/project.html', '/architecture.html', '/interview-sequence.html']:
        response = page.request.get(BASE + path)
        assert response.headers.get('content-security-policy') == policy, path
        assert response.headers.get('x-dns-prefetch-control') == 'off', path
    assert 'unsafe-eval' not in policy
    for path in ['/api/health', '/preview', '/settings']:
        response = page.request.get(BASE + path)
        assert 'content-security-policy' not in response.headers, path
        assert 'x-dns-prefetch-control' not in response.headers, path
    viewer = page.context.new_page()
    viewer.on('pageerror', lambda e: errors.append(str(e)))
    viewer.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
    for filename, digest in {
        'architecture.html': '9e55404aa28fe4faabbd67af6e107804398dc5fef87b6947892bb310fa7e02f4',
        'interview-sequence.html': 'b479d5419457d7fcfce6d178c25007f2ae3fb13c67511fc2da58bbe523b4703c',
    }.items():
        assert hashlib.sha256((APP/'public'/filename).read_bytes()).hexdigest() == digest
        viewer.goto(BASE+'/'+filename)
        expect(viewer.get_by_role('heading', level=1)).to_be_visible()
        before = viewer.locator('html').get_attribute('data-theme')
        viewer.locator('#btn-theme').click()
        assert viewer.locator('html').get_attribute('data-theme') != before
        viewer.get_by_role('button', name='Zoom in', exact=True).click()
        viewer.locator('[data-view="reset"]').click()
        viewer.screenshot(path=str(APP/f'test-results/csp-{filename}.png'), animations='disabled')
        assert not outbound, f'Standalone viewer attempted external network: {outbound}'
    viewer.close()
    assert sum(url.endswith('/architecture.html') for _, url in requests) == 1
    page.route('**/interview-sequence.html', lambda r: r.fulfill(status=503, body='unavailable'))
    page.locator('#processing [data-viewer]').click()
    expect(page.locator('#processing .viewer-status')).to_contain_text('불러오지 못했습니다')
    expect(page.locator('#processing [data-viewer-link]')).to_be_visible()
    page.unroute('**/interview-sequence.html')
    stalled = []
    page.route('**/viewer-pending', lambda r: stalled.append(r))
    page.route('**/interview-sequence.html', lambda r: r.fulfill(content_type='text/html', body='<html><h1>지연 테스트</h1><img src="/viewer-pending"></html>'))
    page.locator('#processing [data-viewer]').click()
    expect(page.locator('#processing .viewer-status')).to_contain_text('불러오지 못했습니다', timeout=10000)
    expect(page.locator('#processing iframe')).to_have_count(0)
    for route in stalled:
        route.abort()
    page.unroute('**/viewer-pending')
    page.unroute('**/interview-sequence.html')
    page.reload()
    requests.clear()
    expect(page.get_by_role('heading', level=1)).to_contain_text('내 말로 남기는 기억')
    page.screenshot(path=str(APP/'test-results/project-desktop.png'), full_page=True)
    page.route('**/api/health', lambda r: r.fulfill(json={'speech': {'stt': {'status': 'ready'}, 'tts': {'status': 'ready'}}, 'llm': {'online': True}}))
    page.get_by_role('button', name='현재 연결 확인').click()
    expect(page.get_by_role('status')).to_contain_text('앱 연결됨', timeout=10000)
    expect(page.locator('#checked-at')).to_have_attribute('datetime', __import__('re').compile(r'^\d{4}-'))
    page.unroute('**/api/health')
    page.route('**/api/health', lambda r: r.fulfill(status=503, body='unavailable'))
    page.locator('#check').click()
    expect(page.locator('#status')).to_contain_text('연결 실패')
    expect(page.locator('#check')).to_be_enabled()
    page.unroute('**/api/health')
    pending = []
    page.route('**/api/health', lambda r: pending.append(r))
    page.locator('#check').click()
    expect(page.locator('#check')).to_be_disabled()
    expect(page.locator('#status')).to_contain_text('시간 초과', timeout=10000)
    expect(page.locator('#check')).to_be_enabled()
    for route in pending:
        route.abort()
    page.unroute('**/api/health')
    assert all(method == 'GET' and urlparse(url).netloc == urlparse(BASE).netloc for method, url in requests), requests
    assert all('/api/' not in url or url.endswith('/api/health') for _, url in requests), requests
    page.get_by_text('PRD 전체 내용 펼치기').click()
    expect(page.locator('#plan-source')).to_contain_text('공통 API 계약')
    assert page.locator('#plan-source').text_content() == DOC_SOURCES['project-prd.md'].read_text()
    with page.expect_download() as info:
        page.get_by_role('link', name='PRD MD 내려받기').click()
    assert info.value.suggested_filename == 'project-prd.md'
    assert Path(info.value.path()).read_bytes() == DOC_SOURCES['project-prd.md'].read_bytes()
    page.get_by_text('PRD 전체 내용 펼치기').click()
    for width in [1440, 768, 390, 720]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.evaluate('scrollTo(0,0)')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        page.screenshot(path=str(APP/f'test-results/project-{width}-light.png'), full_page=True)
    page.set_viewport_size({'width':1440,'height':1000})
    page.evaluate('document.documentElement.style.zoom = "2"')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), '200% CSS zoom overflow'
    page.screenshot(path=str(APP/'test-results/project-zoom-200.png'))
    page.locator('#nav-links a[href="#decisions"]').click()
    expect(page.locator('#decisions')).to_be_in_viewport()
    page.evaluate('document.documentElement.style.zoom = "1"')
    page.evaluate('scrollTo(0,0)')
    page.screenshot(path=str(APP/'test-results/project-hero-light.png'))
    page.locator('#architecture').screenshot(path=str(APP/'test-results/project-architecture-light.png'))
    page.locator('#privacy').screenshot(path=str(APP/'test-results/project-privacy-light.png'))
    page.get_by_role('button', name='어두운 테마로 전환').click()
    assert page.locator('html').get_attribute('data-theme') == 'dark'
    assert page.locator('#architecture img').get_attribute('src').endswith('-dark.png')
    page.emulate_media(reduced_motion='reduce')
    assert page.evaluate('getComputedStyle(document.documentElement).scrollBehavior') == 'auto'
    page.locator('#processing').screenshot(path=str(APP/'test-results/project-processing-dark.png'))
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('scrollTo(0,0)')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(APP/'test-results/project-mobile-dark.png'), full_page=True)
    page.screenshot(path=str(APP/'test-results/project-mobile-hero-dark.png'))
    page.goto(BASE+'/project.html#privacy')
    page.screenshot(path=str(APP/'test-results/project-mobile-privacy-dark.png'))
    for img in page.locator('[data-preview]').all():
        img.scroll_into_view_if_needed()
        page.wait_for_function('(i) => i.complete', arg=img.element_handle())
        assert img.evaluate('(i) => i.complete && i.naturalWidth > 0')
    page.get_by_role('link', name='텍스트 데모 시작하기').click()
    expect(page.get_by_role('heading', name='한 장의 엽서가 되기까지')).to_be_visible()
    for route in ['/project-prd.md','/architecture.html','/interview-sequence.html']:
        response = page.request.get(BASE + route)
        assert response.ok, route
    page.goto((APP/'public/project.html').as_uri())
    for img in page.locator('img').all():
        img.scroll_into_view_if_needed()
        page.wait_for_function('(i) => i.complete', arg=img.element_handle())
        assert img.evaluate('(i) => i.naturalWidth > 0')
    for link in page.locator('[data-viewer-link]').all():
        assert link.get_attribute('href') == 'http://127.0.0.1:3000' + link.get_attribute('data-viewer-link')
    expect(page.locator('#plan-source')).to_contain_text('공통 API 계약')
    assert page.get_by_role('link', name='텍스트 데모 시작하기').get_attribute('href') == 'http://127.0.0.1:3000/preview'
    for route in ['/preview', '/start', '/library', '/settings']:
        assert page.locator(f'[data-demo="{route}"]').first.get_attribute('href') == 'http://127.0.0.1:3000'+route
    plain = browser.new_page(java_script_enabled=False, viewport={'width':390,'height':844})
    plain.context.route('**/*', local_only)
    plain.goto(BASE+'/project.html')
    expect(plain.locator('#nav-links a[href="#decisions"]')).to_be_visible()
    for anchor in ['journey','architecture','processing','decisions','privacy','evidence','plan','demo']:
        plain.goto(BASE+'/project.html#'+anchor)
        expect(plain.locator('#'+anchor)).to_be_in_viewport()
    plain.locator('#decisions summary').first.click()
    expect(plain.locator('#decisions details').first).to_have_attribute('open','')
    assert plain.evaluate('document.documentElement.scrollWidth <= innerWidth')
    plain.goto((APP/'public/project.html').as_uri())
    for link in plain.locator('[data-viewer-link]').all():
        assert link.get_attribute('href') == 'http://127.0.0.1:3000' + link.get_attribute('data-viewer-link')
    assert not outbound, outbound
    assert not errors, errors
    def expected_console(error):
        return any(expected in error for expected in ['503', 'net::ERR_FAILED', 'net::ERR_ABORTED']) or (
            'https://fonts.googleapis.com/css2?family=JetBrains+Mono:' in error
            and 'Content Security Policy' in error and 'style-src' in error
        )
    unexpected = [error for error in console_errors if not expected_console(error)]
    assert not unexpected, unexpected
    print('PASS: anchors, PRD download, HTTP/file/no-JS, lazy/failed viewers, health ready/failure/timeout/timestamps, mobile keyboard, 390/768/1440/720 reflow, dark/reduced motion, images, same-origin GET-only reading/status; pageerrors=0')
    browser.close()
