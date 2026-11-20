import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createLeaderboard } from './leaderboard.mjs';

const files = new Map([
  ['/', ['../index.html', 'text/html; charset=utf-8']],
  ['/src/style.css', ['./style.css', 'text/css; charset=utf-8']],
  ['/src/client.mjs', ['./client.mjs', 'text/javascript; charset=utf-8']],
  ['/src/render.mjs', ['./render.mjs', 'text/javascript; charset=utf-8']],
  ['/src/maps.mjs', ['./maps.mjs', 'text/javascript; charset=utf-8']],
  ['/src/audio.mjs', ['./audio.mjs', 'text/javascript; charset=utf-8']],
  ['/src/sim.mjs', ['./sim.mjs', 'text/javascript; charset=utf-8']],
  ['/src/scores.mjs', ['./scores.mjs', 'text/javascript; charset=utf-8']],
  ['/src/settings.mjs', ['./settings.mjs', 'text/javascript; charset=utf-8']],
  ['/src/leaderboard-ui.mjs', ['./leaderboard-ui.mjs', 'text/javascript; charset=utf-8']],
  ['/game.contract.json', ['../game.contract.json', 'application/json; charset=utf-8']],
]);
const port = Number(process.env.PORT ?? 4173);
const scores=createLeaderboard();

function json(response,status,data) {
  return response.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store'}).end(JSON.stringify(data));
}

async function scoreRequest(request,response) {
  const host=request.headers.host;
  const origin=request.headers.origin;
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host??'') || (origin && origin!=='http://'+host)) {
    return json(response,403,{error:'Yêu cầu phải đến từ máy cục bộ.'});
  }
  if (request.method==='GET') return json(response,200,await scores.read());
  if (request.method!=='POST') return json(response,405,{error:'Phương thức không hợp lệ.'});
  if (request.headers['content-type']?.split(';')[0]!=='application/json') {
    return json(response,415,{error:'Yêu cầu phải có định dạng JSON.'});
  }
  const chunks=[];
  let size=0;
  for await (const chunk of request) {
    size+=chunk.length;
    if (size>4096) return json(response,413,{error:'Dữ liệu quá lớn.'});
    chunks.push(chunk);
  }
  try {
    return json(response,200,await scores.add(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError) {
      return json(response,400,{error:'Bản ghi điểm không hợp lệ.'});
    }
    throw error;
  }
}

function launch() {
  const server=createServer(async (request,response)=>{
    const url=new URL(request.url,'http://localhost');
    if (url.pathname==='/api/leaderboard') {
      try {return await scoreRequest(request,response);}
      catch (error) {
        console.error(error.message);
        return json(response,500,{error:'Không thể mở bảng xếp hạng.'});
      }
    }
    const entry=files.get(url.pathname);
    if (!entry || !['GET','HEAD'].includes(request.method)) {
      response.writeHead(entry ? 405 : 404).end();
      return;
    }
    try {
      const [path,type]=entry;
      const data=await readFile(new URL(path,import.meta.url));
      response.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});
      response.end(request.method==='HEAD' ? undefined : data);
    } catch (error) {
      console.error(error.message);
      response.writeHead(500).end();
    }
  });
  server.listen(port,'127.0.0.1',()=>console.log('Đảo Đèn Lồng · http://127.0.0.1:'+server.address().port));
  return server;
}

try {
  const args=process.argv.slice(2);
  if (!args.length) launch();
  else if (args[0]==='--export-leaderboard' && args.length===2 && args[1]) {
    await writeFile(args[1],JSON.stringify(await scores.read(),null,2)+'\n');
  } else throw new Error('Dùng: node src/serve.mjs [--export-leaderboard <tệp.json>]');
} catch (error) {
  console.error(error.message);
  process.exitCode=1;
}
