import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { after, test } from 'node:test';
import { frameMetrics } from '../src/bench-metrics.mjs';
import { normalizeName, timestampWithOffset, topScores, validEntry } from '../src/scores.mjs';
import { createLeaderboard } from '../src/leaderboard.mjs';
import { actionAtKey, bindingConflict, defaultBindings, parseSettings } from '../src/settings.mjs';
import { createBenchmarkScene, stepBenchmarkScene } from '../src/sim.mjs';

const root=new URL('../',import.meta.url);
const contract=JSON.parse(await readFile(new URL('game.contract.json',root),'utf8'));
const temp=await mkdtemp(join(tmpdir(),'lantern-release-test-'));
after(()=>rm(temp,{recursive:true,force:true}));
const entry=(name,score,achieved_at='2026-11-20T15:00:00+07:00')=>({
  name,score,nights_won:score ? 2 : 0,achieved_at,seed:1201,
});

test('benchmark metrics use all means, the slowest ceil(1%) and nearest-rank p95',()=>{
  const samples=[...Array(99).fill(10),50,100];
  const m=frameMetrics(samples);
  assert.equal(m.frames,101);
  assert.equal(m.avg_fps,101000/1140);
  assert.equal(m.p1_low_fps,2000/150);
  assert.equal(m.frame_ms_p95,10);
  assert.deepEqual(frameMetrics([20]),{avg_fps:50,p1_low_fps:50,frame_ms_p95:20,frames:1});
  assert.throws(()=>frameMetrics([]));
  assert.throws(()=>frameMetrics([0,16]));
});

test('measured benchmark artifact has the contract schema and a stable 200-shade scene',async()=>{
  const result=JSON.parse(await readFile(new URL('bench.json',root),'utf8'));
  assert.deepEqual(Object.keys(result).sort(),[
    'avg_fps','contract_version','frame_ms_p95','frames','load_ms','os','p1_low_fps','peak_mem_mb','renderer','vsync_off',
  ]);
  assert.equal(result.contract_version,'1.3');
  assert.equal(typeof result.vsync_off,'boolean');
  assert.equal(result.peak_mem_mb,null);
  for (const key of ['avg_fps','frame_ms_p95','frames','load_ms','p1_low_fps']) assert.ok(result[key]>0);
  assert.ok(Number.isInteger(result.frames));
  assert.equal(typeof result.renderer,'string');
  assert.equal(typeof result.os,'string');
  const game=createBenchmarkScene(contract.tuning,42);
  const same=createBenchmarkScene(contract.tuning,42);
  assert.deepEqual(game.shades,same.shades);
  assert.equal(game.shades.length,200);
  assert.equal(game.motes.length,100);
  assert.deepEqual(game.lanterns.filter(l=>l.lit).map(l=>[l.id,l.fuelUnits]),[['L1',6000],['L2',6000],['L3',6000]]);
  const before=JSON.stringify(game.shades.map(s=>s.pos));
  for (let i=0;i<300;i++) stepBenchmarkScene(game);
  assert.equal(game.shades.length,200);
  assert.ok(game.shades.every(s=>s.state==='wander'));
  assert.notEqual(JSON.stringify(game.shades.map(s=>s.pos)),before);
  assert.deepEqual(game.player.pos,[0,0,0]);
  assert.equal(game.motes.length,100);
  assert.deepEqual(game.lanterns.filter(l=>l.lit).map(l=>l.fuelUnits),[6000,6000,6000]);
});

test('soak CLI completes ten Nights in one process within the memory threshold',async()=>{
  const out=join(temp,'soak.json');
  const run=spawnSync(process.execPath,['--expose-gc','src/soak.mjs','--seed','7','--nights','10','--out',out],
    {cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr+' '+run.stdout);
  const json=JSON.parse(await readFile(out,'utf8'));
  assert.deepEqual(Object.keys(json).sort(),['crashes','duration_s','mem_end_mb','mem_start_mb','nights','results']);
  assert.equal(json.nights,10);
  assert.equal(json.crashes,0);
  assert.equal(json.results.length,10);
  assert.ok(json.results.every(result=>['won','lost'].includes(result)));
  assert.ok(json.mem_start_mb>0 && json.mem_end_mb<=1.2*json.mem_start_mb && json.duration_s>0);
});

test('score validation, stable instant ties, top ten and exact offset timestamps',()=>{
  assert.equal(normalizeName('Mâỵ'), 'Mâỵ'.normalize('NFC'));
  for (const invalid of ['a','1234567890123','a b','🥝abc','<img>',null]) assert.equal(normalizeName(invalid),null);
  assert.ok(!validEntry({...entry('Mây',0),name:null}));
  assert.ok(!validEntry(entry('Mây',1,'2026-11-20T12:10:00Z')));
  const time=timestampWithOffset(new Date('2026-11-20T08:00:00.000Z'));
  assert.match(time,/[+-]\d\d:\d\d$/);
  assert.equal(Date.parse(time),Date.parse('2026-11-20T08:00:00Z'));
  const entries=[entry('same1',50),entry('first',50,'2026-11-20T07:59:00+00:00'),
    entry('same2',50,'2026-11-20T08:00:00+00:00'),entry('high',65),
    ...Array.from({length:12},(_,i)=>entry('low'+i,i))];
  assert.deepEqual(topScores(entries).slice(0,4).map(x=>x.name),['high','first','same1','same2']);
  assert.equal(topScores(entries).length,10);
});

test('HTTP leaderboard survives server restart and CLI exports the same rankings',async t=>{
  const path=join(temp,'persistent.json');
  const env={...process.env,LANTERN_LEADERBOARD:path,PORT:'0'};
  async function start() {
    const child=spawn(process.execPath,['src/serve.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
    const closed=once(child,'exit');
    const close=async()=>{if(child.exitCode===null && child.signalCode===null) child.kill(); await closed;};
    t.after(close);
    const reader=createInterface({input:child.stdout});
    try {
      const [line]=await Promise.race([once(reader,'line'),closed.then(()=>{throw new Error('Server exited');})]);
      const url=line.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      assert.ok(url,line);
      return {url:url+'/api/leaderboard',close};
    } finally {reader.close();}
  }
  const first=await start();
  async function post(value) {
    return fetch(first.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
  }
  assert.equal((await post(entry('aa',9))).status,400);
  assert.equal((await post(entry('Mây',11))).status,200);
  assert.equal((await post(entry('Cau',22))).status,200);
  await first.close();
  const second=await start();
  const expected={entries:[entry('Cau',22),entry('Mây',11)]};
  assert.deepEqual(await (await fetch(second.url)).json(),expected);
  const out=join(temp,'export.json');
  const exported=spawnSync(process.execPath,['src/serve.mjs','--export-leaderboard',out],
    {cwd:root,env:{...env,PORT:new URL(second.url).port},encoding:'utf8'});
  assert.equal(exported.status,0,exported.stderr);
  assert.deepEqual(JSON.parse(await readFile(out,'utf8')),expected);
  assert.deepEqual(await createLeaderboard(path).read(),expected);
});

test('rebinding rejects collisions including aliases and keeps accessibility across reloads',()=>{
  const settings=parseSettings(JSON.stringify({reducedMotion:true,largeText:true,colorblind:true,
    bindings:{...defaultBindings,jump:'KeyJ',pause:'KeyO'}}));
  assert.equal(settings.reducedMotion,true);
  assert.equal(settings.largeText,true);
  assert.equal(settings.colorblind,true);
  assert.equal(actionAtKey(settings.bindings,'KeyJ'),'jump');
  assert.equal(actionAtKey(settings.bindings,'Escape'),undefined);
  assert.equal(actionAtKey(settings.bindings,'KeyP'),undefined);
  assert.equal(bindingConflict(settings.bindings,'pulse','KeyJ'),'jump');
  assert.equal(bindingConflict(settings.bindings,'pulse','ArrowUp'),'up');
  assert.deepEqual(parseSettings(JSON.stringify(settings)),settings);
  assert.deepEqual(parseSettings(JSON.stringify({...settings,bindings:defaultBindings})).bindings,defaultBindings);
  assert.deepEqual(parseSettings(JSON.stringify({bindings:{jump:'KeyW'}})).bindings,defaultBindings);
});
