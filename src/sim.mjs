export const TICKS_PER_SECOND = 60;
export const ISLAND_RADIUS = 39;
export const IDLE = Object.freeze({
  move: Object.freeze([0, 0]), cam_yaw_deg: 0, jump: false, interact: false, pulse: false,
});

const DT = 1 / TICKS_PER_SECOND;
const RING = 23;
const EPSILON = 1e-9;
const MOTE_COUNT = 48;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function within(a, b, radius) {
  return distance(a, b) <= radius + EPSILON;
}

function radial(radius, angle, y = 0) {
  return [radius * Math.sin(angle), y, radius * Math.cos(angle)];
}

function secondsToTicks(seconds) {
  return Math.round(seconds * TICKS_PER_SECOND);
}

function nextShadeId(game) {
  let id;
  do {
    id = 'S' + game.nextShade++;
  } while (game.shades.some(shade => shade.id === id));
  return id;
}

function makeShade(id, pos) {
  return { id, pos: [...pos], state: 'chase', stunnedUntil: 0 };
}

function addMote(game, pos, availableAt = 0) {
  game.motes.push({ id: 'M' + game.nextMote++, pos: [...pos], availableAt });
}

function spawnMote(game, index) {
  const angle = (index * 2.399963229728653) + (game.random() - 0.5) * 0.6;
  const radius = 4 + Math.sqrt(((index % MOTE_COUNT) + game.random()) / MOTE_COUNT) * 32;
  addMote(game, radial(radius, angle));
}

export function createGame(tuning, seed, scenario = {}) {
  const game = {
    tuning, random: seededRandom(seed), tick: 0, state: 'playing', score: 0,
    startTime: scenario.time_left_s ?? tuning.night1_duration_s,
    player: {
      pos: [...(scenario.player?.pos ?? [0, 0, 0])],
      carried: scenario.player?.carried ?? 0, flames: scenario.player?.flames ?? tuning.flames,
      velocityY: 0, invulnerableUntil: 0, pulseReadyAt: 0,
    },
    lanterns: Array.from({ length: tuning.lantern_count_night1 }, (_, i) => {
      const id = 'L' + (i + 1);
      const preset = scenario.lanterns?.find(lamp => lamp.id === id);
      const deposited = preset?.deposited ?? (preset?.lit ? tuning.lantern_cost : 0);
      return {
        id, pos: [...(preset?.pos ?? radial(RING, i * 2 * Math.PI / tuning.lantern_count_night1))],
        deposited, lit: preset?.lit === true || deposited >= tuning.lantern_cost,
      };
    }),
    motes: [], shades: [], nextMote: 1, nextShade: 1, previous: IDLE,
    replenish: scenario.random_motes !== false && scenario.motes === undefined,
    waves: scenario.random_shades !== false,
  };

  if (scenario.motes !== undefined) {
    for (const pos of scenario.motes) addMote(game, pos);
  } else if (game.replenish) {
    for (let i = 0; i < MOTE_COUNT; i++) spawnMote(game, i);
  }

  if (scenario.shades !== undefined) {
    const reserved = new Set(scenario.shades.flatMap(shade => shade.id === undefined ? [] : [shade.id]));
    for (const shade of scenario.shades) {
      let id = shade.id;
      if (id === undefined) {
        do {
          id = nextShadeId(game);
        } while (reserved.has(id));
      }
      game.shades.push(makeShade(id, shade.pos));
    }
  } else if (game.waves) {
    const angle = game.random() * Math.PI * 2;
    for (let i = 0; i < 3; i++) {
      game.shades.push(makeShade(nextShadeId(game), radial(31, angle + i * Math.PI * 2 / 3, 1)));
    }
  }
  return game;
}

export function timeLeft(game) {
  return Math.max(0, game.startTime - game.tick / TICKS_PER_SECOND);
}

export function nearestUnlit(game) {
  let nearest;
  let limit = game.tuning.interact_radius + EPSILON;
  for (const lantern of game.lanterns) {
    if (lantern.lit) continue;
    const d = distance(game.player.pos, lantern.pos);
    if (d < limit) {
      nearest = lantern;
      limit = d;
    }
  }
  return nearest;
}

function advancePlayer(game, input, jump) {
  const player = game.player;
  const [x, z] = input.move;
  const length = Math.max(1, Math.hypot(x, z));
  const angle = (input.cam_yaw_deg % 360) * Math.PI / 180;
  const stride = game.tuning.player_speed * DT / length;

  const previousRadius = Math.hypot(player.pos[0], player.pos[2]);
  const limit = Math.max(ISLAND_RADIUS, previousRadius);
  player.pos[0] += (x * Math.cos(angle) + z * Math.sin(angle)) * stride;
  player.pos[2] += (-x * Math.sin(angle) + z * Math.cos(angle)) * stride;
  const radius = Math.hypot(player.pos[0], player.pos[2]);
  if (radius > limit) {
    player.pos[0] *= limit / radius;
    player.pos[2] *= limit / radius;
  }

  if (jump && player.pos[1] === 0) player.velocityY = 6.1;
  if (player.pos[1] > 0 || player.velocityY > 0) {
    player.pos[1] = Math.max(0, player.pos[1] + player.velocityY * DT);
    player.velocityY = player.pos[1] > 0 ? player.velocityY - 17 * DT : 0;
  }
}

// Limit an XZ segment at the first lit lantern's exclusion circle.
function moveShade(game, shade, dx, dz) {
  const a = dx * dx + dz * dz;
  if (a === 0) return;
  const radius = game.tuning.safe_radius + 0.001;
  let fraction = 1;
  for (const lantern of game.lanterns) {
    if (!lantern.lit) continue;
    const x = shade.pos[0] - lantern.pos[0];
    const z = shade.pos[2] - lantern.pos[2];
    const b = x * dx + z * dz;
    const c = x * x + z * z - radius * radius;
    if (b >= 0) continue;
    const discriminant = b * b - a * c;
    if (discriminant >= 0) {
      const entry = (-b - Math.sqrt(discriminant)) / a;
      fraction = Math.min(fraction, Math.max(0, entry));
    }
  }
  shade.pos[0] += fraction * dx;
  shade.pos[2] += fraction * dz;
}

// Newly lit or preset overlapping zones can already contain a shade.
function ejectShade(game, shade) {
  const radius = game.tuning.safe_radius + 0.002;
  const lamps = game.lanterns.filter(lamp => lamp.lit);
  const containing = lamps.find(lamp => within(shade.pos, lamp.pos, game.tuning.safe_radius));
  if (!containing) return;
  const angle = Math.atan2(shade.pos[0] - containing.pos[0], shade.pos[2] - containing.pos[2]);
  for (let i = 0; i < 32; i++) {
    const offset = radial(radius, angle + i * Math.PI / 16, shade.pos[1]);
    const candidate = [containing.pos[0] + offset[0], offset[1], containing.pos[2] + offset[2]];
    if (lamps.every(lamp => !within(candidate, lamp.pos, game.tuning.safe_radius))) {
      shade.pos = candidate;
      return;
    }
  }
  shade.pos[0] = Math.max(...lamps.map(lamp => lamp.pos[0])) + radius;
}

export function stepGame(game, input = IDLE) {
  if (game.state !== 'playing') return [];
  game.tick++;
  const { tuning: t, player } = game;
  const events = [];
  const emit = (name, data) => events.push({ type: 'event', tick: game.tick, name, data });
  const pressed = key => input[key] && !game.previous[key];

  advancePlayer(game, input, pressed('jump'));
  game.motes = game.motes.filter(mote => {
    if (player.carried >= t.carry_capacity || game.tick < mote.availableAt ||
        !within(player.pos, mote.pos, t.pickup_radius)) return true;
    player.carried++;
    game.score += t.score.per_mote;
    emit('mote_picked', { carried: player.carried });
    return false;
  });

  const lantern = pressed('interact') && nearestUnlit(game);
  if (lantern && player.carried > 0) {
    const amount = Math.min(player.carried, t.lantern_cost - lantern.deposited);
    player.carried -= amount;
    lantern.deposited += amount;
    emit('deposit', { lantern_id: lantern.id, amount, deposited: lantern.deposited });
    if (lantern.deposited === t.lantern_cost) {
      lantern.lit = true;
      game.score += t.score.per_lantern;
      emit('lantern_lit', { lantern_id: lantern.id });
    }
  }

  if (pressed('pulse') && game.tick >= player.pulseReadyAt && player.carried >= t.pulse_cost) {
    player.carried -= t.pulse_cost;
    player.pulseReadyAt = game.tick + secondsToTicks(t.pulse_cooldown_s);
    const stunned_ids = [];
    for (const shade of game.shades) {
      if (!within(shade.pos, player.pos, t.pulse_radius)) continue;
      const separation = distance(shade.pos, player.pos);
      const x = separation === 0 ? 1 : (shade.pos[0] - player.pos[0]) / separation;
      const z = separation === 0 ? 0 : (shade.pos[2] - player.pos[2]) / separation;
      moveShade(game, shade, x * t.pulse_push_m, z * t.pulse_push_m);
      shade.stunnedUntil = game.tick + secondsToTicks(t.pulse_stun_s);
      shade.state = 'stunned';
      stunned_ids.push(shade.id);
    }
    game.score += stunned_ids.length * t.score.per_stun;
    emit('pulse', { stunned_ids });
  }

  game.previous = { jump: input.jump, interact: input.interact, pulse: input.pulse };

  if (game.lanterns.every(lamp => lamp.lit)) {
    game.state = 'won';
    game.score += Math.floor(timeLeft(game)) * t.score.per_second_left + player.flames * t.score.per_flame_left;
    emit('game_over', { result: 'won', reason: 'all_lit' });
    return events;
  }

  if (game.waves && game.tick % (36 * TICKS_PER_SECOND) === 0 && game.shades.length < 7) {
    const shade = makeShade(nextShadeId(game), radial(36, game.random() * Math.PI * 2, 1));
    game.shades.push(shade);
    emit('shade_spawned', { id: shade.id });
  }

  for (const shade of game.shades) {
    ejectShade(game, shade);
    if (game.tick < shade.stunnedUntil) continue;
    shade.state = 'chase';
    const separation = distance(shade.pos, player.pos);
    if (separation > EPSILON) {
      const stride = Math.min(t.shade_speed * DT, separation) / separation;
      moveShade(game, shade, (player.pos[0] - shade.pos[0]) * stride, (player.pos[2] - shade.pos[2]) * stride);
    }
    const safe = game.lanterns.some(lamp => lamp.lit && within(player.pos, lamp.pos, t.safe_radius));
    if (safe || player.flames <= 0 || game.tick < player.invulnerableUntil ||
        !within(shade.pos, player.pos, t.shade_hit_radius)) continue;
    player.flames--;
    player.invulnerableUntil = game.tick + secondsToTicks(t.invuln_s);
    const dropped = Math.floor(player.carried * t.hit_drop_ratio);
    player.carried -= dropped;
    for (let i = 0; i < dropped; i++) {
      const offset = radial(2.15, i * Math.PI * 2 / dropped);
      addMote(game, [player.pos[0] + offset[0], 0, player.pos[2] + offset[2]], player.invulnerableUntil);
    }
    emit('player_hit', { by: 'shade', flames: player.flames, dropped });
  }

  if (player.flames <= 0 || timeLeft(game) <= EPSILON) {
    game.state = 'lost';
    emit('game_over', { result: 'lost', reason: player.flames <= 0 ? 'no_flames' : 'dawn' });
  } else if (game.replenish && game.tick % (5 * TICKS_PER_SECOND) === 0 && game.motes.length < MOTE_COUNT) {
    spawnMote(game, game.nextMote);
  }
  return events;
}

const rounded = pos => pos.map(value => Number(value.toFixed(3)));

export function snapshot(game) {
  const { tick, state, score, player, lanterns, shades, motes } = game;
  return {
    type: 'snapshot', tick, sim_tick: tick, state, time_left_s: timeLeft(game), score,
    player: { pos: rounded(player.pos), flames: player.flames, carried: player.carried },
    lanterns: lanterns.map(lamp => ({ ...lamp, pos: rounded(lamp.pos) })),
    shades: shades.map(shade => ({ id: shade.id, pos: rounded(shade.pos), state: shade.state })),
    motes_active: motes.length,
    motes: motes.map(mote => ({ id: mote.id, pos: rounded(mote.pos) })),
  };
}
