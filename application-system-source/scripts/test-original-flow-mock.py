"""Synthetic, offline contract test for the attached original's Save/Next method.

Runs ONLY the extracted method on an in-memory mock page, never the full
candidate-specific script, portal login, document scanner or final submission.
Requires Python Playwright plus Chromium; see README.
"""
import ast
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

TEMPLATE = Path(__file__).resolve().parents[1] / 'server/templates/evisa_original_automation.py'
source = TEMPLATE.read_text(encoding='utf-8')
module = ast.parse(source)
method = next(node for node in ast.walk(module) if isinstance(node, ast.AsyncFunctionDef) and node.name == 'trigger_save_and_next')
lines = source.splitlines(keepends=True)
method_source = ''.join(lines[method.lineno - 1:method.end_lineno])
assert 'if not save_clicked:' in method_source  # original DOM fallback, not a stop condition
assert 'Refusing to click Next without saving' not in method_source
namespace = {'asyncio': asyncio}
probe_class = '''class Probe:
    def __init__(self, page, supporting=False):
        self.page = page
        self.supporting = supporting
    async def wait_for_ajax_idle(self, *args):
        await asyncio.sleep(0)
    async def _is_on_supporting_docs_page(self):
        return self.supporting
'''
exec(probe_class + method_source, namespace)
Probe = namespace['Probe']

async def exercise():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            for mode, expected in [('normal', ['SAVE', 'NEXT']), ('no-save', ['NEXT']), ('supporting', [])]:
                save = '<button id="btnSalveaza" onclick="window.clicked.push(\'SAVE\')">Save</button>' if mode != 'no-save' else ''
                html = '<!doctype html><script>window.clicked=[]</script><input id="ContinuaLaSalvare">' + save + '<button id="btnInainte" onclick="window.clicked.push(\'NEXT\')">Next</button><button id="final" onclick="window.clicked.push(\'FINAL\')">Final Submit</button>'
                await page.set_content(html)
                await Probe(page, supporting=(mode == 'supporting')).trigger_save_and_next()
                clicks = await page.evaluate('window.clicked')
                assert clicks == expected, (mode, clicks, expected)
            print('Original Save/Next mock: SAVE then NEXT; original also clicks NEXT when Save is missing; supporting-doc guard and no FINAL confirmed.')
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(exercise())
