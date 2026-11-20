import { readFile, writeFile } from 'node:fs/promises';
import { createGame, stepGame, IDLE, TICKS_PER_SECOND } from './sim.mjs';
import { parseOptions, readInteger } from './run-args.mjs';

function randomFrom(seed) {
  let bits=seed>>>0;
  return ()=>{
    bits=(Math.imul(bits,1664525)+1013904223)>>>0;
    return bits/4294967296;
  };
}

function runNight(game,random) {
  const limit=TICKS_PER_SECOND*game.startTime;
  const input={...IDLE,move:[0,0]};
  for (let i=0;i<limit && game.state==='playing';i++) {
    if (i%30===0) {
      const angle=random()*Math.PI*2;
      input.move[0]=Math.cos(angle);
      input.move[1]=Math.sin(angle);
    }
    input.jump=random()<.05;
    input.dash=random()<.03;
    input.pulse=random()<.02;
    input.interact=random()<.10;
    stepGame(game,input);
  }
  if (game.state!=='won' && game.state!=='lost') throw new Error('Night did not finish');
  return game.state;
}

try {
  const {seed,nights,out}=parseOptions(process.argv.slice(2),['seed','nights','out']);
  const base=readInteger(seed,'seed',Number.MIN_SAFE_INTEGER);
  const count=readInteger(nights,'nights',1,1000);
  if (!out) throw new Error('Missing --out');
  const {tuning}=JSON.parse(await readFile(new URL('../game.contract.json',import.meta.url),'utf8'));
  const start=performance.now();
  const results=[];
  let crashes=0;
  let memStart;
  for (let i=1;i<=count;i++) {
    try {
      const night=(i-1)%3+1;
      const nightSeed=base+i;
      const game=createGame(tuning,nightSeed,{},night);
      if (i===1) {
        global.gc?.();
        memStart=process.memoryUsage.rss()/1048576;
      }
      results.push(runNight(game,randomFrom(nightSeed)));
    } catch (error) {
      crashes++;
      console.error('Night '+i+': '+error.message);
    }
  }
  // The last simulation and its entities have left scope before sampling.
  global.gc?.();
  const output={nights:count,crashes,results,mem_start_mb:memStart,
    mem_end_mb:process.memoryUsage.rss()/1048576,duration_s:(performance.now()-start)/1000};
  await writeFile(out,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output));
  if (crashes || output.mem_end_mb>1.2*output.mem_start_mb) process.exitCode=1;
} catch (error) {
  console.error(error.message);
  process.exitCode=1;
}
