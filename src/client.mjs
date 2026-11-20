import { createGame, IDLE, ISLAND_RADIUS, nearestUnlit, stepGame, timeLeft, TICKS_PER_SECOND } from './sim.mjs';
import { createRenderer } from './render.mjs';

const find = id => document.getElementById(id);
const start = find('start');
const restart = find('restart');
const intro = find('intro');
const stats = find('stats');
const end = find('end');
const hint = find('hint');
const navigation = find('navigation');
const map = find('map').getContext('2d');
const flameRow = find('flames');
const keys = new Set();
const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft',
  'ArrowRight', 'Space', 'KeyE', 'KeyF', 'KeyQ', 'KeyR']);
const actions = new Set(['Space', 'KeyE', 'KeyF']);
const queued = new Set();
const SEED = 1201;
const INTRO_YAW = 2.82;
const STEP = 1000 / TICKS_PER_SECOND;
const scoreFormat = new Intl.NumberFormat('vi-VN');

let tuning;
let game;
let preview;
let screen = 'intro';
let yaw = 0;
let heading = 0;
let focus = [0, 0, 0];
let pulse;
let feedback;
let then;
let accumulated = 0;
let flamesShown;
let render;
let resultReason;
let lastMap = 0;

function text(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function clock(seconds) {
  const left = Math.max(0, Math.ceil(seconds));
  return Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
}

function mapPoint(pos) {
  return [128 + pos[0] / ISLAND_RADIUS * 111, 128 - pos[2] / ISLAND_RADIUS * 111];
}

function drawMap() {
  map.clearRect(0, 0, 256, 256);
  map.beginPath();
  map.arc(128, 128, 111, 0, Math.PI * 2);
  map.fillStyle = '#213833';
  map.fill();
  map.lineWidth = 1.5;
  map.strokeStyle = '#719080';
  map.stroke();
  for (const lantern of game.lanterns) {
    const [x, y] = mapPoint(lantern.pos);
    map.beginPath();
    map.moveTo(128, 128);
    map.lineTo(x, y);
    map.strokeStyle = '#a7b1963d';
    map.stroke();
    map.beginPath();
    map.arc(x, y, 7, 0, Math.PI * 2);
    map.fillStyle = lantern.lit ? '#f4c36c' : '#252a32';
    map.fill();
    map.strokeStyle = '#f4c36c';
    map.lineWidth = 2;
    map.stroke();
  }
  for (const mote of game.motes) {
    const [x, y] = mapPoint(mote.pos);
    map.fillStyle = '#83af86';
    map.fillRect(x - 1, y - 1, 2, 2);
  }
  const [x, y] = mapPoint(game.player.pos);
  map.save();
  map.translate(x, y);
  map.rotate(heading);
  map.beginPath();
  map.moveTo(0, -10);
  map.lineTo(6, 6);
  map.lineTo(0, 4);
  map.lineTo(-6, 6);
  map.closePath();
  map.fillStyle = '#fff3d1';
  map.fill();
  map.restore();
}

function updateHud(now) {
  const { player } = game;
  if (flamesShown !== player.flames) {
    flamesShown = player.flames;
    flameRow.setAttribute('aria-label', player.flames + ' trên ' + tuning.flames + ' ngọn lửa');
    flameRow.replaceChildren(...Array.from({ length: tuning.flames }, (_, i) => {
      const flame = document.createElement('i');
      flame.setAttribute('aria-hidden', 'true');
      if (i >= player.flames) flame.className = 'empty';
      return flame;
    }));
  }
  text(find('carried'), player.carried + ' / ' + tuning.carry_capacity);
  text(find('lanterns'), game.lanterns.filter(lamp => lamp.lit).length + ' / ' + tuning.lantern_count_night1);
  text(find('clock'), clock(timeLeft(game)));
  text(find('score'), scoreFormat.format(game.score));
  if (now - lastMap > 70) {
    drawMap();
    lastMap = now;
  }

  if (feedback && now < feedback.until) {
    text(hint, feedback.message);
  } else {
    const lamp = nearestUnlit(game);
    if (lamp) {
      const details = lamp.deposited + '/' + tuning.lantern_cost;
      text(hint, player.carried ? 'E · Gửi đom đóm vào đèn (' + details + ')' :
        'Đèn có ' + details + ' đom đóm. Hãy tìm thêm quanh đảo.');
    } else if (player.carried >= tuning.carry_capacity) {
      text(hint, 'Túi đã đầy. Hãy mang đom đóm đến đèn chưa sáng.');
    } else if (game.tick < player.pulseReadyAt) {
      const seconds = Math.ceil((player.pulseReadyAt - game.tick) / TICKS_PER_SECOND);
      text(hint, 'Có thể tỏa sáng lại sau ' + seconds + ' giây.');
    } else {
      text(hint, player.carried >= tuning.pulse_cost ?
        'F · Tỏa sáng khi Bóng Mực đến gần' : 'Đến gần ánh vàng nhỏ để nhặt đom đóm.');
    }
  }
}

function reset() {
  game = createGame(tuning, SEED);
  yaw = heading = 0;
  focus = [0, 0, 0];
  accumulated = 0;
  pulse = feedback = resultReason = undefined;
  screen = 'playing';
  keys.clear();
  queued.clear();
  document.body.classList.add('playing');
  intro.hidden = end.hidden = true;
  stats.hidden = hint.hidden = navigation.hidden = false;
  lastMap = 0;
  updateHud(performance.now());
  drawMap();
}

function finish() {
  screen = 'end';
  hint.hidden = true;
  end.hidden = false;
  const success = game.state === 'won';
  text(find('outcome'), success ? 'Đảo đã sáng đèn!' : 'Đêm chưa tan');
  const summary = success ? 'Mây đã thắp lại cả năm Đèn Lồng Lớn. Đảo Bến lại rực sáng giữa biển mây.' :
    resultReason === 'dawn' ? 'Bình minh đã tới khi vẫn còn đèn chưa thắp.' :
      'Mây đã mất hết ngọn lửa. Hãy dùng đèn đã thắp làm nơi trú khi Bóng Mực đến gần.';
  text(find('summary'), summary);
  text(find('final-score'), 'Điểm của Mây · ' + scoreFormat.format(game.score));
  restart.focus();
}

function inputAtTick() {
  const down = (a, b) => Number(keys.has(a) || keys.has(b));
  const action = key => keys.has(key) || queued.has(key);
  yaw += (Number(keys.has('KeyR')) - Number(keys.has('KeyQ'))) * 0.024;
  const move = [down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft'),
    down('KeyW', 'ArrowUp') - down('KeyS', 'ArrowDown')];
  if (move.some(Boolean)) heading = yaw + Math.atan2(move[0], move[1]);
  const input = { ...IDLE, move, cam_yaw_deg: yaw * 180 / Math.PI,
    jump: action('Space'), interact: action('KeyE'), pulse: action('KeyF') };
  queued.clear();
  return input;
}

function animate(now) {
  const elapsed = Math.min(150, now - (then ?? now));
  then = now;
  let walking = false;
  if (screen === 'playing') {
    accumulated += elapsed;
    while (accumulated >= STEP && game.state === 'playing') {
      accumulated -= STEP;
      const input = inputAtTick();
      for (const event of stepGame(game, input)) {
        if (event.name === 'pulse') pulse = { at: now, pos: [...game.player.pos] };
        if (event.name === 'player_hit') feedback = {
          until: now + 1800, message: event.data.dropped ?
            'Mây mất một ngọn lửa và rơi ' + event.data.dropped + ' đom đóm.' : 'Mây mất một ngọn lửa.',
        };
        if (event.name === 'lantern_lit') feedback = { until: now + 2200, message: 'Đèn đã sáng. Bóng Mực không thể vào vùng sáng.' };
        if (event.name === 'game_over') resultReason = event.data.reason;
      }
    }
    walking = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some(key => keys.has(key));
    const follow = 1 - Math.exp(-elapsed / 70);
    focus[0] += (game.player.pos[0] - focus[0]) * follow;
    focus[2] += (game.player.pos[2] - focus[2]) * follow;
    updateHud(now);
    if (game.state !== 'playing') finish();
  }

  if (screen === 'intro') {
    render(preview, { intro: true, yaw: INTRO_YAW + Math.sin(now * 0.00015) * 0.14,
      heading: INTRO_YAW * 0.7, focus: [0, 0, 11] }, now);
  } else {
    render(game, { intro: false, yaw, heading, focus, pulse, walking }, now);
  }
  requestAnimationFrame(animate);
}

window.addEventListener('keydown', event => {
  if (screen !== 'playing' || !controls.has(event.code)) return;
  event.preventDefault();
  if (actions.has(event.code) && !event.repeat) queued.add(event.code);
  keys.add(event.code);
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => {
  keys.clear();
  queued.clear();
});
start.addEventListener('click', reset);
restart.addEventListener('click', reset);

try {
  const response = await fetch('/game.contract.json');
  if (!response.ok) throw new Error('Cannot read game contract');
  ({ tuning } = await response.json());
  const template = createGame(tuning, SEED);
  preview = {
    ...template, player: { ...template.player, pos: [4, 0, 28] },
    lanterns: template.lanterns.map((lamp, i) => ({ ...lamp, lit: i === 0 })),
  };
  render = createRenderer(find('world'), find('effects'), template);
  start.disabled = false;
  requestAnimationFrame(animate);
} catch (error) {
  console.error(error);
  const message = find('error');
  text(message, 'Không thể mở cảnh 3D. Hãy mở trò chơi bằng Chrome, Firefox hoặc Safari có bật WebGL.');
  message.hidden = false;
}
