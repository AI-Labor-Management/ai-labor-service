import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('./dist/', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.woff2':'font/woff2'};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const target = resolve(root, '.' + pathname);
    if (target !== resolve(root) && !target.startsWith(resolve(root) + sep)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    let body, actual = target;
    try { body = await readFile(target); }
    catch {
      if (extname(pathname)) { res.writeHead(404); res.end('Not found'); return; }
      actual = resolve(root, 'index.html'); body = await readFile(actual);
    }
    res.writeHead(200, {'Content-Type':types[extname(actual)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  } catch { res.writeHead(400); res.end('Bad request'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(4173, '127.0.0.1', () => console.log('Open http://127.0.0.1:4173 - Stop: Ctrl+C'));