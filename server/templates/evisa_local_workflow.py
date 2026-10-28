#!/usr/bin/env python3
"""Locally executed E-Visa draft assistant. No CDP, background agent or final submit.

The upstream 11k-line sample was not copied: it contains one person's data,
recursive machine-wide file searches, unverified selectors and live CDP actions.
This generated script uses populated draft fields only; verify every value.
"""
from __future__ import annotations
import argparse
import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

PLAN = json.loads(__EVISA_PLAN_JSON__)
DEFAULT_URL = __EVISA_URL_JSON__
DEFAULT_FOLDER = __EVISA_FOLDER_JSON__
OFFICIAL_HOSTS = {'eviza.mae.ro', 'evisa.mae.ro'}


def selected_stages():
    return PLAN['stages'] if PLAN['mode'] == 'FULL_PIPELINE' else [s for s in PLAN['stages'] if s['id'] == PLAN['mode']]


def validate_url(url: str, test_mode: bool = False) -> str:
    parsed = urlparse(url.strip())
    official = parsed.scheme == 'https' and parsed.hostname in OFFICIAL_HOSTS
    local_test = test_mode and parsed.scheme == 'http' and parsed.hostname in {'127.0.0.1', 'localhost'}
    if not (official or local_test):
        raise ValueError('Use an official HTTPS Romanian e-Visa URL; localhost requires --test-mode.')
    if parsed.username or parsed.password:
        raise ValueError('Do not include login credentials in the URL.')
    return url.strip()


def load_local_documents(folder_name: str, map_name: str):
    """No recursive scan. Explicit local mapping only; data never enters the ZIP."""
    folder = Path(folder_name).expanduser().resolve(strict=True)
    if not folder.is_dir():
        raise ValueError('Local document folder does not exist.')
    map_path = Path(map_name).expanduser()
    if map_path.stat().st_size > 50_000:
        raise ValueError('Selector map is too large.')
    mapping = json.loads(map_path.read_text(encoding='utf-8'))
    if not isinstance(mapping, list) or len(mapping) > 12:
        raise ValueError('Document map must be a list of at most 12 explicit files.')
    results = []
    for item in mapping:
        if not isinstance(item, dict) or not all(isinstance(item.get(k), str) for k in ('filename', 'xpath')):
            raise ValueError('Each document requires filename and xpath strings.')
        filename = item['filename']
        if filename != Path(filename).name or any(char in filename for char in ('/', '\\')):
            raise ValueError('Use filenames only; no nested or external paths.')
        path = (folder / filename).resolve(strict=True)
        if not path.is_relative_to(folder) or not path.is_file() or path.suffix.lower() not in {'.pdf','.png','.jpg','.jpeg'} or path.stat().st_size > 15_000_000:
            raise ValueError('Document is outside the selected folder, unsupported or over 15 MB.')
        xpath = item['xpath'].strip()
        if not xpath or len(xpath) > 800:
            raise ValueError('Review the portal field XPath for each document.')
        results.append((path, xpath))
    return results


async def fill_stage(page, stage):
    print('Stage:', stage['title'])
    for item in stage['fields']:
        value = item['value']
        if not isinstance(value, str) or not value:
            print('  Manual choice:', item['key'], value)
            continue
        expression = PLAN['selectors'].get(item['key'], '')
        if not expression:
            print('  No selector:', item['key'])
            continue
        try:
            locator = page.locator('xpath=' + expression).first
            if not await locator.count() or not await locator.is_visible():
                print('  Selector not found; review manually:', item['key'])
            elif await locator.evaluate('(el) => el.tagName.toLowerCase()') == 'select':
                print('  Dropdown requires manual review:', item['key'], value)
            else:
                await locator.fill(value, timeout=5000)
                print('  Filled:', item['key'])
        except Exception as exc:
            print('  Could not fill; review manually:', item['key'], type(exc).__name__)


async def confirmed_click(page, xpath, label):
    if not xpath:
        print(label, 'requires a reviewed --' + label.lower() + '-xpath; no click made.')
        return False
    locator = page.locator('xpath=' + xpath)
    count = await locator.count()
    if count != 1 or not await locator.is_visible():
        print(label, 'selector is not unique and visible (matches:', count, '); no click made.')
        return False
    answer = await asyncio.to_thread(input, f'Type {label} to click the inspected {label} control (anything else skips): ')
    if answer.strip() != label:
        print(label, 'skipped.')
        return False
    await locator.click(timeout=5000)
    print(label, 'clicked; check the portal response manually.')
    return True


async def upload_local_documents(page, folder, map_name):
    for path, expression in load_local_documents(folder, map_name):
        answer = await asyncio.to_thread(input, f'Check portal upload field and local file {path.name}. Type UPLOAD to attach, or Enter to skip: ')
        if answer.strip() != 'UPLOAD':
            continue
        locator = page.locator('xpath=' + expression)
        if await locator.count() != 1:
            print('Upload selector is not unique:', path.name)
            continue
        if not await locator.evaluate('(el) => el.tagName.toLowerCase() === "input" && el.type === "file"'):
            print('Upload selector does not identify a file input:', path.name)
            continue
        await locator.set_input_files(str(path))
        print('Selected local file:', path.name, 'Verify it appears in the portal manually.')


async def run(args):
    url = validate_url(args.url or (await asyncio.to_thread(input, 'Official E-Visa URL: ')), args.test_mode)
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        raise SystemExit('Install requirements.txt, then python -m playwright install chromium.') from exc
    print('Starting isolated headed browser. Login and CAPTCHA are manual. No final submission exists.')
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=False)
        try:
            page = await browser.new_page()
            await page.goto(url, wait_until='domcontentloaded')
            for stage in selected_stages():
                if stage['id'] in {'PHOTO_UPLOAD', 'SUMMARY_FILE'}:
                    print('Manual-only stage:', stage['title'])
                    continue
                answer = await asyncio.to_thread(input, f'Navigate to {stage["title"]}; verify applicant and portal page. Type FILL to enter visible text (or Enter to skip): ')
                if answer.strip() != 'FILL':
                    continue
                validate_url(page.url, args.test_mode)  # never fill a redirected third-party origin
                await fill_stage(page, stage)
                if args.save_xpath:
                    validate_url(page.url, args.test_mode)
                    await confirmed_click(page, args.save_xpath, 'SAVE')
                if args.next_xpath:
                    validate_url(page.url, args.test_mode)
                    await confirmed_click(page, args.next_xpath, 'NEXT')
            if args.upload_local_docs:
                if not args.folder or not args.document_map:
                    raise ValueError('To upload local files, provide --folder and --document-map with inspected selectors.')
                await asyncio.to_thread(input, 'Navigate to the portal supporting-document page and press Enter to review each mapped file...')
                validate_url(page.url, args.test_mode)
                await upload_local_documents(page, args.folder, args.document_map)
            await asyncio.to_thread(input, 'Review the summary and any unsaved stages manually. Final submission is NEVER automated. Press Enter to close the browser...')
        finally:
            await browser.close()


def main():
    parser = argparse.ArgumentParser(description='Local E-Visa draft assistant. No final submission.')
    parser.add_argument('--run', action='store_true', help='Explicitly launch an isolated local browser; manual login and stage confirmation')
    parser.add_argument('--url', default=DEFAULT_URL, help='Official HTTPS e-Visa URL')
    parser.add_argument('--folder', default=DEFAULT_FOLDER, help='Local document folder on this PC; no files are bundled')
    parser.add_argument('--save-xpath', default='', help='Inspected unique Save XPath, clicked only after confirmation')
    parser.add_argument('--next-xpath', default='', help='Inspected unique Next XPath, clicked only after confirmation')
    parser.add_argument('--upload-local-docs', action='store_true', help='Opt in to per-file confirmed local document selection')
    parser.add_argument('--document-map', default='', help='Local JSON array of {filename,xpath}; no recursive file search')
    parser.add_argument('--test-mode', action='store_true', help='Allow localhost HTTP for a private mock test only')
    args = parser.parse_args()
    count = sum(len(stage['fields']) for stage in selected_stages())
    print('E-Visa plan:', len(selected_stages()), 'stages,', count, 'known fields. No values invented.')
    print('Local folder configured:', bool(args.folder), '| URL configured:', bool(args.url))
    if args.run:
        try:
            asyncio.run(run(args))
        except (ValueError, FileNotFoundError) as exc:
            raise SystemExit(str(exc)) from exc
    else:
        print('Dry run only. Use --run after reviewing code, candidate, URL and selectors. No browser launched.')


if __name__ == '__main__':
    main()
