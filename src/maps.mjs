const Y0 = 0;
const centerA = [0, Y0, 0];
const centerB = [70, Y0, 0];

export const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export function ring(cx, radius, count, offset = 0, y = 0, span = 360) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (offset + i * span / count) * Math.PI / 180;
    return [cx + radius * Math.cos(angle), y, radius * Math.sin(angle)];
  });
}

const rampAngles = [Math.PI / 6, 5 * Math.PI / 6];
export const MAPS = {
  1: {
    islands: [[0, 40]], start: centerA, pads: [], charms: [],
    lanterns: [[0,0,25],[23.8,0,7.7],[14.7,0,-20.2],[-14.7,0,-20.2],[-23.8,0,7.7]],
    motes: [...ring(0, 12, 8), ...ring(0, 33, 16)], shades: ring(0, 37, 12, 15, 1),
  },
  2: {
    islands: [[0, 28], [70, 28]], start: centerA, pads: [
      { pos: [20,0,18], target: centerB, vy: 14, speed: 24 },
      { pos: [50,0,-18], target: centerA, vy: 14, speed: 24 },
    ], charms: [[35,0,0]],
    lanterns: [[0,0,20],[17,0,-10],[-17,0,-10],[70,0,20],[87,0,-10],[53,0,-10]],
    motes: [0,70].flatMap(x => [...ring(x,10,4), ...ring(x,22,8)]),
    shades: [0,70].flatMap(x => ring(x,26,8,22.5,1)),
  },
  3: {
    islands: [[0,45]], start: centerA, pads: [{ pos: [0,3,13], target: [0,3,0], vy: 12, speed: 8 }],
    charms: [[30,0,25],[-30,0,25]], ramps: rampAngles,
    lanterns: [[0,6,6],[18,3,10],[-18,3,10],[35,0,-10],[-35,0,-10],[20,0,-35],[-20,0,-35]],
    motes: [...ring(0,34,18), ...ring(0,18,8,20,3,160), ...ring(0,5,4,45,6)],
    shades: ring(0,43,16,0,1),
  },
};

export function terrain(night, x, z) {
  if (night === 2) {
    return Math.hypot(x,z) <= 28 || Math.hypot(x-70,z) <= 28 ||
      (x >= 26 && x <= 44 && Math.abs(z) <= 2) ? 0 : null;
  }
  const r = Math.hypot(x,z);
  if (night === 1) return r <= 40 ? 0 : null;
  if (r <= 8) return 6;
  if (z > 0 && r >= 12 && r <= 24) return 3;
  for (const angle of rampAngles) {
    const along = x * Math.cos(angle) + z * Math.sin(angle);
    const side = -x * Math.sin(angle) + z * Math.cos(angle);
    if (along >= 23.9 && along <= 30 && Math.abs(side) <= 1.5) {
      return Math.min(3, (30 - along) * 0.5);
    }
  }
  return r <= 45 ? 0 : null;
}

export function climbBlocked(night, from, x, z, y, grounded) {
  if (night !== 3) return false;
  if (y >= 6-1e-8 && Math.hypot(x,z) < 2 && Math.hypot(x,z) <= Math.hypot(from[0],from[2])) return true;
  const floor = terrain(night,x,z);
  if (floor === null || floor <= y + 1e-8) return false;
  const oldFloor = terrain(night,from[0],from[2]);
  if (oldFloor !== null && oldFloor > from[1]+0.25 && floor <= oldFloor) return false;
  return !grounded || oldFloor === null || floor - oldFloor > 0.25;
}
