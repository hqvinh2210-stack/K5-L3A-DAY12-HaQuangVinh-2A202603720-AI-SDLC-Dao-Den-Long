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
const empty = { random_motes: false, random_shades: false };
const events = (run, name) => run.filter(record => record.name === name);
const snap = (run, tick) => run.find(record => record.type === 'snapshot' && record.tick === tick);
const near = (actual, expected, tolerance = 0.001) => assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' ≈ ' + expected);

let serial = 0;
function invoke({ ticks = 1, every = 1, seed = 1234, scenario, frames, brokenInputs, brokenScenario, extra = [] } = {}) {
  const run = ++serial;
  const out = join(temp, run + '.jsonl');
  const args = ['src/headless.mjs', '--seed', String(seed), '--night', '1', '--ticks', String(ticks),
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

test('pickup radius includes boundary, capacity is enforced, and score follows pickups', () => {
  const run = play({ scenario: { ...empty, motes: [
    [t.pickup_radius + 0.01, 0, 0], [t.pickup_radius, 0, 0],
    ...Array.from({ length: t.carry_capacity }, () => [0, 0, 0]),
  ] } });
  assert.equal(events(run, 'mote_picked').length, t.carry_capacity);
  assert.equal(snap(run, 1).player.carried, t.carry_capacity);
  assert.equal(snap(run, 1).motes_active, 2);
  assert.deepEqual(snap(run, 1).motes.map(m => m.id), ['M1', 'M' + (t.carry_capacity + 2)]);
  assert.equal(snap(run, 1).score, t.carry_capacity * t.score.per_mote);
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
  assert.equal(snap(run, 4).score, t.score.per_lantern + t.score.per_mote);
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
    shades: [{ id: 'edge', pos: [t.pulse_radius, 1, 0] },
      { id: 'outside', pos: [0, 1, -(t.pulse_radius + 0.01)] }],
  }, frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 130, pulse: true }] });
  assert.deepEqual(events(run, 'pulse').map(e => e.data), [{ stunned_ids: ['edge'] }]);
  assert.equal(snap(run, 1).player.carried, 0);
  assert.equal(snap(run, 1).score, t.score.per_stun);
  assert.deepEqual(snap(run, 1).shades[0].pos, [t.pulse_radius + t.pulse_push_m, 1, 0]);
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
  for (const item of run.filter(r => r.type === 'snapshot' && r.tick > 0)) {
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
    score: t.score.per_lantern + 24 * t.score.per_second_left + t.flames * t.score.per_flame_left });
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
  assert.ok(a.records[0].motes_active >= t.lantern_count_night1 * t.lantern_cost);
  const spawn = play({ ticks: 2160, every: 2160, scenario: { random_shades: true, shades: [], motes: [] } });
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

test('the default island can be won without scenario overrides', () => {
  const { frames } = JSON.parse(readFileSync(join(root, 'docs/proof/phase-1/default-win.inputs.json')));
  const run = invoke({ seed: 1201, frames, ticks: 18000, every: 600 });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(events(run.records, 'lantern_lit').length, t.lantern_count_night1);
  assert.deepEqual(events(run.records, 'game_over').map(e => e.data), [{ result: 'won', reason: 'all_lit' }]);
  assert.deepEqual(run.records.at(-1), { type: 'end', ticks: 4084, state: 'won', score: 1812 });
});
