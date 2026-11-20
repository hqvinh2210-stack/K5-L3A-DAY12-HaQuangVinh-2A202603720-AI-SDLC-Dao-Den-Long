import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const { tuning: t } = JSON.parse(readFileSync(join(root, 'game.contract.json')));
const temp = mkdtempSync(join(tmpdir(), 'lantern-tests-'));
after(() => rmSync(temp, { recursive: true, force: true }));
const empty = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false };
const events = (run, name) => run.filter(record => record.name === name);
const snap = (run, tick) => run.find(record => record.type === 'snapshot' && record.tick === tick);
const near = (actual, expected, tolerance = 0.001) => assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' ≈ ' + expected);

let serial = 0;
function invoke({ ticks = 1, every = 1, seed = 1234, night = 1, scenario, frames, brokenInputs, brokenScenario, extra = [] } = {}) {
  const run = ++serial;
  const out = join(temp, run + '.jsonl');
  const args = ['src/headless.mjs', '--seed', String(seed), '--night', String(night), '--ticks', String(ticks),
    '--out', out, '--snapshot-every', String(every)];
  if (scenario !== undefined || brokenScenario !== undefined) {
    const path = join(temp, run + '-scenario.json');
    writeFileSync(path, brokenScenario ?? JSON.stringify(scenario));
    args.push('--scenario', path);
  }
  if (frames !== undefined || brokenInputs !== undefined) {
    const path = join(temp, run + '-inputs.json');
    writeFileSync(path, brokenInputs ?? JSON.stringify({ frames }));
    args.push('--inputs', path);
  }
  const command = spawnSync(process.execPath, [...args, ...extra], { cwd: root, encoding: 'utf8' });
  assert.ifError(command.error);
  const bytes = command.status === 0 ? readFileSync(out) : undefined;
  return { ...command, bytes, records: bytes?.toString().trim().split('\n').map(JSON.parse) };
}

function play(options = {}) {
  const command = invoke({ scenario: empty, ...options });
  assert.equal(command.status, 0, command.stderr);
  assert.equal(command.stderr, '');
  return command.records;
}

test('fixed ticks, starting state, partial frames and yaw mapping', () => {
  const run = play({ ticks: 120, every: 10, frames: [
    { tick: 0, move: [0, 1] },
    { tick: 60, cam_yaw_deg: 90 },
  ] });
  assert.deepEqual(snap(run, 0).player.pos, [0, 0, 0]);
  assert.equal(snap(run, 0).lanterns.length, 5);
  assert.deepEqual(snap(run, 60).player.pos, [0, 0, t.player_speed]);
  assert.deepEqual(snap(run, 120).player.pos, [t.player_speed, 0, t.player_speed]);
  assert.equal(snap(run, 120).sim_tick, 120);
  assert.equal(snap(run, 120).time_left_s, t.night1_duration_s - 2);
  assert.deepEqual(run.at(-1), { type: 'end', ticks: 120, state: 'playing', score: 0 });
});

test('diagonal movement is normalized and holding jump cannot repeat it', () => {
  const run = play({ ticks: 60, frames: [{ tick: 0, move: [1, 1], jump: true }] });
  const [x, y, z] = snap(run, 60).player.pos;
  near(Math.hypot(x, z), t.player_speed);
  assert.equal(x, z);
  assert.equal(y, 0);
  assert.ok(snap(run, 10).player.pos[1] > 0);
  assert.equal(snap(run, 50).player.pos[1], 0);
});

test('pickup radius includes boundary, capacity is enforced, and pickups award no score', () => {
  const run = play({ scenario: { ...empty, motes: [
    [t.pickup_radius + 0.01, 0, 0], [t.pickup_radius, 0, 0],
    ...Array.from({ length: t.carry_capacity }, () => [0, 0, 0]),
  ] } });
  assert.equal(events(run, 'mote_picked').length, t.carry_capacity);
  assert.equal(snap(run, 1).player.carried, t.carry_capacity);
  assert.equal(snap(run, 1).motes_active, 2);
  assert.deepEqual(snap(run, 1).motes.map(m => m.id), ['M1', 'M' + (t.carry_capacity + 2)]);
  assert.equal(snap(run, 1).score, 0);
});

test('interact allows partial deposit and uses a rising edge before lighting', () => {
  const run = play({ ticks: 4, scenario: { ...empty, player: { carried: t.lantern_cost - 1 },
    motes: [[t.pickup_radius + 0.25, 0, 0]], lanterns: [{ id: 'L1', pos: [t.interact_radius, 0, 0] }],
  }, frames: [
    { tick: 0, interact: true }, { tick: 1, move: [1, 0] },
    { tick: 2, interact: false }, { tick: 3, interact: true },
  ] });
  assert.deepEqual(events(run, 'deposit').map(e => [e.tick, e.data.amount, e.data.deposited]), [
    [1, t.lantern_cost - 1, t.lantern_cost - 1], [4, 1, t.lantern_cost],
  ]);
  assert.deepEqual(events(run, 'lantern_lit').map(e => e.data), [{ lantern_id: 'L1' }]);
  assert.equal(snap(run, 4).score, t.score.per_lantern + t.lantern_cost * t.score.per_mote);
});

test('interact ignores a lamp just beyond its radius', () => {
  const run = play({ scenario: { ...empty, player: { carried: t.lantern_cost },
    lanterns: [{ id: 'L1', pos: [0, 0, t.interact_radius + 0.01] }],
  }, frames: [{ tick: 0, interact: true }] });
  assert.equal(events(run, 'deposit').length, 0);
});

test('pulse uses radius, pushes, applies stun for its full duration, and costs light', () => {
  const stun = t.pulse_stun_s * 60;
  const run = play({ ticks: stun + 1, scenario: { ...empty, player: { carried: t.pulse_cost },
    shades: [{ id: 'edge', pos: [t.pulse_radius, t.pulse_center_y, 0] },
      { id: 'outside', pos: [0, 1, -(t.pulse_radius + 0.01)] }],
  }, frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 130, pulse: true }] });
  assert.deepEqual(events(run, 'pulse').map(e => e.data), [{ stunned_ids: ['edge'] }]);
  assert.equal(snap(run, 1).player.carried, 0);
  assert.equal(snap(run, 1).score, t.score.per_stun);
  assert.deepEqual(snap(run, t.pulse_push_ticks).shades[0].pos, [t.pulse_radius + t.pulse_push_m, t.pulse_center_y, 0]);
  assert.equal(snap(run, 1).shades[1].state, 'chase');
  assert.equal(snap(run, stun).shades[0].state, 'stunned');
  assert.equal(snap(run, stun + 1).shades[0].state, 'chase');
});

test('pulse cooldown rejects early press and holding does not retrigger', () => {
  const interval = t.pulse_cooldown_s * 60;
  const run = play({ ticks: interval * 2 + 1,
    scenario: { ...empty, player: { carried: 3 * t.pulse_cost } },
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true },
      { tick: interval * 2 - 1, pulse: false }, { tick: interval * 2, pulse: true }],
  });
  assert.deepEqual(events(run, 'pulse').map(e => e.tick), [1, interval * 2 + 1]);
  assert.equal(snap(run, interval * 2 + 1).player.carried, t.pulse_cost);
  const atBoundary = play({ ticks: interval + 1,
    scenario: { ...empty, player: { carried: 2 * t.pulse_cost } },
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: interval, pulse: true }],
  });
  assert.deepEqual(events(atBoundary, 'pulse').map(e => e.tick), [1, interval + 1]);
});

test('shade contact consumes a flame, drops floor of the ratio and respects invulnerability', () => {
  const cooldown = t.invuln_s * 60;
  const run = play({ ticks: cooldown + 1, scenario: { ...empty, player: { carried: 5 },
    shades: [{ pos: [t.shade_hit_radius, 2, 0] }, { pos: [0, 0, 0] }],
  } });
  const firstDrop = Math.floor(5 * t.hit_drop_ratio);
  assert.deepEqual(events(run, 'player_hit').map(e => [e.tick, e.data]), [
    [1, { by: 'shade', flames: t.flames - 1, dropped: firstDrop }],
    [cooldown + 1, { by: 'shade', flames: t.flames - 2, dropped: Math.floor((5 - firstDrop) * t.hit_drop_ratio) }],
  ]);
  assert.equal(snap(run, 1).motes_active, firstDrop);
  assert.equal(snap(run, 1).player.carried, 5 - firstDrop);
});

test('lit safe radius excludes chasing shades and prevents contact damage at the boundary', () => {
  const run = play({ ticks: 120, scenario: { ...empty, player: { pos: [t.safe_radius, 0, 0] },
    shades: [{ pos: [t.safe_radius + 3, 1, 0] }, { pos: [0, 1, 0] }],
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
  } });
  for (const item of run.filter(r => r.type === 'snapshot' && r.tick >= t.safe_eject_ticks)) {
    assert.ok(item.shades.every(shade => Math.hypot(shade.pos[0], shade.pos[2]) >= t.safe_radius));
  }
  assert.equal(events(run, 'player_hit').length, 0);
});

test('last lantern wins, bonuses are added once, and execution stops immediately', () => {
  const run = play({ ticks: 10, scenario: { ...empty, time_left_s: 25,
    player: { carried: t.lantern_cost }, lanterns: [
      { id: 'L1', pos: [0, 0, 0] }, ...[2, 3, 4, 5].map(i => ({ id: 'L' + i, lit: true })),
    ],
  }, frames: [{ tick: 0, interact: true }] });
  assert.deepEqual(events(run, 'game_over').map(e => e.data), [{ result: 'won', reason: 'all_lit' }]);
  assert.deepEqual(run.at(-1), { type: 'end', ticks: 1, state: 'won',
    score: t.score.per_lantern + t.lantern_cost * t.score.per_mote + 24 * t.score.per_second_left + t.flames * t.score.per_flame_left });
});

test('lose reasons distinguish no flames from dawn', () => {
  const hit = play({ ticks: 7, scenario: { ...empty, player: { flames: 1 }, shades: [{ pos: [0, 0, 0] }] } });
  assert.deepEqual(events(hit, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(hit.at(-1).ticks, 1);
  const dawn = play({ ticks: 7, every: 2, scenario: { ...empty, time_left_s: 3 / 60 } });
  assert.deepEqual(events(dawn, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(dawn.at(-1).ticks, 3);
  assert.deepEqual(dawn.filter(r => r.type === 'snapshot').map(r => r.tick), [0, 2]);
});

test('scenario setup replaces lists, preserves untouched lamps and emits no events or score', () => {
  const run = play({ ticks: 0, scenario: { player: { carried: 3 }, motes: [], shades: [
    { id: 'S1', pos: [2, 1, 5] }, { pos: [1, 1, 1] },
  ], lanterns: [{ id: 'L2', lit: true, deposited: 2 }] } });
  assert.deepEqual(run.map(r => r.type), ['snapshot', 'end']);
  assert.equal(run[0].score, 0);
  assert.equal(run[0].motes_active, 0);
  assert.deepEqual(run[0].shades.map(s => s.id), ['S1', 'S2']);
  assert.equal(run[0].player.carried, 3);
  assert.equal(run[0].lanterns.length, 5);
  assert.deepEqual([run[0].lanterns[1].lit, run[0].lanterns[1].deposited], [true, 2]);
});

test('random game logs are byte-identical across independent CLI runs', () => {
  const options = { ticks: 2500, every: 60, frames: [{ tick: 0, move: [1, 1] }, { tick: 395, cam_yaw_deg: 127 }] };
  const a = invoke(options);
  const b = invoke(options);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.equal(Buffer.compare(a.bytes, b.bytes), 0);
  assert.equal(a.records[0].motes_active, t.mote_initial);
  const spawn = play({ ticks: 300, every: 300, scenario: { random_shades: true, shades: [], motes: [] } });
  assert.deepEqual(events(spawn, 'shade_spawned')[0].data, { id: 'S1' });
});

test('CLI uses exit 2 for malformed files and non-zero for command and filesystem errors', () => {
  assert.equal(invoke({ ticks: 0 }).status, 0);
  for (const options of [
    { brokenScenario: '{' }, { brokenInputs: 'null' }, { scenario: { lanterns: [{ id: 'L6' }] } },
    { frames: [{ tick: 3 }, { tick: 3 }] }, { frames: [{ tick: 3 }, { tick: 2 }] },
    { frames: [{ tick: 0, move: [0, 2] }] }, { frames: [{ tick: 0, pulse: 'yes' }] },
  ]) {
    const result = invoke(options);
    assert.equal(result.status, 2, result.stderr);
    assert.ok(result.stderr);
  }
  for (const extra of [['--unknown', '1'], ['--scenario', join(temp, 'missing.json')]]) {
    const result = invoke({ extra });
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr);
  }
});

test('dash lasts 12 ticks, holds air altitude, uses facing, and cools down from activation', () => {
  const run=play({ticks:95,frames:[
    {tick:0,move:[1,0]}, {tick:1,move:[0,0],jump:true},
    {tick:2,dash:true}, {tick:3,dash:false}, {tick:15,dash:true},
    {tick:16,dash:false}, {tick:92,dash:true},
  ]});
  assert.deepEqual(events(run,'dash').map(e=>e.tick),[3,93]);
  near(snap(run,14).player.pos[0]-snap(run,2).player.pos[0],2.8);
  assert.equal(snap(run,3).player.pos[1],snap(run,14).player.pos[1]);
  assert.equal(snap(run,3).player.dash_cd_s,1.5);
  assert.equal(snap(run,15).player.vel[0],0);
  const contact=play({scenario:{...empty,shades:[{pos:[0,1,0]}]},frames:[{tick:0,dash:true}]});
  assert.equal(events(contact,'player_hit').length,1);
});

test('Night 2 pads launch fixed velocity against input and land on the other island', () => {
  for (const [start,targetX] of [[[20,0,18],70],[[50,0,-18],0]]) {
    const run=play({night:2,ticks:86,scenario:{...empty,player:{pos:start}},
      frames:[{tick:0,move:[0,-1]}]});
    const first=snap(run,1).player;
    near(Math.hypot(first.vel[0],first.vel[2]),24);
    assert.ok(!first.grounded && first.vel[1]>13);
    const land=snap(run,84).player;
    assert.ok(land.grounded && Math.hypot(land.pos[0]-targetX,land.pos[2])<28);
  }
});

test('Night 3 pad lands on tier 2, sheer walls block, ramps climb and the tower stops movement', () => {
  const run=play({night:3,ticks:58,scenario:{...empty,player:{pos:[0,3,13]}},
    frames:[{tick:0,move:[1,0]}]});
  assert.equal(snap(run,1).player.vel[2],-8);
  assert.ok(snap(run,52).player.grounded);
  assert.equal(snap(run,52).player.pos[1],6);
  const ramp=play({night:3,ticks:72,scenario:{...empty,player:{pos:[30*Math.cos(Math.PI/6),0,15]}},
    frames:[{tick:0,move:[-Math.cos(Math.PI/6),-.5]}]});
  assert.equal(snap(ramp,70).player.pos[1],3);
  const wall=play({night:3,ticks:60,scenario:{...empty,player:{pos:[0,0,26]}},
    frames:[{tick:0,move:[0,-1]}]});
  assert.equal(snap(wall,60).player.pos[1],0);
  assert.ok(snap(wall,60).player.pos[2]>=24);
  const tower=play({night:3,ticks:60,scenario:{...empty,player:{pos:[0,6,6]}},
    frames:[{tick:0,move:[0,-1]}]});
  assert.ok(snap(tower,60).player.pos[2]>=2);
  const stepOff=play({night:3,ticks:56,scenario:{...empty,player:{pos:[0,6,-7.8]}},
    frames:[{tick:0,move:[0,-1]}]});
  assert.equal(snap(stepOff,56).player.pos[1],0);
});

test('Gió Lạc idles, chases, steals through invulnerability and flees once', () => {
  const run=play({night:2,ticks:260,scenario:{...empty,player:{carried:5,invuln_ticks:90},
    drifters:[{id:'D1',pos:[2,1,0]}]}});
  assert.equal(snap(run,0).drifters[0].state,'idle');
  assert.equal(snap(run,1).drifters[0].state,'chase');
  const steal=events(run,'drifter_steal');
  assert.equal(steal.length,1);
  assert.deepEqual(steal[0].data,{drifter_id:'D1',amount:3,carried:2});
  assert.equal(snap(run,steal[0].tick).player.flames,3);
  assert.equal(snap(run,steal[0].tick).drifters[0].state,'flee');
  assert.equal(snap(run,steal[0].tick+240).drifters.length,0);
});

test('Tỏa Sáng drives a chasing Gió Lạc away and recovers loot from a fleeing one', () => {
  const run=play({night:2,ticks:121,scenario:{...empty,player:{carried:8},
    drifters:[
      {id:'D1',pos:[1,.8,0],state:'chase'},
      {id:'D2',pos:[2,.8,0],state:'flee',stolen:3},
    ]},frames:[{tick:0,pulse:true}]});
  assert.equal(events(run,'drifter_steal').length,0);
  assert.deepEqual(events(run,'drifter_drop')[0].data,{drifter_id:'D2',amount:3});
  assert.equal(snap(run,1).drifters[0].state,'flee');
  assert.equal(snap(run,1).motes.filter(m=>m.kind==='dropped').length,3);
  assert.equal(snap(run,121).drifters.some(d=>d.id==='D2'),false);
});

test('Bùa Gió refreshes for 600 ticks, grants 7.2 m/s and repeat dash, then respawns at 2700', () => {
  const run=play({night:2,ticks:2701,every:1,
    scenario:{...empty,charms:[{id:'C1',pos:[0,0,0]},{id:'C2',pos:[6,0,0]}]},
    frames:[{tick:1,move:[1,0]}, {tick:2,dash:true},{tick:3,dash:false},
      {tick:14,dash:true},{tick:15,dash:false},{tick:30,move:[0,0]}]});
  const picks=events(run,'charm_picked');
  assert.equal(picks[0].tick,1);
  assert.equal(picks[1].data.charm_id,'C2');
  assert.equal(snap(run,picks[1].tick).player.charm_s,10);
  assert.equal(snap(run,2).player.vel[0],7.2);
  assert.deepEqual(events(run,'dash').map(e=>e.tick),[3,15]);
  assert.equal(snap(run,3).player.dash_cd_s,0);
  assert.equal(snap(run,2700).charms[0].available,false);
  assert.equal(snap(run,2701).charms[0].available,true);
});

test('Night 3 wind starts at 1800, adds 2 m/s, ends at 2100 and can be switched off', () => {
  const scenario={...empty,player:{pos:[0,0,-20]},wind_enabled:true};
  const run=play({night:3,ticks:2100,scenario});
  assert.equal(snap(run,1799).wind.active,false);
  assert.equal(snap(run,1800).wind.active,true);
  assert.ok(Number.isInteger(snap(run,1800).wind.dir_deg));
  near(Math.hypot(snap(run,1800).player.vel[0],snap(run,1800).player.vel[2]),2);
  assert.equal(snap(run,2099).wind.active,true);
  assert.equal(snap(run,2100).wind.active,false);
  assert.equal(snap(play({night:3,ticks:1800,every:1800,scenario:{...scenario,wind_enabled:false}}),1800).wind.active,false);
});

test('pause arbitration freezes sim_tick, clock, dash and movement until the resume edge', () => {
  const run=play({ticks:15,frames:[{tick:0,dash:true},{tick:1,pause:true},
    {tick:3,pause:false},{tick:12,pause:true}]});
  const active=snap(run,1);
  for (const tick of [2,4,12]) {
    const paused=snap(run,tick);
    assert.equal(paused.state,'paused');
    assert.equal(paused.sim_tick,active.sim_tick);
    assert.equal(paused.time_left_s,active.time_left_s);
    assert.deepEqual(paused.player,active.player);
  }
  assert.equal(events(run,'paused')[0].tick,2);
  assert.equal(events(run,'resumed')[0].tick,13);
  assert.equal(snap(run,13).sim_tick,2);
});

test('fall is charged once through invulnerability, waits 60 ticks and resets velocity; fatal fall ends', () => {
  const scenario={...empty,player:{pos:[41,-11,0],invuln_ticks:400,carried:6}};
  const run=play({ticks:62,scenario});
  assert.deepEqual(events(run,'player_hit').map(e=>e.data),[{by:'fall',flames:2,dropped:0,lost:6}]);
  assert.ok(snap(run,60).player.pos[1]<-10);
  assert.deepEqual(snap(run,61).player.pos,[0,0,0]);
  assert.deepEqual(snap(run,61).player.vel,[0,0,0]);
  assert.equal(snap(run,61).player.invuln,true);
  const fatal=play({ticks:65,scenario:{...scenario,player:{...scenario.player,flames:1}}});
  assert.equal(fatal.at(-1).ticks,1);
  assert.equal(events(fatal,'game_over')[0].data.reason,'no_flames');
});

test('a lamp newly lit ejects a resident shade for 30 ticks without damage', () => {
  const run=play({ticks:32,scenario:{...empty,player:{carried:10},
    shades:[{pos:[0,1,0]}],lanterns:[{id:'L1',pos:[0,0,0]}]},
    frames:[{tick:0,interact:true}]});
  assert.ok(Math.hypot(...[snap(run,29).shades[0].pos[0],snap(run,29).shades[0].pos[2]])<6);
  assert.ok(Math.hypot(...[snap(run,30).shades[0].pos[0],snap(run,30).shades[0].pos[2]])>=6);
  assert.equal(events(run,'player_hit').length,0);
});

test('night_start and per-night spawn ticks and caps use the selected map', () => {
  for (const night of [1,2,3]) {
    const run=play({night,ticks:5500,every:1,scenario:{wind_enabled:false}});
    assert.deepEqual(events(run,'night_start').map(e=>[e.tick,e.data.night]),[[1,night]]);
    const spawns=events(run,'shade_spawned');
    assert.deepEqual(spawns.slice(0,3).map(e=>e.tick),[300,300,300+t.shade_intervals[night-1]]);
    assert.deepEqual(spawns.map(e=>e.data.id), Array.from({length:t.shade_caps[night-1]},(_,i)=>'S'+(i+1)));
    assert.equal(snap(run,0).lanterns.length,4+night);
    assert.equal(snap(run,0).motes.length,20);
    assert.equal(new Set(snap(run,0).motes.map(m=>m.pos.join(','))).size,20);
    assert.equal(snap(run,239).motes.length,20);
    assert.equal(snap(run,240).motes.length,21);
    assert.ok(snap(run,5500).motes.length<=30);
    assert.equal(snap(run,1199).drifters.length,0);
    assert.equal(snap(run,1200).drifters.length,night===1 ? 0 : 1);
    assert.equal(snap(run,3600).drifters.length,night===1 ? 0 : 2);
  }
});

test('height is checked for pickups and touch; win on the last tick only if alive', () => {
  const run=play({scenario:{...empty,motes:[[0,1.5,0],[0,1.501,0]],
    shades:[{pos:[0,1.6,0]}]}});
  assert.equal(events(run,'mote_picked').length,1);
  assert.equal(events(run,'player_hit').length,0);
  const scenario={...empty,time_left_s:1/60,player:{carried:10},
    lanterns:[{id:'L1',pos:[0,0,0]},...[2,3,4,5].map(i=>({id:'L'+i,lit:true}))]};
  assert.equal(play({scenario,frames:[{tick:0,interact:true}]}).at(-1).state,'won');
  const noFlames={...scenario,player:{flames:0},lanterns:scenario.lanterns.map(l=>({...l,lit:true}))};
  assert.equal(events(play({scenario:noFlames}),'game_over')[0].data.reason,'no_flames');
});

test('full 21600-tick Night 3 settles well within 30s and is byte-identical',()=>{
  const start=performance.now();
  const options={night:3,ticks:21600,every:10};
  const first=invoke(options);
  const elapsed=performance.now()-start;
  assert.equal(first.status,0,first.stderr);
  assert.equal(first.records.at(-1).ticks,21600);
  assert.ok(elapsed<30000,'elapsed '+elapsed+' ms');
  const second=invoke(options);
  assert.equal(second.status,0,second.stderr);
  assert.equal(Buffer.compare(first.bytes,second.bytes),0);
});

test('the default Đảo Bến route can still win without scenario overrides',()=>{
  const {frames}=JSON.parse(readFileSync(join(root,'docs/proof/phase-2/default-win.inputs.json')));
  const run=invoke({seed:1201,frames,ticks:18000,every:600});
  assert.equal(run.status,0,run.stderr);
  assert.equal(events(run.records,'lantern_lit').length,t.lantern_count_night1);
  assert.deepEqual(run.records.at(-1),{type:'end',ticks:13562,state:'won',score:1331});
});
