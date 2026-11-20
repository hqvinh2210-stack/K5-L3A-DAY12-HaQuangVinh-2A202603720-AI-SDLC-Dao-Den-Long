import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['../index.html', 'text/html; charset=utf-8']],
  ['/src/style.css', ['./style.css', 'text/css; charset=utf-8']],
  ['/src/client.mjs', ['./client.mjs', 'text/javascript; charset=utf-8']],
  ['/src/render.mjs', ['./render.mjs', 'text/javascript; charset=utf-8']],
  ['/src/sim.mjs', ['./sim.mjs', 'text/javascript; charset=utf-8']],
  ['/game.contract.json', ['../game.contract.json', 'application/json; charset=utf-8']],
]);
const port = Number(process.env.PORT ?? 4173);

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const entry = files.get(url.pathname);
  if (!entry || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(entry ? 405 : 404).end();
    return;
  }
  try {
    const [path, type] = entry;
    const data = await readFile(new URL(path, import.meta.url));
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    console.error(error.message);
    response.writeHead(500).end();
  }
}).listen(port, '127.0.0.1', () => console.log('Đảo Đèn Lồng · http://127.0.0.1:' + port));
