#!/usr/bin/env node
'use strict';
// Unit editor — local browser UI.  node tools/unit-editor/server.cjs [port]
// Serves index.html and a tiny JSON API on top of unitdata.cjs. No dependencies. Binds to localhost only.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');
const data = require('./unitdata.cjs');

const PORT = Number(process.argv[2]) || 3456;
const DIST = path.join(__dirname, 'dist');   // `npm run build` (web/) 결과
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function send(res, code, body, type = 'application/json; charset=utf-8') {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) reject(new Error('body too large')); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function serveStatic(res, pathname) {
  const file = path.join(DIST, pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return send(res, 404, '화면이 빌드되지 않았습니다: cd tools/unit-editor/web && npm install && npm run build', 'text/plain; charset=utf-8');
  }
  return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/api/state') {
      return send(res, 200, data.stateForEditor());
    }
    if (req.method === 'POST' && (url.pathname === '/api/validate' || url.pathname === '/api/unit/validate')) {
      const body = await readBody(req);
      return send(res, 200, data.previewValidate(body.unit || {}, { mode: body.mode || 'upsert' }));
    }
    if (req.method === 'POST' && url.pathname === '/api/unit') {
      const body = await readBody(req);
      const r = data.saveUnit(body.unit || {}, { mode: body.mode || 'upsert' });
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/unit/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/unit/'.length));
      const r = data.removeUnit(id, { force: url.searchParams.get('force') === '1' });
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === 'POST' && url.pathname === '/api/effect/validate') {
      const body = await readBody(req);
      return send(res, 200, data.previewValidateEffect(body.effect || {}, { mode: body.mode || 'upsert' }));
    }
    if (req.method === 'POST' && url.pathname === '/api/effect') {
      const body = await readBody(req);
      const r = data.saveEffect(body.effect || {}, { mode: body.mode || 'upsert' });
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/effect/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/effect/'.length));
      const r = data.removeEffect(id, { force: url.searchParams.get('force') === '1' });
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === 'POST' && url.pathname === '/api/stage/validate') {
      const body = await readBody(req);
      return send(res, 200, data.previewValidateStage(body.stage || {}, { mode: body.mode || 'upsert' }));
    }
    if (req.method === 'POST' && url.pathname === '/api/stage') {
      const body = await readBody(req);
      const r = data.saveStage(body.stage || {}, { mode: body.mode || 'upsert' });
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/stage/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/stage/'.length));
      const r = data.removeStage(id, { force: url.searchParams.get('force') === '1' });
      return send(res, r.ok ? 200 : 400, r);
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/resource/')) {
      const ruid = url.pathname.slice('/api/resource/'.length).toLowerCase();
      return send(res, 200, await data.lookupResource(ruid));
    }
    if (req.method === 'GET' && !url.pathname.startsWith('/api/')) return serveStatic(res, url.pathname);
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = `http://localhost:${PORT}`;
  console.log(`unit-editor: ${addr}`);
  console.log(`data: ${data.DATA_DIR}`);
  console.log('저장 전에 Maker의 데이터셋 편집기는 닫아 두세요. 저장 후 Maker에서 refresh 하면 반영됩니다. Ctrl+C로 종료.');
  if (!process.argv.includes('--no-open')) {
    const cmd = process.platform === 'win32' ? `start "" "${addr}"` : process.platform === 'darwin' ? `open "${addr}"` : `xdg-open "${addr}"`;
    exec(cmd, () => {});
  }
});
