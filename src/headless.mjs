import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { IDLE, createGame, snapshot, stepGame } from './sim.mjs';

class FileFormatError extends Error {}

const options = new Set(['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every']);
function integer(value, name, min) {
  if (!/^-?\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value)) || Number(value) < min) {
    throw new Error('Invalid --' + name);
  }
  return Number(value);
}

function argumentsFrom(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (!argv[i].startsWith('--') || !options.has(key) || key in args || !value || value.startsWith('--')) {
      throw new Error('Invalid option: ' + argv[i]);
    }
    args[key] = value;
  }
  const seed = integer(args.seed, 'seed', Number.MIN_SAFE_INTEGER);
  if (integer(args.night, 'night', 1) !== 1) throw new Error('Only --night 1 is supported');
  const ticks = integer(args.ticks, 'ticks', 0);
  const every = integer(args['snapshot-every'] ?? '10', 'snapshot-every', 1);
  if (!args.out) throw new Error('Missing --out');
  return { ...args, seed, ticks, every };
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = Number.isFinite;
const boolean = value => typeof value === 'boolean';
const coordinates = value => Array.isArray(value) && value.length === 3 && value.every(finite);
const natural = max => value => Number.isSafeInteger(value) && value >= 0 && value <= max;

function requireField(valid, path) {
  if (!valid) throw new FileFormatError('Invalid ' + path);
}

function optional(source, key, check, path) {
  if (Object.hasOwn(source, key)) requireField(check(source[key]), path + '.' + key);
}

function validateScenario(scenario, tuning) {
  requireField(object(scenario), 'scenario');
  if (Object.hasOwn(scenario, 'player')) {
    const player = scenario.player;
    requireField(object(player), 'scenario.player');
    optional(player, 'pos', coordinates, 'scenario.player');
    optional(player, 'carried', natural(tuning.carry_capacity), 'scenario.player');
    optional(player, 'flames', natural(tuning.flames), 'scenario.player');
  }
  optional(scenario, 'random_motes', boolean, 'scenario');
  optional(scenario, 'random_shades', boolean, 'scenario');
  optional(scenario, 'time_left_s', value => finite(value) && value >= 0, 'scenario');
  optional(scenario, 'motes', value => Array.isArray(value) && value.every(coordinates), 'scenario');
  optional(scenario, 'shades', Array.isArray, 'scenario');
  optional(scenario, 'lanterns', Array.isArray, 'scenario');
  const shadeIds = new Set();
  for (const [i, shade] of (scenario.shades ?? []).entries()) {
    const path = 'scenario.shades[' + i + ']';
    requireField(object(shade) && coordinates(shade.pos), path);
    optional(shade, 'id', id => typeof id === 'string' && id.length > 0 && !shadeIds.has(id), path);
    if (shade.id !== undefined) shadeIds.add(shade.id);
  }
  const lampIds = new Set(Array.from({ length: tuning.lantern_count_night1 }, (_, i) => 'L' + (i + 1)));
  for (const [i, lamp] of (scenario.lanterns ?? []).entries()) {
    const path = 'scenario.lanterns[' + i + ']';
    requireField(object(lamp) && lampIds.delete(lamp.id), path + '.id');
    optional(lamp, 'pos', coordinates, path);
    optional(lamp, 'lit', boolean, path);
    optional(lamp, 'deposited', natural(tuning.lantern_cost), path);
  }
  return scenario;
}

function validateInputs(inputs) {
  requireField(object(inputs) && Array.isArray(inputs.frames), 'inputs.frames');
  let previous = -1;
  for (const [i, frame] of inputs.frames.entries()) {
    const path = 'inputs.frames[' + i + ']';
    requireField(object(frame) && Number.isSafeInteger(frame.tick) && frame.tick > previous, path + '.tick');
    optional(frame, 'move', v => Array.isArray(v) && v.length === 2 &&
      v.every(n => finite(n) && n >= -1 && n <= 1), path);
    optional(frame, 'cam_yaw_deg', finite, path);
    for (const button of ['jump', 'interact', 'pulse']) optional(frame, button, boolean, path);
    previous = frame.tick;
  }
  return inputs.frames;
}

async function inputFile(path) {
  const content = await readFile(path, 'utf8');
  try {
    return JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new FileFormatError(path + ': ' + error.message);
  }
}

function* lines(game, frames, args) {
  const line = value => JSON.stringify(value) + '\n';
  const input = { ...IDLE };
  let index = 0;
  yield line(snapshot(game));
  while (game.tick < args.ticks && game.state === 'playing') {
    if (frames[index]?.tick === game.tick) {
      const frame = frames[index++];
      for (const key of Object.keys(IDLE)) {
        if (Object.hasOwn(frame, key)) input[key] = frame[key];
      }
    }
    for (const event of stepGame(game, input)) yield line(event);
    if (game.tick % args.every === 0) yield line(snapshot(game));
  }
  yield line({ type: 'end', ticks: game.tick, state: game.state, score: game.score });
}

try {
  const args = argumentsFrom(process.argv.slice(2));
  const { tuning } = JSON.parse(await readFile(new URL('../game.contract.json', import.meta.url), 'utf8'));
  const scenario = args.scenario ? validateScenario(await inputFile(args.scenario), tuning) : {};
  const frames = args.inputs ? validateInputs(await inputFile(args.inputs)) : [];
  await pipeline(lines(createGame(tuning, args.seed, scenario), frames, args), createWriteStream(args.out));
} catch (error) {
  console.error(error.message);
  process.exitCode = error instanceof FileFormatError ? 2 : 1;
}
