import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, release, tmpdir } from 'node:os';
import { join } from 'node:path';
import { frameMetrics } from './bench-metrics.mjs';
import { parseOptions, readInteger } from './run-args.mjs';

const started=Date.now()-process.uptime()*1000;
const paths={
  win32:[join(process.env.ProgramFiles ?? 'C:/Program Files','Google/Chrome/Application/chrome.exe'),
    join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
    join(process.env.LOCALAPPDATA ?? homedir(),'Google/Chrome/Application/chrome.exe')],
  darwin:['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  linux:['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/microsoft-edge','/snap/bin/chromium'],
};
const modules=new Set(['bench-page.mjs','render.mjs','sim.mjs','maps.mjs']);
const page='<!doctype html><html lang="vi"><title>Đo hiệu năng Đảo Đèn Lồng</title>'+
  '<style>html,body{margin:0;overflow:hidden;background:#0e1430}canvas{position:absolute;inset:0;width:1280px;height:720px}</style>'+
  '<canvas id="world"></canvas><canvas id="effects"></canvas><script type="module" src="/bench-page.mjs"></script>';
let server,browser,profile;
try {
  const {seed,duration,out}=parseOptions(process.argv.slice(2),['seed','duration','out']);
  const seedNumber=readInteger(seed,'seed',Number.MIN_SAFE_INTEGER);
  const seconds=readInteger(duration,'duration',1,600);
  if (!out) throw new Error('Missing --out');
  const contract=JSON.parse(await readFile(new URL('../game.contract.json',import.meta.url),'utf8'));
  const vsyncOff=process.env.LANTERN_VSYNC!=='on';
  const executable=process.env.LANTERN_BROWSER ?? paths[process.platform]?.find(path=>existsSync(path));
  if (!executable) throw new Error('Chrome/Chromium/Edge not found. Set LANTERN_BROWSER to its executable.');
  profile=await mkdtemp(join(tmpdir(),'lantern-bench-'));

  const output=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Benchmark browser timed out')),(seconds+45)*1000);
    const finish=(error,value)=>{
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    server=createServer(async (req,res)=>{
      try {
        if (req.method==='POST' && req.url==='/report') {
          let raw='';
          for await (const chunk of req) raw+=chunk;
          const data=JSON.parse(raw);
          res.writeHead(204).end();
          if (data.error) return finish(new Error(data.error));
          if (!Array.isArray(data.viewport) || data.viewport[0]!==1280 || data.viewport[1]!==720) {
            return finish(new Error('Window viewport was '+data.viewport+' instead of 1280×720'));
          }
          const metrics=frameMetrics(data.times);
          return finish(null,{contract_version:contract.contract_version,...metrics,
            load_ms:Math.round(data.load),peak_mem_mb:null,vsync_off:vsyncOff,renderer:data.renderer,
            os:process.platform+' '+release()+' '+process.arch});
        }
        if (req.method!=='GET') return res.writeHead(405).end();
        if (req.url==='/') return res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(page);
        if (req.url==='/config') return res.writeHead(200,{'Content-Type':'application/json'}).end(
          JSON.stringify({seed:seedNumber,duration:seconds,started,tuning:contract.tuning}));
        const path=req.url.slice(1);
        if (!modules.has(path)) return res.writeHead(404).end();
        res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'}).end(
          await readFile(new URL(path,import.meta.url)));
      } catch (error) {
        if (!res.headersSent) res.writeHead(500);
        res.end();
        finish(error);
      }
    });
    server.on('error',finish);
    server.listen(0,'127.0.0.1',()=>{
      const url='http://127.0.0.1:'+server.address().port+'/';
      browser=spawn(executable,[
        '--user-data-dir='+profile,'--app='+url,'--no-first-run','--no-default-browser-check',
        '--window-position=0,0','--window-size=1280,720','--force-device-scale-factor=1',
        '--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding',
        ...(vsyncOff ? ['--disable-frame-rate-limit','--disable-gpu-vsync'] : []),
        '--enable-unsafe-swiftshader',
      ],{stdio:'ignore'});
      browser.on('error',finish);
      browser.on('exit',code=>finish(new Error('Benchmark browser exited: '+code)));
    });
  });
  await writeFile(out,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output));
} catch (error) {
  console.error(error.message);
  process.exitCode=1;
} finally {
  if (browser?.exitCode===null && browser.pid) browser.kill();
  server?.closeAllConnections();
  server?.close();
  if (profile) {
    try { await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:150}); }
    catch { console.error('Could not remove temporary benchmark profile: '+profile); }
  }
}
