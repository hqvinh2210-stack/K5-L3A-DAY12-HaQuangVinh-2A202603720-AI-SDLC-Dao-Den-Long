import { createGame, fuelOf, IDLE, lightCost, nearestUsableLantern, requiredLights, stepGame, timeLeft, TICKS_PER_SECOND } from './sim.mjs';
import { createRenderer } from './render.mjs';
import { createAudio } from './audio.mjs';
import { scoreUI } from './leaderboard-ui.mjs';
import { actionAtKey, actionLabels, bindingConflict, defaultBindings, keyLabel, parseSettings, reservedKeys } from './settings.mjs';

const $=id=>document.getElementById(id);
const text=(id,value)=>{ const el=$(id); if (el.textContent!==value) el.textContent=value; };
const chapters=[
  ['Đảo Bến','Mây à, hãy giữ ít nhất ba đèn sáng tới bình minh. Châm dầu trước khi đèn yếu để Bóng Mực không vào được vùng sáng.'],
  ['Đảo Cau','Qua cầu tre hoặc bước lên bệ nhảy để sang đảo bên. Gió Lạc thích ánh sáng, còn Bùa Gió sẽ giúp cháu Lướt liên tiếp.'],
  ['Đảo Chuông','Theo hai dốc cát lên tầng giữa, rồi dùng bệ nhảy lên tháp chuông. Khi lá bay, hãy coi chừng gió mạnh bên mép đảo.'],
];
const screenIds={menu:'intro',intro:'night-intro',pause:'pause',settings:'settings',result:'end',leaderboard:'leaderboard'};
const focusIds={menu:'start',intro:'enter-night',pause:'resume',settings:'volume',result:'result-action',leaderboard:'close-leaderboard'};
const keys=new Set(), queued=new Set();
const instantActions=new Set(['jump','dash','interact','pulse']);
const audio=createAudio();
const scores=scoreUI();
const nameInput=$('player-name');
const cleanName=value=>value.trim().normalize('NFC').slice(0,24);
let playerName='';
try { nameInput.value=cleanName(localStorage.getItem('dao-den-long-player') ?? ''); } catch { /* Storage can be disabled. */ }
const map=$('map').getContext('2d');
const scoreFormat=new Intl.NumberFormat('vi-VN');
const STEP=1000/TICKS_PER_SECOND;
const seed=1201;
let tuning, render, game, preview;
let screen='menu', settingsReturn='menu', night=1, total=0, nightsWon=0;
let practice=false, impact;
let yaw=0, heading=0, focus=[0,0,0], logicalPause=false, dragging=false;
let lastFrame, accumulated=0, pulse, feedback, resultReason, lastMap=0;
let lastSecond=Infinity, warned=false, perfStart, perfFrames=0, spawnNotices=[], captureBinding;
let preferences=parseSettings(null);
try { preferences=parseSettings(localStorage.getItem('dao-den-long-settings')); }
catch { /* Storage can be disabled. */ }

function display(next) {
  screen=next;
  if (next!=='settings') captureBinding=undefined;
  for (const [key,id] of Object.entries(screenIds)) $(id).hidden=key!==screen;
  const sceneIsLive=screen==='playing' || screen==='pause' || screen==='result' ||
    (screen==='settings' && settingsReturn==='pause');
  document.body.classList.toggle('playing',sceneIsLive);
  for (const id of ['stats','navigation','inventory','cooldowns']) $(id).hidden=!sceneIsLive;
  $('hint').hidden=screen!=='playing';
  $('captions').hidden=true;
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
  impact=undefined;
  spawnNotices=[];
  logicalPause=false;
  accumulated=lastMap=0;
  lastSecond=Infinity;
  warned=false;
  text('map-name',chapters[night-1][0]);
  display('playing');
  audio.music(true,night);
  updateHud(performance.now());
  drawMap();
}

function home() {
  keys.clear();
  queued.clear();
  total=0;
  nightsWon=0;
  text('chapter','Ba hòn đảo');
  display('menu');
}

function endGame() {
  const win=game.state==='won';
  if (win) { total+=game.score; nightsWon++; }
  const complete=win && night===3 && !practice;
  text('result-night','ĐÊM '+night+' · '+chapters[night-1][0]);
  text('outcome',complete ? 'Bình Minh' : win ? 'Vượt qua đêm tối!' : 'Đêm chưa tan');
  const lit=game.lanterns.filter(l=>l.lit).length;
  const dawnProgress=lit+'/'+game.lanterns.length+' đèn còn sáng khi bình minh đến.';
  text('summary',complete ? 'Mây đã giữ sáng cả ba hòn đảo đến bình minh.' :
    win ? dawnProgress : resultReason==='dawn' ? dawnProgress+' Cần ít nhất '+requiredLights(game)+' đèn.' :
    'Mây đã mất hết Ngọn Lửa.');
  text('result-player','Người chơi · '+playerName);
  text('final-score',(complete ? 'Tổng điểm · ' : 'Điểm đêm này · ')+scoreFormat.format(complete ? total : game.score));
  text('result-action',practice ? 'Chơi lại đêm này' :
    complete ? 'Về menu chính' : win ? 'Sang đêm tiếp theo' : 'Thử lại đêm này');
  scores.offer(!practice && (complete || !win) ? {score:total,nights_won:nightsWon,seed} : null,playerName);
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
  text('clock',(preferences.colorblind && seconds<=30 ? '⚠ ' : '')+
    Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'));
  $('clock').classList.toggle('danger',seconds<=30);
  text('lanterns',game.lanterns.filter(l=>l.lit).length+' / '+game.lanterns.length+' · cần '+requiredLights(game));
  text('score',scoreFormat.format(game.score));
  text('inventory-label','Đom đóm · '+p.carried+' / '+p.capacity);
  [...$('mote-bar').children].forEach((cell,i)=>{
    cell.hidden=i>=p.capacity;
    cell.classList.toggle('filled',i<p.carried);
  });
  const cd=(end)=>end>g ? ((end-g)/60).toFixed(1).replace('.',',')+' s' : 'Sẵn sàng';
  text('dash-cd','⬗ Lướt · '+cd(g<p.charmUntil ? g : p.dashReadyAt));
  text('pulse-cd','✦ Tỏa Sáng · '+cd(p.pulseReadyAt));
  if (now-lastMap>70) { drawMap(); lastMap=now; }
  const lamp=nearestUsableLantern(game);
  const interactKey=keyLabel(preferences.bindings.interact);
  const message=p.respawnAt ? 'Mây đang trở về điểm xuất phát…' : lamp ?
    lamp.lit ? interactKey+' — Châm dầu ('+Math.floor(fuelOf(lamp))+'/'+tuning.fuel_max+')' :
      interactKey+' — '+(lamp.ever_lit ? 'Thắp lại' : 'Nạp ánh sáng')+' ('+lamp.deposited+'/'+lightCost(tuning,lamp)+')' :
    feedback && now<feedback.until ? feedback.message :
    g<p.charmUntil ? 'Bùa Gió · Lướt không chờ hồi chiêu' : 'Tìm đom đóm và theo ánh đèn trên bản đồ.';
  text('hint',message);
  const low=game.lanterns.filter(l=>l.lit && fuelOf(l)<tuning.low_fuel_threshold).length;
  const captions=[];
  spawnNotices=spawnNotices.filter(notice=>g<notice.until);
  if (spawnNotices.length) captions.push(spawnNotices.length+' Bóng Mực xuất hiện!');
  if (game.windWarn) captions.push('Gió mạnh sắp tới!');
  if (seconds>0 && seconds<=10) captions.push('Bình minh sau '+seconds+' giây.');
  if (low) captions.push((preferences.colorblind ? '⚠ ' : '')+low+' đèn sắp cạn dầu.');
  $('captions').hidden=!captions.length;
  text('captions',captions.join(' · '));
  if (seconds!==lastSecond && seconds>0 && seconds<=10) audio.play('countdown');
  lastSecond=seconds;
}

function controls() {
  const pressed=new Set([...keys].map(code=>actionAtKey(preferences.bindings,code)));
  const active=action=>Number(pressed.has(action));
  const input={...IDLE};
  input.move=[active('right')-active('left'),active('up')-active('down')];
  if (screen==='playing') yaw+=(Number(keys.has('KeyR'))-Number(keys.has('KeyQ')))*.024;
  input.cam_yaw_deg=yaw*180/Math.PI;
  for (const action of instantActions) input[action]=pressed.has(action)||queued.has(action);
  input.pause=logicalPause;
  logicalPause=false;
  queued.clear();
  return input;
}

const notifications={
  lantern_lit:'Đèn đã sáng. Mây có thể trú trong vùng ánh vàng.',
  refuel:'Đã châm dầu cho đèn.',
  lantern_out:'Một đèn đã cạn dầu. Cần 5 đom đóm để thắp lại.',
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
    if (e.name==='shade_spawned') spawnNotices.push({id:e.data.id,until:game.sim_tick+5*TICKS_PER_SECOND});
    if (e.name==='pulse') pulse={at:now,pos:[...game.player.pos]};
    if (e.name==='player_hit' && e.data.by==='shade') impact={tick:game.sim_tick,pos:[...game.player.pos]};
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
    intro:!live, yaw:live ? yaw : 2.82+(preferences.reducedMotion ? 0 : Math.sin(now*.00015)*.14),
    heading:live ? heading : 2, focus:live ? focus : [0,0,11], pulse, walking,
    playerLabel:live ? playerName : '',
    colorblind:preferences.colorblind,
    reducedMotion:preferences.reducedMotion,
    impact:live && impact ? {...impact,age:game.sim_tick-impact.tick} : undefined,
    largeText:preferences.largeText,
    spawnPositions:live ? spawnNotices.flatMap(({id})=>{
      const shade=game.shades.find(item=>item.id===id);
      return shade ? [shade.pos] : [];
    }) : [],
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

function saveSettings() {
  try { localStorage.setItem('dao-den-long-settings',JSON.stringify(preferences)); } catch { /* Storage can be disabled. */ }
}

for (const [id,property] of [['colorblind','colorblind'],['reduced-motion','reducedMotion'],['large-text','largeText']]) {
  const checkbox=$(id);
  checkbox.checked=preferences[property];
  document.body.classList.toggle(id,checkbox.checked);
  checkbox.addEventListener('change',()=>{
    preferences[property]=checkbox.checked;
    document.body.classList.toggle(id,checkbox.checked);
    saveSettings();
  });
}

const bindingButtons=new Map();
for (const [action,label] of Object.entries(actionLabels)) {
  const item=document.createElement('button');
  item.type='button';
  item.className='secondary';
  item.onclick=()=>{
    captureBinding=action;
    text('binding-status','Nhấn phím mới cho “'+label+'”.');
  };
  $('binding-list').append(item);
  bindingButtons.set(action,item);
}
function updateBindings() {
  const bindings=preferences.bindings;
  for (const [action,item] of bindingButtons) item.textContent=actionLabels[action]+' · '+keyLabel(bindings[action]);
  text('move-key',['up','left','down','right'].map(action=>keyLabel(bindings[action])).join(' '));
  for (const action of instantActions) text(action+'-key',keyLabel(bindings[action]));
  text('pause-key',bindings.pause===defaultBindings.pause ? 'Esc / P' : keyLabel(bindings.pause));
}
updateBindings();
$('restore-bindings').onclick=()=>{
  captureBinding=undefined;
  preferences.bindings={...defaultBindings};
  updateBindings();
  saveSettings();
  text('binding-status','Đã khôi phục phím mặc định.');
};

function captureKey(event) {
  if (event.repeat || event.isComposing) return;
  event.preventDefault();
  const key=event.code;
  const conflict=bindingConflict(preferences.bindings,captureBinding,key);
  if (conflict) {
    text('binding-status','Phím '+keyLabel(key)+' đã dùng cho “'+actionLabels[conflict]+'”. Chọn phím khác.');
    return;
  }
  if (reservedKeys.has(key) || !/^[A-Za-z][A-Za-z0-9]*$/.test(key) || event.metaKey || event.altKey) {
    text('binding-status','Phím này không dùng được. Chọn phím khác.');
    return;
  }
  preferences.bindings[captureBinding]=key;
  captureBinding=undefined;
  updateBindings();
  saveSettings();
  text('binding-status','Đã lưu phím '+keyLabel(key)+'.');
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
    saveSettings();
  });
}
function pauseToggle() { logicalPause=true; }
$('start').onclick=()=>{
  const name=cleanName(nameInput.value);
  nameInput.value=name;
  playerName=name || 'Mây';
  try { localStorage.setItem('dao-den-long-player',name); } catch { /* Storage can be disabled. */ }
  audio.unlock();
  total=0;
  nightsWon=0;
  const chosenNight=Number($('night-select').value);
  practice=chosenNight!==0;
  intro(chosenNight || 1);
};
nameInput.addEventListener('keydown',event=>{
  if(event.key!=='Enter' || event.isComposing) return;
  event.preventDefault();
  $('start').click();
});
const soundtrack=$('soundtrack');
const resetTrack=$('reset-soundtrack');
soundtrack.addEventListener('change',()=>{
  const file=soundtrack.files[0];
  if(!file) return;
  audio.track(file,()=>{
    soundtrack.value='';
    resetTrack.hidden=true;
    text('soundtrack-status','Không phát được tệp này. Đã chuyển về nhạc mặc định.');
  });
  resetTrack.hidden=false;
  text('soundtrack-status',file.name+' · Phát khi vào đêm');
});
resetTrack.onclick=()=>{
  audio.track(null);
  soundtrack.value='';
  resetTrack.hidden=true;
  text('soundtrack-status','Đang dùng nhạc của trò chơi.');
};
$('enter-night').onclick=begin;
$('resume').onclick=pauseToggle;
$('retry').onclick=begin;
$('pause-home').onclick=home;
$('result-home').onclick=home;
$('result-action').onclick=()=>practice || game.state==='lost' ? begin() : night<3 ? intro(night+1) : home();
$('menu-settings').onclick=()=>settings('menu');
$('pause-settings').onclick=()=>settings('pause');
$('close-settings').onclick=()=>display(settingsReturn);
$('open-leaderboard').onclick=()=>{ display('leaderboard'); scores.show(); };
$('close-leaderboard').onclick=()=>display('menu');

window.addEventListener('keydown',e=>{
  if (screen==='settings' && captureBinding) { captureKey(e); return; }
  if (e.code==='Escape' && screen==='settings') { display(settingsReturn); return; }
  if (screen!=='playing' && screen!=='pause') return;
  const action=actionAtKey(preferences.bindings,e.code);
  if (!action && e.code!=='KeyQ' && e.code!=='KeyR') return;
  const isPause=action==='pause';
  if (screen==='pause' && !isPause) return;
  e.preventDefault();
  if (isPause && !e.repeat) pauseToggle();
  if (instantActions.has(action) && !e.repeat) queued.add(action);
  keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{ keys.clear(); queued.clear(); dragging=false; });
window.addEventListener('pointerdown',e=>{ if (screen==='playing' && e.target===$('world')) dragging=true; });
window.addEventListener('pointerup',()=>{ dragging=false; });
window.addEventListener('pointermove',e=>{ if (dragging && screen==='playing') yaw-=e.movementX*.004*preferences.sensitivity/100; });

try {
  const response=await fetch(new URL('../game.contract.json',import.meta.url));
  if (!response.ok) throw new Error('Cannot read game contract');
  ({tuning}=await response.json());
  const template=createGame(tuning,seed);
  preview={...template,player:{...template.player,pos:[4,0,28]},
    lanterns:template.lanterns.map((l,i)=>i===0 ? {...l,lit:true,fuelUnits:tuning.fuel_max*TICKS_PER_SECOND} : l)};
  $('mote-bar').replaceChildren(...Array.from({length:tuning.capacity_max},()=>document.createElement('i')));
  render=createRenderer($('world'),$('effects'),template);
  $('start').disabled=false;
  requestAnimationFrame(animate);
} catch (error) {
  console.error(error);
  text('error','Không thể mở cảnh 3D. Hãy dùng trình duyệt có bật WebGL.');
  $('error').hidden=false;
}
