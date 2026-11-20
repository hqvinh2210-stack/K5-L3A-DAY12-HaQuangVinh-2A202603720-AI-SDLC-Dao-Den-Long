import { MAPS, climbBlocked, distance, terrain } from './maps.mjs';

export const TICKS_PER_SECOND = 60;
export const ISLAND_RADIUS = 40;
const DT = 1 / TICKS_PER_SECOND;
const EPS = 1e-8;
export const IDLE = Object.freeze({
  move: Object.freeze([0,0]), cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false,
});
const seconds = ticks => Math.max(0, ticks) / TICKS_PER_SECOND;
const ticks = duration => Math.round(duration * TICKS_PER_SECOND);
const length = (x,z) => Math.hypot(x,z);
const angle = degrees => (degrees % 360) * Math.PI / 180;
const xyz = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
const rounded = pos => pos.map(v => Number(v.toFixed(3)));
const direction = (from,to) => {
  const x = to[0]-from[0], z = to[2]-from[2];
  const d = length(x,z);
  return d > EPS ? [x/d,z/d] : [1,0];
};

function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function choose(game, choices) {
  return choices.length ? choices[Math.floor(game.random() * choices.length)] : undefined;
}

function ids(prefix, list) {
  const used = new Set(list.flatMap(item => item.id === undefined ? [] : [item.id]));
  let next = 1;
  return () => {
    while (used.has(prefix + next)) next++;
    return prefix + next++;
  };
}

function addMote(game, pos, dropped = false) {
  const g = game.sim_tick;
  game.motes.push({ id: game.moteId(), pos: [...pos], kind: dropped ? 'dropped' : 'random',
    availableAt: dropped ? g + 1 : g, expires: dropped ? g + game.tuning.mote_drop_ticks : Infinity });
}

function addShade(game, item, id) {
  game.shades.push({ id, pos: [...item.pos], state: item.state ?? 'wander', expires: item.state_ticks_left ?? 0,
    motion: undefined, eject: undefined });
}

export function createGame(tuning, seed, scenario = {}, night = 1) {
  const map = MAPS[night];
  const pos = [...(scenario.player?.pos ?? map.start)];
  const configuredShades = scenario.shades ?? [];
  const configuredDrifters = scenario.drifters ?? [];
  const floor = terrain(night,pos[0],pos[2]);
  const game = {
    tuning, night, map, tick: 0, sim_tick: 0, state: 'playing', score: 0, started: false,
    random: prng(seed), previous: IDLE, startTime: scenario.time_left_s ?? tuning['night' + night + '_duration_s'],
    player: {
      pos, vel: [0,0,0], grounded: floor !== null && (Math.abs(pos[1]-floor) <= EPS || (night===3 && pos[1]===0)),
      carried: scenario.player?.carried ?? 0, flames: scenario.player?.flames ?? tuning.flames,
      facing: [0,1], invulnerableUntil: scenario.player?.invuln_ticks ?? 0,
      dashReadyAt: scenario.player?.dash_cd_ticks ?? 0, pulseReadyAt: scenario.player?.pulse_cd_ticks ?? 0,
      charmUntil: scenario.player?.charm_ticks ?? 0, dash: undefined, launch: undefined, respawnAt: 0,
    },
    lanterns: map.lanterns.map((pos,i) => {
      const id = 'L' + (i+1);
      const preset = scenario.lanterns?.find(item => item.id === id);
      const deposited = preset?.deposited ?? (preset?.lit ? tuning.lantern_cost : 0);
      return { id, pos: [...(preset?.pos ?? pos)], deposited, lit: !!preset?.lit || deposited >= tuning.lantern_cost };
    }),
    charms: (scenario.charms ?? map.charms.map(pos => ({pos}))).map((item,i) => ({
      id: item.id ?? 'C'+(i+1), pos: [...(item.pos ?? map.charms[i] ?? map.start)],
      availableAt: item.respawn_ticks ?? (item.available === false ? tuning.charm_respawn_ticks : 0),
    })),
    motes: [], shades: [], drifters: [], moteId: ids('M',[]),
    shadeId: ids('S',configuredShades), drifterId: ids('D',configuredDrifters),
    autoMotes: scenario.random_motes !== false, autoShades: scenario.random_shades !== false,
    autoDrifters: night > 1 && scenario.random_drifters !== false,
    windEnabled: night === 3 && scenario.wind_enabled !== false,
    wind: { active: false, dir_deg: null }, windWarn: false,
  };
  if (scenario.motes !== undefined) {
    for (const point of scenario.motes) addMote(game,point);
  } else if (game.autoMotes) {
    const pool = [...map.motes];
    for (let i=0; i<tuning.mote_initial; i++) {
      addMote(game,pool.splice(Math.floor(game.random()*pool.length),1)[0]);
    }
  }
  for (const item of configuredShades) addShade(game,item,item.id ?? game.shadeId());
  for (const item of configuredDrifters) {
    const state = item.state ?? 'idle';
    game.drifters.push({ id: item.id ?? game.drifterId(), pos: [...item.pos], state,
      stolen: item.stolen ?? 0, expires: item.state_ticks_left ?? (state === 'flee' ? tuning.drifter_flee_ticks : 0),
      heading: [1,0],
    });
  }
  return game;
}

export function timeLeft(game) {
  return Math.max(0, game.startTime - seconds(game.sim_tick));
}

export function nearestUnlit(game) {
  let nearest;
  let limit = game.tuning.interact_radius + EPS;
  for (const lamp of game.lanterns) {
    const d = distance(game.player.pos,lamp.pos);
    if (lamp.lit || d > game.tuning.interact_radius + EPS || (nearest && d >= limit - EPS)) continue;
    nearest = lamp;
    limit = d;
  }
  return nearest;
}

function movement(input) {
  const [x,z] = input.move;
  const yaw = angle(input.cam_yaw_deg);
  const n = Math.max(1,length(x,z));
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [(x*c+z*s)/n, (-x*s+z*c)/n];
}

function resetPlayer(game) {
  const p = game.player;
  p.pos = [...game.map.start];
  p.vel = [0,0,0];
  p.grounded = true;
  p.invulnerableUntil = game.sim_tick + ticks(game.tuning.invuln_s);
  p.respawnAt = 0;
}

function walk(game, input, pressed, emit) {
  const { player:p, tuning:t, sim_tick:g, night } = game;
  if (p.respawnAt) {
    if (g >= p.respawnAt) resetPlayer(game);
    return;
  }
  const [mx,mz] = movement(input);
  const n = length(mx,mz);
  if (n > EPS) p.facing = [mx/n,mz/n];
  const charmed = g < p.charmUntil;
  if (pressed('dash') && !p.dash && (charmed || g >= p.dashReadyAt)) {
    p.dash = { heading: [...p.facing], end: g + ticks(t.dash_duration_s) };
    p.dashReadyAt = charmed ? g : g + ticks(t.dash_cooldown_s);
    emit('dash',{});
  }
  if (pressed('jump') && p.grounded) {
    p.vel[1] = t.jump_velocity;
    p.grounded = false;
  }
  if (p.grounded && !p.dash) {
    const pad = game.map.pads.find(pad => distance(p.pos,pad.pos) <= 1+EPS &&
      Math.abs(p.pos[1]-pad.pos[1]) < 0.1);
    if (pad) {
      const heading = direction(p.pos,pad.target);
      p.launch = heading.map(v => v*pad.speed);
      p.vel[1] = pad.vy;
      p.grounded = false;
    }
  }

  const speed = charmed ? t.charm_speed : t.player_speed;
  let [vx,vz] = p.dash ? p.dash.heading.map(v => v*t.dash_speed) : p.launch ?? [mx*speed,mz*speed];
  if (game.wind.active) {
    const a = angle(game.wind.dir_deg);
    vx += Math.cos(a)*t.wind_speed;
    vz += Math.sin(a)*t.wind_speed;
  }
  const old = p.pos;
  let x = old[0]+vx*DT, z = old[2]+vz*DT;
  const gravity = (p.grounded || p.dash) ? 0 : t.gravity;
  let y = p.dash ? old[1] : old[1] + p.vel[1]*DT + gravity*DT*DT/2;
  if (climbBlocked(night,old,x,z,Math.max(y,old[1]),p.grounded)) {
    x = old[0]; z = old[2];
  }
  const top = terrain(night,x,z);
  const oldTop = terrain(night,old[0],old[2]);
  const underTier = night===3 && oldTop!==null && oldTop>old[1]+0.25;
  const oldFloor = underTier ? 0 : oldTop;
  const floor = underTier && top!==null && top>old[1]+0.25 ? 0 : top;
  const walkingSurface = p.grounded && floor !== null &&
    oldFloor !== null && Math.abs(floor-oldFloor) <= 0.25;
  const landing = !p.dash && floor !== null && y <= floor + EPS &&
    old[1] >= floor - EPS && p.vel[1] <= 0;
  p.grounded = walkingSurface || landing;
  if (p.grounded) {
    y = floor;
    p.vel[1] = 0;
    p.launch = undefined;
  } else if (!p.dash) {
    p.vel[1] += gravity*DT;
    // Integrate immediately when a grounded player leaves a ledge.
    if (gravity === 0) p.vel[1] = t.gravity*DT;
  }
  p.pos = [x,y,z];
  p.vel[0] = (x-old[0])/DT;
  p.vel[2] = (z-old[2])/DT;
  if (t.fall_enabled && y < t.fall_y) {
    const lost = p.carried;
    p.carried = 0;
    p.flames = Math.max(0,p.flames-1);
    p.respawnAt = g+t.respawn_ticks;
    p.vel = [0,0,0];
    p.dash = p.launch = undefined;
    emit('player_hit',{by:'fall', flames:p.flames, dropped:0, lost});
  }
}

function drops(game, count, center, scattered) {
  const t = game.tuning;
  const radius = (t.mote_drop_min+t.mote_drop_max)/2;
  for (let i=0; i<count; i++) {
    const a = i/count*Math.PI*2;
    const x = center[0]+(scattered ? radius*Math.cos(a) : 0);
    const z = center[2]+(scattered ? radius*Math.sin(a) : 0);
    const y = terrain(game.night,x,z) ?? center[1];
    addMote(game,[x,y,z],true);
  }
}

function pickup(game, emit) {
  const { player:p, tuning:t, sim_tick:g } = game;
  const near = pos => distance(p.pos,pos) <= t.pickup_radius+EPS && Math.abs(p.pos[1]-pos[1]) <= t.pickup_height+EPS;
  game.motes = game.motes.filter(mote => {
    if (g < mote.availableAt || p.carried >= t.carry_capacity || !near(mote.pos)) return true;
    emit('mote_picked',{carried:++p.carried});
    return false;
  });
  for (const charm of game.charms) {
    if (g < charm.availableAt || !near(charm.pos)) continue;
    charm.availableAt = g+t.charm_respawn_ticks;
    p.charmUntil = g+t.charm_ticks;
    emit('charm_picked',{charm_id:charm.id,charm_ticks:t.charm_ticks});
  }
}

function deposit(game, emit) {
  const lamp = nearestUnlit(game);
  if (!lamp || !game.player.carried) return;
  const t = game.tuning;
  const amount = Math.min(game.player.carried,t.lantern_cost-lamp.deposited);
  lamp.deposited += amount;
  game.player.carried -= amount;
  game.score += amount*t.score.per_mote;
  emit('deposit',{lantern_id:lamp.id,amount,deposited:lamp.deposited});
  if (lamp.deposited === t.lantern_cost) {
    lamp.lit = true;
    game.score += t.score.per_lantern;
    emit('lantern_lit',{lantern_id:lamp.id});
  }
}

function safeLamps(game) {
  return game.lanterns.filter(lamp => lamp.lit);
}

function ensureEjection(game, lamps) {
  const radius = game.tuning.safe_radius;
  for (const shade of game.shades) {
    if (shade.eject) continue;
    const lamp = lamps.find(lamp => distance(shade.pos,lamp.pos)<radius-EPS);
    if (!lamp) continue;
    const heading = direction(lamp.pos,shade.pos);
    let target;
    for (let i=0; i<32; i++) {
      const phi = Math.atan2(heading[1],heading[0])+i*Math.PI/16;
      const candidate = [lamp.pos[0]+(radius+0.001)*Math.cos(phi),shade.pos[1],lamp.pos[2]+(radius+0.001)*Math.sin(phi)];
      if (lamps.every(other => distance(other.pos,candidate)>=radius)) {
        target = candidate;
        break;
      }
    }
    target ??= [Math.max(...lamps.map(item => item.pos[0]))+radius+0.001,shade.pos[1],shade.pos[2]];
    shade.eject = { target, remaining:game.tuning.safe_eject_ticks };
  }
}

function doPulse(game, emit) {
  const { player:p, tuning:t, sim_tick:g } = game;
  if (p.carried<t.pulse_cost || g<p.pulseReadyAt) return;
  p.carried -= t.pulse_cost;
  p.pulseReadyAt = g+ticks(t.pulse_cooldown_s);
  const origin = [p.pos[0],p.pos[1]+t.pulse_center_y,p.pos[2]];
  const hit = [];
  for (const shade of game.shades) {
    if (xyz(origin,shade.pos)>t.pulse_radius+EPS) continue;
    shade.state = 'stunned';
    shade.expires = g+ticks(t.pulse_stun_s);
    shade.motion = { heading:direction(origin,shade.pos), remaining:t.pulse_push_ticks,
      stride:t.pulse_push_m/t.pulse_push_ticks };
    hit.push(shade.id);
  }
  game.score += hit.length*t.score.per_stun;
  emit('pulse',{stunned_ids:hit});
  for (const drifter of game.drifters) {
    if (xyz(origin,drifter.pos)>t.pulse_radius+EPS) continue;
    if (drifter.state === 'chase') {
      drifter.state = 'flee';
      drifter.expires = g+t.drifter_flee_ticks;
    } else if (drifter.state === 'flee' && drifter.stolen>0) {
      emit('drifter_drop',{drifter_id:drifter.id,amount:drifter.stolen});
      drops(game,drifter.stolen,drifter.pos,false);
      drifter.stolen = 0;
      drifter.expires = g+t.drifter_after_drop_ticks;
    }
  }
}

function moveShade(game, lamps, shade, heading, stride) {
  const [x,y,z] = shade.pos;
  const dx = heading[0]*stride, dz = heading[1]*stride;
  const a = dx*dx+dz*dz;
  if (!a) return false;
  let f = 1;
  for (const lamp of lamps) {
    const sx=x-lamp.pos[0], sz=z-lamp.pos[2];
    const b=sx*dx+sz*dz;
    const c=sx*sx+sz*sz-(game.tuning.safe_radius+0.001)**2;
    const discriminant=b*b-a*c;
    if (b<0 && discriminant>=0) f=Math.min(f,Math.max(0,(-b-Math.sqrt(discriminant))/a));
  }
  const nx=x+dx*f, nz=z+dz*f;
  const oldFloor=terrain(game.night,x,z), floor=terrain(game.night,nx,nz);
  if ((floor === null && oldFloor !== null) || climbBlocked(game.night,shade.pos,nx,nz,y-1,true)) return false;
  shade.pos = [nx,y+(floor ?? 0)-(oldFloor ?? 0),nz];
  return f >= 1-EPS;
}

function shadesStep(game, lamps) {
  const { player:p, tuning:t, sim_tick:g } = game;
  const stride = (game.night === 3 ? t.shade_speed_night3 : t.shade_speed)*DT;
  for (const shade of game.shades) {
    shade.ejectedThisTick = !!shade.eject;
    if (shade.eject) {
      const { target, remaining } = shade.eject;
      shade.pos = shade.pos.map((v,i) => v+(target[i]-v)/remaining);
      if (--shade.eject.remaining === 0) shade.eject = undefined;
      if (shade.motion && shade.state === 'stunned') shade.motion.remaining--;
      continue;
    }
    if (shade.state === 'stunned' || shade.state === 'recoil') {
      const motion = shade.motion;
      if (motion?.remaining > 0) {
        const moved = moveShade(game,lamps,shade,motion.heading,motion.stride);
        motion.remaining = moved ? motion.remaining-1 : 0;
      }
      if (g < shade.expires || (shade.state==='recoil' && g===shade.expires)) continue;
      shade.state = 'wander';
    }
    if (shade.state === 'spawning') {
      if (g < shade.expires) continue;
      shade.state = 'wander';
    }
    const d=distance(p.pos,shade.pos);
    if (!p.respawnAt && d <= t.shade_detect+EPS) shade.state='chase';
    if (d>t.shade_lose+EPS || p.respawnAt) shade.state='wander';
    if (shade.state === 'chase' && d>EPS) {
      moveShade(game,lamps,shade,direction(shade.pos,p.pos),Math.min(stride,d));
    } else if (shade.state === 'wander') {
      const a = Math.atan2(shade.pos[2],shade.pos[0]-(game.night===2 && shade.pos[0]>35 ? 70 : 0));
      moveShade(game,lamps,shade,[-Math.sin(a),Math.cos(a)],stride);
    }
  }
}

function driftersStep(game, emit) {
  const { player:p, tuning:t, sim_tick:g } = game;
  for (const d of game.drifters) {
    const distanceToPlayer=distance(d.pos,p.pos);
    if (d.state !== 'flee') d.state=!p.respawnAt && p.carried>=t.drifter_threshold &&
      distanceToPlayer<=t.drifter_detect+EPS ? 'chase' : 'idle';
    const heading = d.state==='chase' ? direction(d.pos,p.pos) :
      d.state==='flee' ? direction(p.pos,d.pos) : d.heading;
    const stride = (d.state==='idle' ? t.drifter_idle_speed : t.drifter_speed)*DT;
    d.pos[0] += heading[0]*(d.state==='chase' ? Math.min(stride,distanceToPlayer) : stride);
    d.pos[2] += heading[1]*(d.state==='chase' ? Math.min(stride,distanceToPlayer) : stride);
  }
  if (p.respawnAt) return;
  for (const d of game.drifters) {
    if (d.state!=='chase' || p.carried===0 || distance(d.pos,p.pos)>t.drifter_contact+EPS) continue;
    const amount=Math.min(t.drifter_take,p.carried);
    p.carried-=amount;
    d.stolen=amount;
    d.state='flee';
    d.expires=g+t.drifter_flee_ticks;
    emit('drifter_steal',{drifter_id:d.id,amount,carried:p.carried});
  }
}

const shadeOrder = (a,b) => /^S\d+$/.test(a.id) && /^S\d+$/.test(b.id) ? Number(a.id.slice(1))-Number(b.id.slice(1)) : (a.id>b.id)-(a.id<b.id);
function hit(game, lamps, emit) {
  const { player:p, tuning:t, sim_tick:g } = game;
  if (p.respawnAt || g<p.invulnerableUntil || lamps.some(lamp => distance(p.pos,lamp.pos)<=t.safe_radius+EPS)) return;
  const shade = [...game.shades].sort(shadeOrder).find(s =>
    !s.ejectedThisTick && (s.state==='wander' || s.state==='chase') &&
    distance(s.pos,p.pos)<=t.shade_hit_radius+EPS && Math.abs(s.pos[1]-p.pos[1])<=t.shade_hit_height+EPS);
  if (!shade || p.flames<=0) return;
  p.flames--;
  p.invulnerableUntil=g+ticks(t.invuln_s);
  const dropped=Math.floor(p.carried*t.hit_drop_ratio);
  p.carried-=dropped;
  drops(game,dropped,p.pos,true);
  shade.state='recoil';
  shade.expires=g+t.shade_recoil_ticks;
  shade.motion={ heading:direction(p.pos,shade.pos), remaining:t.shade_recoil_ticks,
    stride:t.shade_recoil_m/t.shade_recoil_ticks };
  emit('player_hit',{by:'shade',flames:p.flames,dropped});
}

function spawn(game, lamps, emit) {
  const { tuning:t, sim_tick:g, player:p, map, night } = game;
  if (game.autoMotes && g%t.mote_spawn_ticks===0 && game.motes.length<t.mote_cap) {
    const point=choose(game,map.motes.filter(pos => !game.motes.some(m => xyz(m.pos,pos)<0.01)));
    if (point) addMote(game,point);
  }

  if (game.autoShades && g>=t.shade_first_tick && (g-t.shade_first_tick)%t.shade_intervals[night-1]===0) {
    const count=g===t.shade_first_tick ? t.shade_initial : 1;
    for (let i=0; i<count && game.shades.length<t.shade_caps[night-1]; i++) {
      const pos=choose(game,map.shades.filter(point => distance(point,p.pos)>=t.shade_spawn_min_distance-EPS &&
        !game.shades.some(s => distance(s.pos,point)<1) && lamps.every(l => distance(l.pos,point)>t.safe_radius)));
      if (!pos) break;
      const id=game.shadeId();
      addShade(game,{pos,state:'spawning',state_ticks_left:g+1},id);
      emit('shade_spawned',{id});
    }
  }

  if (game.autoDrifters && g%t.drifter_spawn_ticks===0 && game.drifters.length<t.drifter_cap) {
    const point=choose(game,map.shades);
    const a=game.random()*2*Math.PI;
    game.drifters.push({id:game.drifterId(),pos:[point[0],point[1]+0.55,point[2]],state:'idle',
      stolen:0,expires:0,heading:[Math.cos(a),Math.sin(a)]});
  }
}

function advanceCounters(game) {
  const { tuning:t, sim_tick:g, player:p }=game;
  if (p.dash && g>=p.dash.end) p.dash=undefined;
  game.motes=game.motes.filter(mote => g<mote.expires);
  game.drifters=game.drifters.filter(d => d.state!=='flee' || g<d.expires);
  if (game.windEnabled) {
    const cycle=g%t.wind_interval_ticks;
    game.windWarn=cycle>=t.wind_interval_ticks-t.wind_warning_ticks;
    if (!cycle) game.wind.dir_deg=Math.floor(game.random()*360);
    game.wind.active=g>=t.wind_interval_ticks && cycle<t.wind_duration_ticks;
  }
}

export function stepGame(game,input=IDLE) {
  if (game.state==='won' || game.state==='lost') return [];
  game.tick++;
  const events=[];
  const emit=(name,data) => events.push({type:'event',tick:game.tick,name,data});
  const previous=game.previous;
  const pressed=button => input[button] && !previous[button];
  game.previous={...input};
  if (pressed('pause')) {
    game.state=game.state==='paused' ? 'playing' : 'paused';
    emit(game.state==='paused' ? 'paused' : 'resumed',{});
    if (game.state==='paused') return events;
  }
  if (game.state==='paused') return events;

  game.sim_tick++;
  if (!game.started) {
    game.started=true;
    emit('night_start',{night:game.night});
  }
  advanceCounters(game);
  walk(game,input,pressed,emit);
  if (!game.player.respawnAt && game.player.flames>0) {
    pickup(game,emit);
    if (pressed('interact')) deposit(game,emit);
  }
  const lamps=safeLamps(game);
  ensureEjection(game,lamps);
  if (!game.player.respawnAt && game.player.flames>0 && pressed('pulse')) doPulse(game,emit);
  shadesStep(game,lamps);
  driftersStep(game,emit);
  hit(game,lamps,emit);
  spawn(game,lamps,emit);

  const reason = game.player.flames<=0 ? 'no_flames' :
    lamps.length===game.lanterns.length ? 'all_lit' : timeLeft(game)<=EPS ? 'dawn' : undefined;
  if (reason) {
    game.state=reason==='all_lit' ? 'won' : 'lost';
    if (game.state==='won') game.score+=Math.floor(timeLeft(game))*game.tuning.score.per_second_left+
      game.player.flames*game.tuning.score.per_flame_left;
    emit('game_over',{result:game.state,reason});
  }
  return events;
}

export function snapshot(game) {
  const { tick,sim_tick:g,night,state,score,player:p }=game;
  return {
    type:'snapshot',tick,sim_tick:g,night,state,time_left_s:timeLeft(game),score,wind:{...game.wind},
    player:{pos:rounded(p.pos),vel:rounded(p.vel),grounded:p.grounded,flames:p.flames,carried:p.carried,
      invuln:g<p.invulnerableUntil,dash_cd_s:g<p.charmUntil ? 0 : seconds(p.dashReadyAt-g),pulse_cd_s:seconds(p.pulseReadyAt-g),
      charm_s:seconds(p.charmUntil-g)},
    lanterns:game.lanterns.map(lamp => ({...lamp,pos:rounded(lamp.pos)})),
    shades:game.shades.map(s => ({id:s.id,pos:rounded(s.pos),state:s.state})),
    drifters:game.drifters.map(d => ({id:d.id,pos:rounded(d.pos),state:d.state,stolen:d.stolen})),
    charms:game.charms.map(c => ({id:c.id,available:g>=c.availableAt,respawn_s:seconds(c.availableAt-g)})),
    motes_active:game.motes.length,
    motes:game.motes.map(m => ({id:m.id,pos:rounded(m.pos),kind:m.kind,ttl_s:m.kind==='dropped' ? seconds(m.expires-g) : null})),
  };
}
