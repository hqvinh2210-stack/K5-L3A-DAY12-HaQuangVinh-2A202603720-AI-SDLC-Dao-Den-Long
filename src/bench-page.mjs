import { createRenderer } from './render.mjs';
import { createBenchmarkScene, stepBenchmarkScene, TICKS_PER_SECOND } from './sim.mjs';

async function report(value) {
  await fetch('/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
}

try {
  const {seed,duration,started,tuning}=await (await fetch('/config')).json();
  const game=createBenchmarkScene(tuning,seed);
  const render=createRenderer(document.querySelector('#world'),document.querySelector('#effects'),game);
  if (innerWidth!==1280 || innerHeight!==720) {
    // In headed Chromium the title bar may count toward --window-size.
    window.resizeTo(1280+outerWidth-innerWidth,720+outerHeight-innerHeight);
  }
  const gl=document.querySelector('#world').getContext('webgl');
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  const driver=gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  const renderer='Lantern Island WebGL 1.0 · '+driver;
  const warmup=3000;
  const end=warmup+duration*1000;
  const times=[];
  let initial,previous=0,load;

  function frame() {
    try {
      const now=performance.now();
      const elapsed=initial===undefined ? 0 : now-initial;

      // Include frames that complete inside the measured interval only.
      if (elapsed>=end) {
        report({times,load,renderer,viewport:[innerWidth,innerHeight]});
        return;
      }
      const target=Math.floor(elapsed*TICKS_PER_SECOND/1000);
      while (game.sim_tick<target) stepBenchmarkScene(game);
      const orbit=elapsed*Math.PI*2/15000;
      const eye=[30*Math.cos(orbit),15,30*Math.sin(orbit)];
      render(game,{eye,focus:[0,0,0],heading:0,benchmark:true},elapsed);
      if (initial===undefined) {
        initial=now;
        load=performance.timeOrigin+performance.now()-started;
      } else if (previous>=warmup && elapsed>previous) {
        times.push(elapsed-previous);
      }
      previous=elapsed;
      requestAnimationFrame(frame);
    } catch (error) {
      report({error:error.message});
    }
  }
  requestAnimationFrame(frame);
} catch (error) {
  await report({error:error.message});
}
