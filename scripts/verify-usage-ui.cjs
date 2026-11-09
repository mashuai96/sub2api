// Built-page verification. All API calls are intercepted with synthetic data.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { chromium } = require(require.resolve('playwright', {
  paths: [process.env.PLAYWRIGHT_MODULE_PATH, root, path.join(root, 'frontend')].filter(Boolean),
}));

const dist = path.join(root, 'backend/internal/web/dist');
const output = path.resolve(root, process.env.USAGE_UI_OUTPUT_DIR || '.build/usage-ui');
assert(fs.existsSync(path.join(dist, 'index.html')), 'Build the frontend before running UI verification.');
fs.mkdirSync(output, { recursive: true });
const baseRow = {
  id: 1, request_id: 'synthetic-usage-1', model: 'gpt-6.1-sol',
  created_at: '2026-11-09T01:00:00Z', user_id: 99, api_key_id: 99,
  account_id: 99, group_id: 99, platform: 'openai',
  input_tokens: 104, output_tokens: 235, cache_read_tokens: 896, cache_creation_tokens: 0,
  first_token_ms: 876, duration_ms: 8180, stream: true,
  request_type: 'stream', billing_type: 0, actual_cost: 0.01, total_cost: 0.01,
  account_cost: 0.005, input_cost: 0.005, output_cost: 0.005, rate_multiplier: 1,
  service_tier: 'priority',
  user: { id: 99, email: 'synthetic@example.invalid' },
  api_key: { id: 99, name: 'Synthetic key' },
  account: { id: 99, name: 'Synthetic account' },
  group: { id: 99, name: 'Synthetic group' },
  content_timing: { sse_event_first_ms: 2940, semantic_first_ms: 10060 },
  queue_wait_ms: 2060,
  queue_timing: { status: 'measured', server_first_token_ms: 2940, server_duration_ms: 10240 },
};
const rows = [baseRow,
  { ...baseRow, id: 2, request_id: 'synthetic-usage-2', first_token_ms: 4270, duration_ms: 13630 },
  { ...baseRow, id: 3, request_id: 'synthetic-usage-3', first_token_ms: 30000, duration_ms: 60000 },
  { ...baseRow, id: 4, request_id: 'synthetic-usage-4', first_token_ms: 60000, duration_ms: 300000 },
  { ...baseRow, id: 5, request_id: 'synthetic-usage-5', first_token_ms: null, duration_ms: null, output_tokens: 0, input_tokens: 0, cache_read_tokens: 0 },
];
const stats = { total_requests: rows.length, total_tokens: 600, total_input_tokens: 200,
  total_output_tokens: 400, total_cost: 0.02, total_actual_cost: 0.02,
  average_duration_ms: 18950, total_cache_creation_tokens: 0, total_cache_read_tokens: 0, endpoints: [] };
const server = http.createServer((request, response) => {
  const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(dist, '.' + relative);
  if (!file.startsWith(dist + path.sep) && file !== dist) return response.writeHead(400).end();
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, 'index.html');
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' };
  response.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(response);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
  const results = [];
  try {
    for (const role of ['user', 'admin']) {
      for (const width of [1440, 768, 390, 320]) {
        const user = { id: 99, email: 'synthetic@example.invalid', username: 'Synthetic', role,
          status: 'active', balance: 100, concurrency: 10, created_at: '2026-11-09T00:00:00Z',
          updated_at: '2026-11-09T00:00:00Z', totp_enabled: false, allowed_groups: [] };
        const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'zh-CN' });
        const errors = [], remote = [], apiPaths = [];
        await context.addInitScript(({ user }) => {
          localStorage.setItem('auth_token', 'synthetic-browser-fixture');
          localStorage.setItem('auth_user', JSON.stringify(user));
          localStorage.setItem('sub2api_locale', 'zh');
          localStorage.setItem(`${user.role}_guide_${user.id}_${user.role}_v4_interactive`, 'true');
        }, { user });
        await context.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.origin !== base) { remote.push(url.origin); return route.abort(); }
          if (!url.pathname.startsWith('/api/')) return route.continue();
          apiPaths.push(url.pathname);
          let data = {};
          if (url.pathname.endsWith('/auth/me')) data = { ...user, run_mode: 'standard' };
          else if (url.pathname.includes('public')) data = { site_name: 'UI verification', registration_enabled: false,
            allow_user_view_error_requests: false, custom_menu_items: [], feature_flags: { subscription: false },
            usage_show_cache_rate: true, usage_show_cache_rate_to_users: true };
          else if (url.pathname.endsWith('/timing')) data = { traces: [], retention_days: 30 };
          else if (/\/usage$/.test(url.pathname)) data = { items: rows, total: rows.length, page: 1, page_size: 20, pages: 1 };
          else if (url.pathname.includes('snapshot')) data = { trend: [], models: [], groups: [], stats };
          else if (url.pathname.endsWith('/stats')) data = stats;
          else if (url.pathname.includes('models')) data = { models: [] };
          else if (url.pathname.includes('trend')) data = { trend: [] };
          else if (/groups|announcements|notices|subscriptions/.test(url.pathname)) data = [];
          else if (/keys|users|accounts/.test(url.pathname)) data = { items: [], total: 0 };
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data }) });
        });
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(base + (role === 'admin' ? '/admin/usage' : '/usage'), { waitUntil: 'networkidle' });
        const cells = page.getByTestId('usage-latency');
        await cells.first().waitFor();
        assert.equal(await cells.count(), rows.length);
        assert.match(await cells.first().innerText(), /876ms/);
        assert.match(await cells.first().innerText(), /8\.18s/);
        assert.doesNotMatch(await cells.first().innerText(), /2\.94s|10\.24s|TPS|%/);
        const tps = page.getByTestId('latency-tps').first();
        const cache = page.getByTestId('latency-cache-rate').first();
        assert.equal(await tps.innerText(), '28.7 t/s');
        assert.equal(await cache.innerText(), '89.6%');
        assert.match(await tps.getAttribute('class'), /text-violet-500/);
        assert.match(await cache.getAttribute('class'), /text-blue-500/);
        assert.equal(await page.getByTestId('latency-tps').last().innerText(), '-');
        assert.equal(await page.getByTestId('latency-cache-rate').last().innerText(), '-');
        const classes = await cells.evaluateAll(nodes => nodes.map(n => [...n.querySelectorAll('.tabular-nums')].map(e => e.className)));
        assert.match(classes[0][0], /text-emerald-600/);
        assert.match(classes[0][1], /text-emerald-600/);
        assert.match(classes[2][0], /text-orange-600/);
        assert.match(classes[2][1], /text-amber-600/);
        assert.match(classes[3][0], /text-red-600/);
        assert.match(classes[3][1], /text-red-600/);
        await page.getByTestId('usage-performance').first().scrollIntoViewIfNeeded();
        const bounds = await cells.first().boundingBox();
        const performance = await page.getByTestId('usage-performance').first().boundingBox();
        await page.screenshot({ path: path.join(output, `${role}-${width}.png`) });
        assert(bounds && performance && (bounds.x + bounds.width <= performance.x + 1 || bounds.y + bounds.height <= performance.y + 1),
          JSON.stringify({ role, width, bounds, performance, error: 'latency/performance overlap' }));
        const fit = await cells.evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth + 1));
        assert(fit, 'latency text must fit its grid');
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(output, `${role}-${width}.png`) });
        await cells.first().click();
        const dialog = page.locator('.modal-body');
        await dialog.waitFor();
        await page.waitForTimeout(400);
        assert.equal(await page.locator('.driver-popover').count(), 0, 'Onboarding must not cover the timing dialog');
        assert.match(await dialog.innerText(), /876ms/);
        assert.match(await dialog.innerText(), /8\.18s/);
        assert.match(await dialog.innerText(), /2\.94s/);
        assert.equal(await page.getByTestId('final-content-timing').count(), 0);
        assert.equal(await dialog.locator('.rounded-xl.border.p-4').count(), 9);
        if (role === 'user') assert(!apiPaths.some(p => /\/admin\/|\/timing$/.test(p)), 'User modal must not read admin or observer traces');
        else assert(apiPaths.includes('/api/v1/admin/usage/1/timing'));
        const modalFit = await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1);
        assert(modalFit, 'timing dialog must not overflow');
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(output, `${role}-${width}-timing.png`) });
        await page.keyboard.press('Escape');
        results.push({ legacyFirstMs: 876, modalFits: modalFit, role, width, textFits: fit, columnsSeparate: true, pageErrors: errors, blockedExternalOrigins: remote });
        await context.close();
      }
    }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: true, realApiRequests: 0, results }, null, 2));
    console.log(JSON.stringify({ passed: true, scenarios: results.length, output }));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
