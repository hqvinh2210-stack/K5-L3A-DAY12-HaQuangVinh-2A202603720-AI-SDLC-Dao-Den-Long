const sequences = {
  mote_picked:[784,1047], lantern_lit:[392,523,659,784], pulse:[392,262,196],
  player_hit:[185,139], jump:[294,440], dash:[220,330,660], won:[523,659,784,1047],
  lost:[440,349,262], shade_spawned:[147,123], countdown:[660], wind:[196,246,329],
  charm_picked:[523,784,1047], drifter_steal:[392,349,247],
};
const melody=[262,329,392,523,440,392,329,294,220,262,329,440,392,329,294,196];

export function createAudio() {
  let ctx;
  let master;
  let volume=.6;
  let songTick=0;
  let next=0;

  function tone(frequency, at, duration, strength, wave='sine') {
    const oscillator=ctx.createOscillator();
    const gain=ctx.createGain();
    oscillator.type=wave;
    oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(0.0001,at);
    gain.gain.exponentialRampToValueAtTime(strength,at+.035);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at+duration+.01);
  }

  return {
    async unlock() {
      const Audio=window.AudioContext ?? window.webkitAudioContext;
      if (!Audio) return;
      if (!ctx) {
        ctx=new Audio();
        master=ctx.createGain();
        master.gain.value=volume;
        master.connect(ctx.destination);
      }
      if (ctx.state==='suspended') {
        try { await ctx.resume(); } catch { /* Browser rejected playback. */ }
      }
    },
    volume(value) {
      volume=value;
      if (ctx) master.gain.setTargetAtTime(value,ctx.currentTime,.025);
    },
    music(playing, night) {
      if (ctx?.state!=='running' || !playing) return;
      const now=ctx.currentTime;
      if (now<next) return;
      const n=melody[songTick%melody.length]*(night===2 ? .89 : night===3 ? .75 : 1);
      tone(n,now,.64,.054);
      if (songTick++%4===0) tone(n/2,now,1.72,.045,'triangle');
      next=now+.52;
    },
    play(name) {
      if (ctx?.state!=='running' || !sequences[name]) return;
      sequences[name].forEach((n,i)=>tone(n,ctx.currentTime+i*.064,name==='won'?.49:.23,.115,
        name==='player_hit' || name==='wind' ? 'triangle' : 'sine'));
    },
  };
}
