// Cliente mínimo do Chrome DevTools Protocol via --remote-debugging-pipe (sem Puppeteer/Playwright).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function launchChrome(chromePath) {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulso-chrome-'));
  const shell = /headless_shell$/.test(chromePath);
  const args = [
    shell ? '--headless' : '--headless=new', '--remote-debugging-pipe', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--mute-audio', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--disable-background-networking', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--disable-features=Translate,MediaRouter,OptimizationHints,AcceptCHFrame', '--disable-component-update', '--metrics-recording-only',
    '--password-store=basic', '--use-mock-keychain', `--user-data-dir=${userDir}`, 'about:blank',
  ];
  const proc = spawn(chromePath, args, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const out = proc.stdio[3], inp = proc.stdio[4];
  let seq = 0, closed = false, buf = '';
  const pending = new Map(), listeners = new Set(), stderr = [];
  proc.stderr.on('data', (d) => { stderr.push(String(d)); if (stderr.length > 40) stderr.shift(); });

  const dispose = (why) => {
    if (closed) return;
    closed = true;
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error(`Chrome fechou: ${why}`)); }
    pending.clear();
    fs.rm(userDir, { recursive: true, force: true }, () => {});
  };
  proc.on('exit', (code, sig) => dispose(`saída ${code ?? sig}`));
  proc.on('error', (e) => dispose(e.message));
  out.on('error', () => {});

  inp.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\0')) >= 0) {
      const raw = buf.slice(0, i); buf = buf.slice(i + 1);
      let msg; try { msg = JSON.parse(raw); } catch { continue; }
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve, reject, timer } = pending.get(msg.id); pending.delete(msg.id); clearTimeout(timer);
        if (msg.error) reject(new Error(`${msg.error.message}${msg.error.data ? ` (${msg.error.data})` : ''}`)); else resolve(msg.result);
      } else if (msg.method) for (const fn of listeners) fn(msg);
    }
  });

  function send(method, params = {}, sessionId, timeoutMs = 60_000) {
    if (closed) return Promise.reject(new Error('Chrome não está rodando'));
    const id = ++seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`tempo esgotado em ${method}`)); }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      out.write(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }) + '\0');
    });
  }

  await send('Browser.getVersion', {}, undefined, 30_000).catch((e) => { throw new Error(`Chrome não iniciou (${chromePath}): ${e.message}\n${stderr.join('').slice(-800)}`); });

  async function newPage() {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const logs = [];
    let crashed = null;
    const onMsg = (m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Runtime.exceptionThrown') logs.push('exceção: ' + ((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text));
      else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(`${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      else if (m.method === 'Inspector.targetCrashed') crashed = 'a página travou (memória?)';
      if (logs.length > 30) logs.shift();
    };
    listeners.add(onMsg);
    await send('Runtime.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Inspector.enable', {}, sessionId).catch(() => {});

    async function evaluate(expression, timeoutMs = 120_000) {
      if (crashed) throw new Error(crashed);
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId, timeoutMs);
      if (r.exceptionDetails) {
        const d = r.exceptionDetails;
        throw new Error(((d.exception && (d.exception.description || d.exception.value)) || d.text || 'erro na página') + (logs.length ? `\n${logs.slice(-5).join('\n')}` : ''));
      }
      return r.result ? r.result.value : undefined;
    }
    async function waitFor(expression, timeoutMs = 30_000) {
      const t0 = Date.now();
      for (;;) {
        try { if (await evaluate(`!!(${expression})`, 10_000)) return; } catch (e) { if (crashed) throw e; }
        if (Date.now() - t0 > timeoutMs) throw new Error(`a página não ficou pronta: ${expression}${logs.length ? `\n${logs.slice(-5).join('\n')}` : ''}`);
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    async function navigate(url) { await send('Page.navigate', { url }, sessionId); }
    async function close() { listeners.delete(onMsg); await send('Target.closeTarget', { targetId }).catch(() => {}); }
    return { evaluate, waitFor, navigate, close, logs };
  }

  async function close() {
    if (closed) return;
    try { await send('Browser.close', {}, undefined, 5000); } catch { /* já fechando */ }
    setTimeout(() => { if (!closed) proc.kill('SIGKILL'); }, 3000).unref();
  }

  return { newPage, close, get alive() { return !closed; }, pid: proc.pid };
}
