// Local test server: serves public/index.html and runs the real Hub with in-memory storage.
// Run: npm run dev   then open http://localhost:8787
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { Hub } from '../src/worker.js';
import { MemoryStorage } from './mock-do.mjs';
const hub = new Hub({ storage: new MemoryStorage() }, { ADMIN_USERS: '' });
const port = +process.env.PORT || 8787;
http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await hub.fetch(new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }));
    res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(await r.text()); return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(readFileSync(new URL('../public/index.html', import.meta.url)));
}).listen(port, () => console.log('Ahrivaea dev server on http://localhost:' + port));
