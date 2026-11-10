import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const path = (f) => new URL('../' + f, import.meta.url);
const get = (f) => readFileSync(path(f), 'utf8');
const html = get('index.html'), core = get('assets/core.js');
const data = get('assets/curriculum.js'), ui = get('assets/app.js');
const css = get('assets/style.css'), sw = get('sw.js'), manifest = JSON.parse(get('manifest.webmanifest'));
const totalJs = [core, data, ui].join('\n');
assert.ok(statSync(path('index.html')).size < 10000, 'HTML should remain small');
for (const asset of ['core', 'curriculum', 'app']) {
  assert.ok(html.includes('./assets/' + asset + '.js?v=3'), 'missing versioned deferred JS: ' + asset);
}
assert.ok(html.includes('defer') && !html.includes('type="module"'), 'ordered deferred scripts expected');
assert.ok(html.includes('./assets/style.css?v=3') && html.includes('./manifest.webmanifest'));
assert.ok(!html.includes('data:font/'));
for (const marker of ['const NS_CHESS', 'const NS_SHOGI', 'const NS_STORE', 'trainingMinutes: 15']) {
  assert.ok(core.includes(marker), 'core feature missing: ' + marker);
}
for (const marker of ['const NS_DCHESS', 'const NS_DSHOGI', 'const NS_DMAHJONG', 'const NS_DGO']) {
  assert.ok(data.includes(marker), 'curriculum missing: ' + marker);
}
for (const marker of ['const NS_APP = (async () => {', 'function trainingPanel(g)',
  'root.appendChild(trainingPanel(g))', 'makeCoach', 'function coachPlan()', 'pendingReviews',
  'pendingMistakes', 'runSelfTest(box)', 'viewLesson', 'migrateReviewKeys()',
  "navigator.serviceWorker.register('./sw.js')", 'updateDuration()']) {
  assert.ok(totalJs.includes(marker), 'feature missing: ' + marker);
}
for (const f of ['assets/core.js', 'assets/curriculum.js', 'assets/app.js', 'sw.js'])
  execFileSync(process.execPath, ['--check', path(f).pathname], { stdio: 'inherit' });
assert.ok(css.includes('.training__select') && css.includes('.pboard__fill'));
assert.equal(manifest.start_url, './');
assert.ok(manifest.icons.length >= 2);
for (const path of ['core.js?v=3', 'curriculum.js?v=3', 'app.js?v=3', 'style.css?v=3'])
  assert.ok(sw.includes(path), 'offline cache missing: ' + path);
assert.ok(!sw.includes('fetch(event.request).then'), 'SW should not cache API traffic');
console.log('PASS: scripts, order, caching, coaching, time selector, four games');
