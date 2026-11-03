import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const origin = process.argv[2] || 'http://127.0.0.1:5173';
const live = origin.startsWith('https:');
const { chromium } = createRequire(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'))('playwright');
const output = path.join(root, 'outputs/favorites');
mkdirSync(output, { recursive: true });
const checks = [], errors = [];
const check = (value, label) => { assert(value, label); checks.push(label); console.log('PASS ' + label); };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--enable-unsafe-swiftshader'] });
let context, privateId, created = 0, deleted = 0;
try {
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(live ? 90000 : 30000);
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const initial = await (await context.request.get(origin + '/api/works?scope=public')).json();
  const first = initial.works.find(work => work.id === 'lamp') || initial.works[0];
  const second = initial.works.find(work => work.id === 'sofa') || initial.works[1];
  assert(first && second && first.id !== second.id);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const nav = p => p.locator('.nav-links a[aria-label="我的收藏"]');
  const card = (p, title) => p.locator('.work-card').filter({ has: p.getByRole('heading', { name: title, exact: true }) });
  const navigate = async (p, route) => { await p.goto(origin + '/#' + route, { waitUntil: 'domcontentloaded' }); await p.locator('main').waitFor(); };
  const waitSaved = async (p, count) => { await p.waitForFunction(n => document.querySelectorAll('.favorites-page .work-card').length === n && !document.querySelector('.favorites-page .page-loading'), count); };
  const seed = async (values, p = page) => { await p.evaluate(data => localStorage.setItem('formspace-favorites', JSON.stringify(data)), values); await p.reload({ waitUntil: 'domcontentloaded' }); await navigate(p, '/favorites'); };

  await navigate(page, '/works');
  await card(page, first.title).waitFor();
  check(await nav(page).isVisible(), 'main navigation exposes a dedicated favorites page');
  check(await page.getByRole('link', { name: '打开我的收藏', exact: true }).isVisible(), 'collection toolbar links to all favorites instead of a list-only filter');
  await card(page, first.title).getByRole('button', { name: '收藏' + first.title, exact: true }).click();
  await card(page, second.title).getByRole('button', { name: '收藏' + second.title, exact: true }).click();
  await nav(page).click(); await waitSaved(page, 2);
  check(page.url().endsWith('#/favorites') && await page.title() === '我的收藏 · 长序', 'favorites has its own route and browser title');
  check(await nav(page).getAttribute('aria-current') === 'page' && await nav(page).locator('.nav-count').innerText() === '2', 'active navigation and saved count update immediately');
  check(await page.locator('.favorites-page .work-card h3').first().innerText() === second.title, 'most recently saved work appears first');
  check(await card(page, first.title).getByRole('button', { name: '取消收藏' + first.title, exact: true }).getAttribute('aria-pressed') === 'true', 'favorite cards retain the active heart and real work content');
  await page.screenshot({ path: path.join(output, live ? 'live.png' : 'local.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('textbox', { name: '搜索作品、标签或创作者' }).fill(first.title);
  check(await page.locator('.favorites-page .work-card').count() === 1, 'search only filters the saved collection');
  await page.getByRole('button', { name: '清空搜索', exact: true }).click();
  await page.getByRole('group', { name: '作品主方向', exact: true }).getByRole('button', { name: /^三维/ }).click();
  const tags = page.getByRole('group', { name: '三维作品的标签筛选', exact: true });
  const labels = await tags.getByRole('button').allTextContents();
  check(labels.length > 1 && new Set(labels).size === labels.length, 'direction filters summarize unique tags from saved works');
  await tags.getByRole('button').nth(1).click();
  await page.getByRole('group', { name: '作品主方向', exact: true }).getByRole('button', { name: /^其他/ }).click();
  await page.getByRole('group', { name: '作品主方向', exact: true }).getByRole('button', { name: /^三维/ }).click();
  check(await tags.getByRole('button', { name: '不限标签', exact: true }).getAttribute('aria-pressed') === 'true', 'switching directions clears the previous tag');
  await page.getByRole('group', { name: '作品主方向', exact: true }).getByRole('button', { name: /^全部/ }).click();
  await page.getByRole('combobox', { name: '作品排序', exact: true }).selectOption('title');
  check(JSON.stringify(await page.locator('.favorites-page .work-card h3').allTextContents()) === JSON.stringify([first.title, second.title].sort((a, b) => a.localeCompare(b, 'zh'))), 'favorites preserves name sorting');
  await card(page, second.title).getByRole('button', { name: '取消收藏' + second.title, exact: true }).click(); await waitSaved(page, 1);
  check(await card(page, second.title).count() === 0, 'unfavoriting removes a card from the dedicated page');
  await page.reload({ waitUntil: 'domcontentloaded' }); await waitSaved(page, 1);
  check(await card(page, first.title).count() === 1, 'refresh retains favorites from the existing localStorage key');
  await card(page, first.title).getByRole('heading', { name: first.title, exact: true }).click();
  await page.locator('.detail-info h1').waitFor();
  await page.getByRole('button', { name: '已收藏', exact: true }).click();
  await nav(page).click(); await page.locator('.favorites-empty').waitFor();
  check(await page.getByRole('link', { name: '去作品展厅看看', exact: true }).isVisible(), 'unfavoriting from detail updates favorites and offers a useful empty state');
  await seed([first.id, first.id, '', 42]); await waitSaved(page, 1);
  check(await nav(page).locator('.nav-count').innerText() === '1', 'legacy bookmarks are preserved while duplicate and invalid IDs are ignored');

  const otherTab = await context.newPage();
  otherTab.on('pageerror', error => errors.push(error.message));
  await navigate(otherTab, '/favorites'); await waitSaved(otherTab, 1);
  await navigate(page, '/works'); await card(page, second.title).getByRole('button', { name: '收藏' + second.title, exact: true }).click();
  await waitSaved(otherTab, 2);
  check(await nav(otherTab).locator('.nav-count').innerText() === '2', 'another open tab receives newly saved favorites');
  await card(otherTab, second.title).getByRole('button', { name: '取消收藏' + second.title, exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.nav-links a[aria-label="我的收藏"] .nav-count').textContent === '1');
  check(await card(page, second.title).getByRole('button', { name: '收藏' + second.title, exact: true }).count() === 1, 'removing in another tab also updates the gallery heart');
  await otherTab.close();

  const missing = 'qa-favorites-unavailable-' + Date.now();
  await seed([first.id, missing]); await waitSaved(page, 1);
  check(await page.getByRole('status').filter({ hasText: '有 1 件收藏暂不可查看' }).isVisible(), 'withdrawn or missing works get an explicit availability notice');
  check(await page.evaluate(id => JSON.parse(localStorage.getItem('formspace-favorites')).includes(id), missing), 'an unavailable work does not silently erase its saved reference');
  const failPattern = '**/api/works/' + encodeURIComponent(first.id);
  await page.route(failPattern, route => route.fulfill({ status: 503, json: { error: '临时验证故障' } }));
  await seed([first.id, second.id]); await waitSaved(page, 1);
  check(await page.getByRole('alert').filter({ hasText: '有 1 件收藏加载失败' }).isVisible(), 'a partial network failure keeps the successfully loaded cards');
  await page.unroute(failPattern); await page.getByRole('button', { name: '重试', exact: true }).click(); await waitSaved(page, 2);
  check(await card(page, first.title).count() === 1, 'retry recovers the failed favorite without adding it again');
  await page.route(failPattern, route => route.fulfill({ status: 503, json: { error: '临时验证故障' } }));
  await seed([first.id]); await page.getByRole('heading', { name: '收藏暂时没有完整打开。', exact: true }).waitFor();
  check(await page.getByRole('button', { name: /^重新加载/ }).isVisible(), 'a total request failure offers retry instead of claiming the collection is empty');
  await page.unroute(failPattern);
  await seed([missing]); await page.getByRole('heading', { name: '这些收藏，暂时无法查看。', exact: true }).waitFor();
  check(await page.locator('.work-card').count() === 0, 'unavailable works reveal no stale title, model, or editable card');

  if (!live) {
    const title = 'QA-favorites-' + Date.now();
    const response = await context.request.post(origin + '/api/works', { headers: { Origin: origin }, data: { title, direction: '其他', contentText: '只用于独立收藏页私密读取验证，结束后删除。' } });
    assert.equal(response.status(), 201); privateId = (await response.json()).work.id; created++;
    await seed([privateId]); await waitSaved(page, 1);
    check(await card(page, title).isVisible(), 'the author can view a favorite private work omitted from the public gallery');
    const stranger = await browser.newContext();
    try {
      await stranger.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const guest = await stranger.newPage();
      await navigate(guest, '/about'); await seed([privateId], guest);
      await guest.getByRole('heading', { name: '这些收藏，暂时无法查看。', exact: true }).waitFor();
      check(await guest.getByText(title, { exact: true }).count() === 0, 'copying a favorite ID into another browser never reveals a private work');
    } finally { await stranger.close(); }
    assert.equal((await context.request.delete(origin + '/api/works/' + privateId, { headers: { Origin: origin } })).status(), 200); privateId = null; deleted++;
  }
  await page.evaluate(() => localStorage.setItem('formspace-favorites', '{'));
  await page.reload({ waitUntil: 'domcontentloaded' }); await navigate(page, '/favorites'); await page.locator('.favorites-empty').waitFor();
  check(await nav(page).locator('.nav-count').innerText() === '0', 'malformed stored preferences do not crash the website');
  await seed([first.id, second.id]); await waitSaved(page, 2);
  for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 850, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), size.width + 'x' + size.height + ' favorites and navigation have no horizontal overflow');
  }
  const final = await (await context.request.get(origin + '/api/works?scope=public')).json();
  check(JSON.stringify(initial.works.map(work => work.id).sort()) === JSON.stringify(final.works.map(work => work.id).sort()), 'the exact existing public work set remains unchanged');
  check(errors.length === 0, 'favorites flow has no browser runtime errors');
  writeFileSync(path.join(output, live ? 'live.json' : 'local.json'), JSON.stringify({ result: 'passed', origin, browser: 'Microsoft Edge', version: browser.version(), checks, errors, privateWorksCreated: created, privateWorksDeleted: deleted, publicCount: final.works.length, productionWorkWrites: 0 }, null, 2));
} finally {
  if (context && privateId) {
    const response = await context.request.delete(origin + '/api/works/' + privateId, { headers: { Origin: origin } });
    assert([200, 404].includes(response.status()), 'Exact private QA cleanup failed');
  }
  await browser.close();
}
