import { createGame, IDLE, nearestUnlit, stepGame, timeLeft, TICKS_PER_SECOND } from './sim.mjs';
import { createRenderer } from './render.mjs';
import { createAudio } from './audio.mjs';

const $=id=>document.getElementById(id);
const text=(id,value)=>{ const el=$(id); if (el.textContent!==value) el.textContent=value; };
const chapters=[
  ['Đảo Bến','Mây à, hãy nhặt đom đóm theo những lối cát. Khi đèn sáng, ánh vàng sẽ che chở cháu khỏi Bóng Mực.'],
  ['Đảo Cau','Qua cầu tre hoặc bước lên bệ nhảy để sang đảo bên. Gió Lạc thích ánh sáng, còn Bùa Gió sẽ giúp cháu Lướt liên tiếp.'],
  ['Đảo Chuông','Theo hai dốc cát lên tầng giữa, rồi dùng bệ nhảy lên tháp chuông. Khi lá bay, hãy coi chừng gió mạnh bên mép đảo.'],
];
const screenIds={menu:'intro',intro:'night-intro',pause:'pause',settings:'settings',result:'end'};
const focusIds={menu:'start',intro:'enter-night',pause:'resume',settings:'volume',result:'result-action'};
const keys=new Set(), queued=new Set();
const actions=new Map([['Space','jump'],['KeyE','interact'],['KeyF','pulse'],['ShiftLeft','dash'],['ShiftRight','dash']]);
const control=new Set([...actions.keys(),'KeyW','KeyA','KeyS','KeyD','KeyQ','KeyR',
  'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape','KeyP']);
const audio=createAudio();
const map=$('map').getContext('2d');
const scoreFormat=new Intl.NumberFormat('vi-VN');
const STEP=1000/TICKS_PER_SECOND;
const defaults={volume:60,sensitivity:100};
const seed=1201;
let tuning, render, game, preview;
let screen='menu', settingsReturn='menu', night=1, total=0;
let yaw=0, heading=0, focus=[0,0,0], logicalPause=false, dragging=false;
let lastFrame, accumulated=0, pulse, feedback, resultReason, lastMap=0;
let lastSecond=Infinity, warned=false, perfStart, perfFrames=0;
let preferences={...defaults};
try {
  const saved=JSON.parse(localStorage.getItem('dao-den-long-settings') ?? '{}');
  for (const key in defaults) if (Number.isFinite(saved?.[key])) preferences[key]=saved[key];
} catch { /* Storage can be disabled. */ }

function display(next) {
  screen=next;
  for (const [key,id] of Object.entries(screenIds)) $(id).hidden=key!==screen;
  const sceneIsLive=screen==='playing' || screen==='pause' || screen==='result' ||
    (screen==='settings' && settingsReturn==='pause');
  document.body.classList.toggle('playing',sceneIsLive);
  for (const id of ['stats','navigation','inventory','cooldowns']) $(id).hidden=!sceneIsLive;
  $('hint').hidden=screen!=='playing';
  if (focusIds[screen]) $(focusIds[screen]).focus();
  else document.activeElement?.blur();
}

function intro(next) {
  night=next;
  text('night-number','ĐÊM '+night);
  text('night-title',chapters[night-1][0]);
  text('dialogue',chapters[night-1][1]);
  text('chapter','Đêm '+night+' · '+chapters[night-1][0]);
  display('intro');
}

function begin() {
  audio.unlock();
  game=createGame(tuning,seed,{},night);
  yaw=heading=0;
  focus=[...game.player.pos];
  keys.clear();
  queued.clear();
  pulse=feedback=resultReason=undefined;
  logicalPause=false;
  accumulated=lastMap=0;
  lastSecond=Infinity;
  warned=false;
  text('map-name',chapters[night-1][0]);
  display('playing');
  updateHud(performance.now());
  drawMap();
}

function home() {
  keys.clear();
  queued.clear();
  total=0;
  text('chapter','Ba hòn đảo');
  display('menu');
}

function endGame() {
  const win=game.state==='won';
  if (win) total+=game.score;
  const complete=win && night===3;
  text('result-night','ĐÊM '+night+' · '+chapters[night-1][0]);
  text('outcome',complete ? 'Bình Minh' : win ? 'Đảo đã sáng đèn!' : 'Đêm chưa tan');
  text('summary',complete ? 'Cả ba hòn đảo đã rực sáng. Bình minh lên trên biển mây.' :
    win ? 'Mây đã thắp lại tất cả Đèn Lồng Lớn trên '+chapters[night-1][0]+'.' :
    resultReason==='dawn' ? 'Bình minh đến khi trên đảo vẫn còn đèn chưa thắp.' : 'Mây đã mất hết Ngọn Lửa.');
  text('final-score',(complete ? 'Tổng điểm · ' : 'Điểm đêm này · ')+scoreFormat.format(complete ? total : game.score));
  text('result-action',complete ? 'Về menu chính' : win ? 'Sang đêm tiếp theo' : 'Thử lại đêm này');
  display('result');
}

function drawMap() {
  const centers=game.map.islands;
  const scale=centers.length===2 ? 1.73 : 2.48;
  const center=centers.length===2 ? 35 : 0;
  const point=([x,,z])=>[128+(x-center)*scale,128-z*scale];
  map.clearRect(0,0,256,256);
  if (night===2) {
    const [x,y]=point([26,0,2]);
    map.fillStyle='#9c7951';
    map.fillRect(x,y,18*scale,4*scale);
  }
  for (const [x,r] of centers) {
    const [px,py]=point([x,0,0]);
    map.beginPath();
    map.arc(px,py,r*scale,0,Math.PI*2);
    map.fillStyle='#2f5d50';
    map.fill();
    map.strokeStyle='#7c9b96';
    map.stroke();
  }
  for (const item of game.motes) {
    const [x,y]=point(item.pos);
    map.fillStyle='#f5ecca78';
    map.fillRect(x-1,y-1,2,2);
  }
  for (const l of game.lanterns) {
    const [x,y]=point(l.pos);
    map.beginPath();
    map.arc(x,y,5.6,0,Math.PI*2);
    map.fillStyle=l.lit ? '#f2c14e' : '#262841';
    map.fill();
    map.strokeStyle='#f2c14e';
    map.lineWidth=2;
    map.stroke();
  }
  const [x,y]=point(game.player.pos);
  map.save();
  map.translate(x,y);
  map.rotate(heading);
  map.beginPath();
  map.moveTo(0,-9); map.lineTo(5,5); map.lineTo(0,3); map.lineTo(-5,5);
  map.closePath();
  map.fillStyle='#f5f1e6';
  map.fill();
  map.restore();
}

function updateHud(now) {
  const p=game.player;
  const flameRow=$('flames');
  const health=p.flames+' trên '+tuning.flames+' Ngọn Lửa';
  if (flameRow.getAttribute('aria-label')!==health) {
    flameRow.setAttribute('aria-label',health);
    flameRow.replaceChildren(...Array.from({length:tuning.flames},(_,i)=>{
      const el=document.createElement('i');
      el.classList.toggle('empty',i>=p.flames);
      el.setAttribute('aria-hidden','true');
      return el;
    }));
  }
  const g=game.sim_tick;
  const seconds=Math.ceil(timeLeft(game));
  text('clock',Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'));
  $('clock').classList.toggle('danger',seconds<=30);
  text('lanterns',game.lanterns.filter(l=>l.lit).length+' / '+game.lanterns.length);
  text('score',scoreFormat.format(game.score));
  text('inventory-label','Đom đóm · '+p.carried+' / '+tuning.carry_capacity);
  [...$('mote-bar').children].forEach((cell,i)=>cell.classList.toggle('filled',i<p.carried));
  const cd=(end)=>end>g ? ((end-g)/60).toFixed(1).replace('.',',')+' s' : 'Sẵn sàng';
  text('dash-cd','⬗ Lướt · '+cd(g<p.charmUntil ? g : p.dashReadyAt));
  text('pulse-cd','✦ Tỏa Sáng · '+cd(p.pulseReadyAt));
  if (now-lastMap>70) { drawMap(); lastMap=now; }
  const lamp=nearestUnlit(game);
  const message=p.respawnAt ? 'Mây đang trở về điểm xuất phát…' : lamp ?
    'E — Nạp ánh sáng ('+lamp.deposited+'/'+tuning.lantern_cost+')' :
    game.windWarn ? 'Gió mạnh sắp tới. Hãy tránh mép đảo!' :
    feedback && now<feedback.until ? feedback.message :
    g<p.charmUntil ? 'Bùa Gió · Lướt không chờ hồi chiêu' : 'Tìm đom đóm và theo ánh đèn trên bản đồ.';
  text('hint',message);
  if (seconds!==lastSecond && seconds>0 && seconds<=10) audio.play('countdown');
  lastSecond=seconds;
}

function controls() {
  const active=(a,b)=>Number(keys.has(a)||keys.has(b));
  const input={...IDLE};
  input.move=[active('KeyD','ArrowRight')-active('KeyA','ArrowLeft'),active('KeyW','ArrowUp')-active('KeyS','ArrowDown')];
  if (screen==='playing') yaw+=(Number(keys.has('KeyR'))-Number(keys.has('KeyQ')))*.024;
  input.cam_yaw_deg=yaw*180/Math.PI;
  for (const [key,action] of actions) input[action] ||= keys.has(key)||queued.has(action);
  input.pause=logicalPause;
  logicalPause=false;
  queued.clear();
  return input;
}

const notifications={
  lantern_lit:'Đèn đã sáng. Mây có thể trú trong vùng ánh vàng.',
  player_hit:'Mây đã mất một Ngọn Lửa.',
  charm_picked:'Mây nhận được Bùa Gió!',
  drifter_steal:'Gió Lạc đã lấy đom đóm!',
  drifter_drop:'Gió Lạc đã đánh rơi đom đóm.',
};

function consume(input,now) {
  const jumping=input.jump && !game.previous.jump && game.player.grounded;
  for (const e of stepGame(game,input)) {
    audio.play(e.name);
    if (notifications[e.name]) feedback={until:now+1700,message:notifications[e.name]};
    if (e.name==='pulse') pulse={at:now,pos:[...game.player.pos]};
    if (e.name==='paused') { keys.clear(); display('pause'); }
    if (e.name==='resumed') display('playing');
    if (e.name==='game_over') {
      resultReason=e.data.reason;
      audio.play(e.data.result);
    }
  }
  if (jumping && !game.player.grounded) audio.play('jump');
}

function animate(now) {
  const elapsed=Math.min(150,now-(lastFrame??now));
  lastFrame=now;
  if (screen==='playing' || screen==='pause') {
    accumulated+=elapsed;
    while (accumulated>=STEP && (game.state==='playing' || game.state==='paused')) {
      accumulated-=STEP;
      consume(controls(),now);
    }
    if (screen==='playing') {
      const p=game.player;
      heading=Math.atan2(p.facing[0],p.facing[1]);
      const follow=1-Math.exp(-elapsed/80);
      focus=focus.map((v,i)=>v+((i===1 ? Math.max(-2,p.pos[i]) : p.pos[i])-v)*follow);
      updateHud(now);
      if (game.windWarn && !warned) audio.play('wind');
      warned=game.windWarn;
      if (game.state==='won' || game.state==='lost') endGame();
    }
  } else accumulated=0;

  audio.music(screen==='playing',night);
  const live=document.body.classList.contains('playing');
  const walking=live && Math.hypot(game.player.vel[0],game.player.vel[2])>.1 && game.player.grounded;
  render(live ? game : preview,{
    intro:!live, yaw:live ? yaw : 2.82+Math.sin(now*.00015)*.14,
    heading:live ? heading : 2, focus:live ? focus : [0,0,11], pulse, walking,
  },now);
  if (screen==='playing') {
    perfStart??=now;
    perfFrames++;
    if (now-perfStart>=5000) {
      document.body.dataset.fps=(1000*(perfFrames-1)/(now-perfStart)).toFixed(1);
      document.body.dataset.measuredViewport=window.innerWidth+'×'+window.innerHeight;
      perfStart=now;
      perfFrames=1;
    }
  } else { perfStart=undefined; perfFrames=0; }
  requestAnimationFrame(animate);
}

function settings(from) {
  settingsReturn=from;
  audio.unlock();
  display('settings');
}

for (const id of ['volume','sensitivity']) {
  const input=$(id);
  input.value=String(preferences[id]);
  function sync() {
    preferences[id]=Number(input.value);
    text(id+'-value',input.value+' %');
    audio.volume(preferences.volume/100);
  }
  sync();
  input.addEventListener('input',()=>{
    sync();
    try { localStorage.setItem('dao-den-long-settings',JSON.stringify(preferences)); } catch { /* Private mode. */ }
  });
}
function pauseToggle() { logicalPause=true; }
$('start').onclick=()=>{ audio.unlock(); total=0; intro(1); };
$('enter-night').onclick=begin;
$('resume').onclick=pauseToggle;
$('retry').onclick=begin;
$('pause-home').onclick=home;
$('result-home').onclick=home;
$('result-action').onclick=()=>game.state==='lost' ? begin() : night<3 ? intro(night+1) : home();
$('menu-settings').onclick=()=>settings('menu');
$('pause-settings').onclick=()=>settings('pause');
$('close-settings').onclick=()=>display(settingsReturn);

window.addEventListener('keydown',e=>{
  if (!control.has(e.code)) return;
  if (e.code==='Escape' && screen==='settings') { display(settingsReturn); return; }
  if (screen!=='playing' && screen!=='pause') return;
  const isPause=e.code==='Escape'||e.code==='KeyP';
  if (screen==='pause' && !isPause) return;
  e.preventDefault();
  if (isPause && !e.repeat) pauseToggle();
  if (actions.has(e.code) && !e.repeat) queued.add(actions.get(e.code));
  keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{ keys.clear(); queued.clear(); dragging=false; });
window.addEventListener('pointerdown',e=>{ if (screen==='playing' && e.target===$('world')) dragging=true; });
window.addEventListener('pointerup',()=>{ dragging=false; });
window.addEventListener('pointermove',e=>{ if (dragging && screen==='playing') yaw-=e.movementX*.004*preferences.sensitivity/100; });

try {
  const response=await fetch('/game.contract.json');
  if (!response.ok) throw new Error('Cannot read game contract');
  ({tuning}=await response.json());
  const template=createGame(tuning,seed);
  preview={...template,player:{...template.player,pos:[4,0,28]},lanterns:template.lanterns.map((l,i)=>({...l,lit:i===0}))};
  $('mote-bar').replaceChildren(...Array.from({length:tuning.carry_capacity},()=>document.createElement('i')));
  render=createRenderer($('world'),$('effects'),template);
  $('start').disabled=false;
  requestAnimationFrame(animate);
} catch (error) {
  console.error(error);
  text('error','Không thể mở cảnh 3D. Hãy dùng trình duyệt có bật WebGL.');
  $('error').hidden=false;
}
