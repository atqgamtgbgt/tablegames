import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root = (s) => new URL('../' + s, import.meta.url);
const get = (s) => readFileSync(root(s), 'utf8');
const html = get('index.html'), js = get('assets/app.js'), css = get('assets/style.css');
const manifest = JSON.parse(get('manifest.webmanifest'));
assert.ok(statSync(root('index.html')).size < 15000, 'index should be lightweight');
for (const path of ['./assets/app.js', './assets/style.css', './manifest.webmanifest'])
  assert.ok(html.includes(path), 'missing asset: ' + path);
assert.ok(html.includes('type="module"') && !html.includes('data:font/'));
for (const s of ['chess', 'shogi', 'go', 'mahjong', 'function trainingPanel(g)', 'root.appendChild(trainingPanel(g))', 'makeCoach', 'function coachPlan()', 'pendingReviews', 'pendingMistakes', 'runSelfTest(box)', 'viewLesson', 'migrateReviewKeys()'])
  assert.ok(js.includes(s), 'missing feature: ' + s);
assert.ok(css.includes('.training__steps') && css.includes('.pboard__fill'));
assert.equal(manifest.start_url, './');
assert.ok(manifest.icons.length >= 2);
execFileSync(process.execPath, ['--check', root('assets/app.js').pathname], {stdio:'inherit'});
console.log('PASS: assets, syntax, learning, coaches and four games');
