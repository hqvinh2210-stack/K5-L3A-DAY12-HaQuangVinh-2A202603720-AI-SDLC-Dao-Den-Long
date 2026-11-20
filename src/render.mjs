import { terrain } from './maps.mjs';

const TAU = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
const polar = (x, z, r, a, y) => [x + r * Math.sin(a), y, z + r * Math.cos(a)];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => {
  const length = Math.hypot(...a) || 1;
  return a.map(v => v / length);
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const rgb = text => [0, 2, 4].map(i => parseInt(text.slice(i, i + 2), 16) / 255);
const tint = (color, n) => color.map(value => value * n);

const colors = Object.fromEntries(Object.entries({
  grass: '2f5d50', base: '345449', pine: '315b4d', pineTip: '4f7860', wood: '6b4a2f',
  bark: '493a40', rock: '526158', path: 'c9b48a', ruin: '62746c', ink: '120a1a',
  violet: '7a3cff', blue: '8fa3b8', cream: 'e3ba72', straw: 'c99552',
  skin: 'efb688', plum: 'c8102e', cloth: 'e8e2d0', silk: 'ffe9b0',
  amber: 'ffb347', spark: 'fff6c2', unlit: '5b5f6e', cloud: '12384a', stunned: '3a3450', gold: 'f2c14e',
}).map(([key, value]) => [key, rgb(value)]));

const vertex = `
attribute vec3 aPosition;
attribute vec3 aColor;
attribute float aGlow;
uniform vec3 uEye;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward;
uniform vec2 uScale;
varying vec3 vPosition;
varying vec3 vColor;
varying float vGlow;
varying float vDepth;
void main() {
  vec3 relative = aPosition - uEye;
  float depth = dot(relative, uForward);
  gl_Position = vec4(dot(relative, uRight) * uScale.x,
    dot(relative, uUp) * uScale.y, 1.002 * depth - 0.603, depth);
  vPosition = aPosition;
  vColor = aColor;
  vGlow = aGlow;
  vDepth = depth;
}
`;

const fragment = `
precision highp float;
uniform vec3 uLamps[7];
uniform float uWarmth;
uniform vec3 uMay;
varying vec3 vPosition;
varying vec3 vColor;
varying float vGlow;
varying float vDepth;
void main() {
  float local = 0.0;
  for (int i = 0; i < 7; i++) {
    vec2 delta = vPosition.xz - uLamps[i].xz;
    local += (1.0 - smoothstep(0.0, 14.0, length(delta))) * uLamps[i].y;
  }
  float small = 1.0 - smoothstep(0.0, 5.0, distance(vPosition, uMay));
  vec3 ambient = vec3(0.58, 0.66, 0.75) + uWarmth * vec3(0.68, 0.62, 0.50);
  vec3 warm = (local * 0.71 + small * 0.36) * vec3(0.54, 0.31, 0.12);
  vec3 color = mix(vColor * ambient + warm, vColor, vGlow);
  vec3 fog = vec3(0.106, 0.137, 0.314);
  float mist = smoothstep(18.0, 125.0, vDepth) * (0.66 - vGlow * 0.61);
  gl_FragColor = vec4(mix(color, fog, mist), 1.0);
}
`;

function shaderProgram(gl) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  return program;
}

function triangle(mesh, a, b, c, color, glow = 0) {
  const normal = unit(cross(sub(b, a), sub(c, a)));
  const light = 0.69 + Math.max(0, dot(normal, [-0.37, 0.88, 0.29])) * 0.34;
  const lit = tint(color, mix(light, 1, glow));
  mesh.push(...a, ...lit, glow, ...b, ...lit, glow, ...c, ...lit, glow);
}

function quad(mesh, a, b, c, d, color, glow) {
  triangle(mesh, a, b, c, color, glow);
  triangle(mesh, a, c, d, color, glow);
}

function column(mesh, x, z, base, height, bottom, top, sides, color, angle = 0, glow = 0) {
  const ceiling = base + height;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU + angle;
    const b = ((i + 1) / sides) * TAU + angle;
    const upperA = polar(x, z, top, a, ceiling);
    const upperB = polar(x, z, top, b, ceiling);
    quad(mesh, polar(x, z, bottom, a, base), polar(x, z, bottom, b, base), upperB, upperA, color, glow);
    if (top > 0) triangle(mesh, [x, ceiling, z], upperA, upperB, color, glow);
  }
}

function orb(mesh, x, y, z, rx, ry, rz, color, glow = 0, sides = 8) {
  const point = (lat, lon) => [x + rx * Math.cos(lat) * Math.sin(lon),
    y + ry * Math.sin(lat), z + rz * Math.cos(lat) * Math.cos(lon)];
  for (let ring = 0; ring < 4; ring++) {
    const bottom = (ring / 4 - 0.5) * Math.PI;
    const top = ((ring + 1) / 4 - 0.5) * Math.PI;
    for (let i = 0; i < sides; i++) {
      const a = i / sides * TAU;
      const b = (i + 1) / sides * TAU;
      quad(mesh, point(bottom, a), point(bottom, b), point(top, b), point(top, a), color, glow);
    }
  }
}

function groundMesh(lanterns, islandRadius) {
  const mesh = [];
  let seed = 2026;
  const rand = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const segments = 68;
  const rings = Array.from({ length: 6 }, (_, ring) => Array.from({ length: segments }, (_, i) => {
    const a = (i + (ring % 2) * 0.21) * TAU / segments;
    const r = (ring + 1) * islandRadius / 6 + (rand() - 0.5) * 2;
    return polar(0, 0, ring === 5 ? islandRadius : r, a, -0.035);
  }));
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    triangle(mesh, [0, -0.035, 0], rings[0][i], rings[0][j], tint(colors.grass, mix(0.87, 1.08, rand())));
    for (let ring = 1; ring < rings.length; ring++) {
      const [inside, outside] = [rings[ring - 1], rings[ring]];
      const tone = tint(colors.grass, mix(0.79, 1.15, rand()));
      triangle(mesh, inside[i], outside[i], outside[j], tone);
      triangle(mesh, inside[i], outside[j], inside[j], tint(tone, mix(0.91, 1.07, rand())));
    }
  }
  let upper = rings.at(-1);
  for (const [radius, height] of [[islandRadius*.94,-2.7],[islandRadius*.76,-7],[islandRadius*.42,-13],[islandRadius*.125,-16]]) {
    const layer = Array.from({ length: segments }, (_, i) => polar(0, 0,
      radius + rand() * 5, i * TAU / segments, height + rand() * 2));
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      triangle(mesh, upper[i], layer[i], layer[j], tint(colors.rock, mix(0.58, 0.98, rand())));
      triangle(mesh, upper[i], layer[j], upper[j], tint(colors.base, mix(0.6, 1.18, rand())));
    }
    upper = layer;
  }
  for (const lamp of lanterns) {
    const [x, elevation, z] = lamp.pos;
    if (elevation > 0) continue;
    const avenue = Math.atan2(x, z);
    const route = Array.from({ length: 17 }, (_, i) => {
      const r = mix(3, Math.hypot(x, z), i / 16);
      const angle = avenue + Math.sin(i / 16 * Math.PI) * 0.17;
      const width = mix(0.63, 0.94, rand());
      return [polar(0, 0, r, angle - width / r, 0.015), polar(0, 0, r, angle + width / r, 0.015)];
    });
    for (let i = 1; i < route.length; i++) {
      quad(mesh, route[i - 1][0], route[i][0], route[i][1], route[i - 1][1], tint(colors.path, mix(0.77, 0.97, rand())));
    }
    for (let i = 0; i < 9; i++) {
      const point = polar(x, z, 3, i / 9 * TAU, 0);
      column(mesh, point[0], point[2], 0, 0.13, 0.5, 0.45, 5, colors.ruin, rand() * TAU);
    }
  }
  for (let i = 0; i < 50; i++) {
    const radius = islandRadius * mix(.67,.98,Math.sqrt(rand()));
    const [x, , z] = polar(0, 0, radius, rand() * TAU, 0);
    if (lanterns.some(lamp => Math.hypot(x - lamp.pos[0], z - lamp.pos[2]) < 4.5)) continue;
    const height = mix(1.5, 4.8, rand());
    column(mesh, x, z, 0, height * 0.65, 0.15, 0.09, 6, colors.bark);
    column(mesh, x, z, height * 0.3, height * 0.64, height * 0.39, 0, 7, tint(colors.pine, mix(0.85, 1.12, rand())));
    column(mesh, x - 0.17, z + 0.12, height * 0.57, height * 0.52, height * 0.28, 0, 7, colors.pineTip);
  }
  for (let i = 0; i < 260; i++) {
    const [x, , z] = polar(0, 0, (islandRadius-1) * Math.sqrt(rand()), rand() * TAU, 0);
    const blade = mix(0.11, 0.48, rand());
    const clump = tint(i % 7 ? colors.pineTip : colors.cream, mix(0.7, 1.2, rand()));
    triangle(mesh, [x - 0.08, 0, z], [x + 0.08, 0, z], [x + blade * 0.37, blade, z + 0.13], clump);
    triangle(mesh, [x, 0, z - 0.09], [x, 0, z + 0.07], [x - 0.11, blade * 0.87, z + 0.1], clump);
  }
  for (let i = 0; i < 45; i++) {
    const [x, , z] = polar(0, 0, islandRadius * mix(.85,.99,rand()), rand() * TAU, 0);
    const r = mix(0.25, 1.05, rand());
    column(mesh, x, z, -0.2, r * 0.8, r, r * 0.5, 5, tint(colors.rock, mix(0.77, 1.28, rand())), rand());
  }
  return mesh;
}


function islandMesh(game) {
  const mesh=[];
  for (const [cx,radius] of game.map.islands) {
    const local=game.lanterns.filter(lamp=>Math.abs(lamp.pos[0]-cx)<=radius)
      .map(lamp=>({pos:[lamp.pos[0]-cx,lamp.pos[1],lamp.pos[2]]}));
    const base=groundMesh(local,radius);
    for (let i=0;i<base.length;i+=7) base[i]+=cx;
    for (const value of base) mesh.push(value);
  }
  if (game.night===2) {
    for (let x=26;x<44;x+=.45) {
      const right=Math.min(44,x+.42);
      quad(mesh,[x,0,-2],[x,0,2],[right,0,2],[right,0,-2],colors.wood);
      quad(mesh,[x,0,-2],[right,0,-2],[right,-.14,-2],[x,-.14,-2],colors.wood);
      quad(mesh,[x,-.14,2],[right,-.14,2],[right,0,2],[x,0,2],colors.wood);
    }
  } else if (game.night===3) {
    column(mesh,0,0,0,6,8,8,48,colors.grass);
    column(mesh,0,0,6,8,2,2,24,colors.wood);
    column(mesh,0,0,14,1.25,2.35,0,12,colors.pine);
    for (let i=0;i<48;i++) {
      const a=i*Math.PI/48,b=(i+1)*Math.PI/48;
      const p=(r,q,y)=>[r*Math.cos(q),y,r*Math.sin(q)];
      quad(mesh,p(12,a,3),p(24,a,3),p(24,b,3),p(12,b,3),colors.grass);
      quad(mesh,p(24,a,0),p(24,b,0),p(24,b,3),p(24,a,3),colors.rock);
      quad(mesh,p(12,b,0),p(12,a,0),p(12,a,3),p(12,b,3),colors.rock);
    }
    for (const sign of [-1,1]) {
      quad(mesh,[12*sign,0,0],[24*sign,0,0],[24*sign,3,0],[12*sign,3,0],colors.rock);
    }
    for (const theta of game.map.ramps) {
      const p=(r,d,y)=>[r*Math.cos(theta)-d*Math.sin(theta),y,r*Math.sin(theta)+d*Math.cos(theta)];
      quad(mesh,p(30,-1.5,.02),p(30,1.5,.02),p(24,1.5,3.02),p(24,-1.5,3.02),colors.path);
      for (const side of [-1.5,1.5]) triangle(mesh,p(30,side,0),p(24,side,0),p(24,side,3),colors.rock);
    }
  }
  for (const {pos:[x,y,z]} of game.map.pads) {
    column(mesh,x,z,y,.05,1,1,16,colors.blue);
    column(mesh,x,z,y+.05,.013,.75,.75,12,colors.gold,0,.45);
  }
  return new Float32Array(mesh);
}

function drawLamp(mesh, lamp) {
  const [x, y, z] = lamp.pos;
  column(mesh, x, z, y + 0.03, 0.23, 1.54, 1.54, 10, colors.ruin);
  column(mesh, x, z, y + 0.26, 0.31, 1.16, 0.82, 8, colors.rock);
  column(mesh, x, z, y + 0.55, 2.11, 0.3, 0.18, 8, colors.wood);
  column(mesh, x, z, y + 2.51, 0.25, 0.64, 0.79, 8, colors.bark);
  column(mesh, x, z, y + 2.76, 0.25, 0.62, 0.86, 8, lamp.lit ? colors.amber : colors.unlit, 0, lamp.lit ? 0.8 : 0);
  column(mesh, x, z, y + 3.01, 0.82, 0.86, 0.77, 8, lamp.lit ? colors.silk : colors.unlit, 0, lamp.lit ? 1 : 0);
  column(mesh, x, z, y + 3.77, 0.21, 1.04, 0.98, 8, colors.wood);
  column(mesh, x, z, y + 3.98, 0.58, 0.98, 0.23, 8, colors.pine);
  column(mesh, x, z, y + 4.55, 0.22, 0.19, 0, 8, colors.cream);
  for (let i = 0; i < 8; i++) {
    const [bx, , bz] = polar(x, z, 0.84, i / 8 * TAU, y);
    column(mesh, bx, bz, y + 2.93, 0.87, 0.044, 0.036, 4, colors.wood);
  }
}

function drawMay(mesh, game, yaw, time) {
  const [x, y, z] = game.player.pos;
  const at = (side, ahead) => [
    x + side * Math.cos(yaw) + ahead * Math.sin(yaw),
    z - side * Math.sin(yaw) + ahead * Math.cos(yaw),
  ];
  const lanternSway = 0.12 * Math.sin(time * 3.8);
  const [lx, lz] = at(0.6, lanternSway);
  orb(mesh, x, Math.min(y,terrain(game.night,x,z) ?? y) + .028, z, 0.65, 0.02, 0.52, colors.base, 0, 10);
  for (const side of [-1, 1]) {
    const [fx, fz] = at(side * 0.23, side * (game.walking ? Math.sin(time * 12) * 0.21 : 0));
    column(mesh, fx, fz, y + 0.06, 0.48, 0.13, 0.12, 6, colors.bark);
    const [ax, az] = at(side * 0.45, 0.02);
    orb(mesh, ax, y + 0.86, az, 0.14, 0.32, 0.16, colors.cloth);
  }
  column(mesh, x, z, y + 0.45, 0.7, 0.49, 0.34, 8, colors.cloth, yaw);
  column(mesh, x, z, y + 0.61, 0.13, 0.46, 0.44, 8, colors.plum, yaw);
  orb(mesh, x, y + 1.36, z, 0.31, 0.35, 0.31, colors.skin);
  const [hx, hz] = at(0, -0.14);
  orb(mesh, hx, y + 1.4, hz, 0.32, 0.35, 0.25, colors.bark);
  column(mesh, x, z, y + 1.57, 0.055, 0.78, 0.72, 14, colors.straw, yaw);
  column(mesh, x, z, y + 1.622, 0.46, 0.72, 0, 14, colors.cream, yaw);
  column(mesh, lx, lz, y + 1.16, 0.45, 0.019, 0.019, 4, colors.wood);
  column(mesh, lx, lz, y + 0.94, 0.28, 0.112, 0.14, 6, colors.silk, time, 1);
  return [lx, y + 1.08, lz];
}

function drawShade(mesh, shade, time, index) {
  const [x, y, z] = shade.pos;
  const wobble = Math.sin(time * 3.1 + index);
  const stunned = shade.state === 'stunned';
  const middle = y + wobble * 0.18;
  orb(mesh, x, middle + 0.22, z, 0.62 + 0.06 * wobble, stunned ? 0.47 : 0.88, 0.59,
    stunned ? colors.stunned : colors.ink);
  for (let i = 0; i < 5; i++) {
    const [tx, , tz] = polar(x, z, 0.48, i * TAU / 5 + time * 0.7, 0);
    orb(mesh, tx, middle - 0.4 + Math.sin(i + time * 4) * 0.165, tz, 0.22, 0.42, 0.22, colors.ink, 0, 5);
  }
  orb(mesh, x, middle + 0.49, z, 0.20, 0.22, 0.22, stunned ? colors.stunned : colors.violet, 0.82);
}

function cameraFor(yaw, focus, aspect, intro) {
  const direction = [Math.sin(yaw), 0, Math.cos(yaw)];
  const side = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const target = intro ? [focus[0] - side[0] * 15, 1.2, focus[2] - side[2] * 15] : [focus[0], 0.6 + focus[1], focus[2]];
  const distance = intro ? 47 : 15;
  const eye = [target[0] - direction[0] * distance, intro ? 27 : 11 + focus[1], target[2] - direction[2] * distance];
  const forward = unit(sub(target, eye));
  const right = unit(cross([0, 1, 0], forward));
  const up = cross(forward, right);
  const scaleY = 1 / Math.tan((intro ? 49 : 52) * Math.PI / 360);
  return { eye, forward, right, up, scale: [scaleY / aspect, scaleY] };
}

function glow(ctx, x, y, radius, color, alpha) {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, radius);
  halo.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
  halo.addColorStop(0.28, 'rgba(' + color + ',' + alpha * 0.42 + ')');
  halo.addColorStop(1, 'rgba(' + color + ',0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export function createRenderer(canvas, effects, template) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
  const ctx = effects.getContext('2d');
  if (!gl || !ctx) throw new Error('WebGL unavailable');
  const program = shaderProgram(gl);
  const attributes = ['aPosition', 'aColor', 'aGlow'].map(name => gl.getAttribLocation(program, name));
  const uniforms = Object.fromEntries(['Eye', 'Right', 'Up', 'Forward', 'Scale', 'Lamps[0]', 'Warmth', 'May']
    .map(name => [name, gl.getUniformLocation(program, 'u' + name)]));
  const islands=new Map();
  const objects=gl.createBuffer();
  const lampMeshes=new Map();
  function loadGround(game) {
    if (!islands.has(game.night)) {
      const vertices=islandMesh(game);
      const buffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
      islands.set(game.night,{buffer,count:vertices.length/7});
    }
    return islands.get(game.night);
  }
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  for (const attribute of attributes) gl.enableVertexAttribArray(attribute);

  const stars = Array.from({ length: 74 }, (_, i) => [
    ((i * 0.61803398875) % 1), ((i * 0.381833) % 1) * 0.69, 0.55 + (i % 7) * 0.13,
  ]);

  function draw(buffer, count) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(attributes[0], 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(attributes[1], 3, gl.FLOAT, false, 28, 12);
    gl.vertexAttribPointer(attributes[2], 1, gl.FLOAT, false, 28, 24);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }

  return function render(game, view, now) {
    const ratio = Math.min(1.5, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height || effects.width !== width || effects.height !== height) {
      canvas.width = effects.width = width;
      canvas.height = effects.height = height;
    }
    const time = now / 1000;
    const cam = cameraFor(view.yaw, view.focus, width / height, view.intro);
    function project(pos) {
      const delta = sub(pos, cam.eye);
      const depth = dot(delta, cam.forward);
      if (depth < 0.4) return null;
      return [(0.5 + 0.5 * dot(delta, cam.right) * cam.scale[0] / depth) * width,
        (0.5 - 0.5 * dot(delta, cam.up) * cam.scale[1] / depth) * height, depth];
    }

    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (const [key, value] of Object.entries({ Eye: cam.eye, Right: cam.right, Up: cam.up, Forward: cam.forward })) {
      gl.uniform3fv(uniforms[key], value);
    }
    gl.uniform2fv(uniforms.Scale, cam.scale);
    const lights=Array.from({length:7},(_,i)=>{
      const l=game.lanterns[i];
      return l ? [l.pos[0],Number(l.lit),l.pos[2]] : [0,0,0];
    }).flat();
    gl.uniform3fv(uniforms['Lamps[0]'],lights);
    gl.uniform1f(uniforms.Warmth,.15+.55*game.lanterns.filter(l=>l.lit).length/game.lanterns.length);
    const mesh=[];
    for (const l of game.lanterns) {
      const key=game.night+':'+l.id+':'+l.lit;
      if (!lampMeshes.has(key)) {
        const vertices=[];
        drawLamp(vertices,l);
        lampMeshes.set(key,vertices);
      }
      mesh.push(...lampMeshes.get(key));
    }
    for (const d of game.drifters) {
      const [x,y,z]=d.pos;
      const point=(i,side)=>[x+i*.27,y+Math.sin(time*6+i*.7)*.19+side*.14,z+Math.cos(time*4+i*.55)*.25];
      for (let i=0;i<9;i++) quad(mesh,point(i,-1),point(i+1,-1),point(i+1,1),point(i,1),colors.blue,.54);
    }
    for (const c of game.charms) {
      if (game.sim_tick<c.availableAt) continue;
      const [x,y,z]=c.pos;
      column(mesh,x,z,y+.37,.62,.28,.28,4,colors.gold,time,.72);
      column(mesh,x,z,y+.41,.54,.31,.31,4,colors.plum,time,.58);
    }
    const mayLight = drawMay(mesh, { ...game, walking: view.walking }, view.heading, time);
    gl.uniform3fv(uniforms.May, mayLight);

    for (let i = 0; i < game.shades.length; i++) drawShade(mesh, game.shades[i], time, i);
    const motes = game.motes.map((mote, i) => [
      mote.pos[0] + Math.sin(time * 2 + i) * 0.17,
      mote.pos[1] + 0.62 + Math.sin(time * 2.8 + i * 2.3) * 0.22,
      mote.pos[2] + Math.cos(time * 2 + i) * 0.17,
    ]);

    for (const [x,y,z] of motes) {
      quad(mesh,[x-.16,y,z],[x,y+.2,z],[x+.16,y,z],[x,y-.2,z],colors.spark,1);
      quad(mesh,[x,y,z-.16],[x,y+.2,z],[x,y,z+.16],[x,y-.2,z],colors.spark,1);
    }

    const ground=loadGround(game);
    draw(ground.buffer,ground.count);
    gl.bindBuffer(gl.ARRAY_BUFFER, objects);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh), gl.DYNAMIC_DRAW);
    draw(objects, mesh.length / 7);

    ctx.clearRect(0, 0, width, height);
    for (const [x, y, size] of stars) {
      ctx.fillStyle = 'rgba(229,233,216,' + (0.13 + size * 0.14) + ')';
      if (!view.intro && y > 0.24) continue;
      if (view.intro && y > 0.18 && x > 0.45) continue;
      ctx.fillRect(x * width, y * height, size * ratio, size * ratio);
    }

    for (const [x, y] of [[0.94, 0.19], [0.49, 0.17], [0.4, 0.72], [0.95, 0.74], [0.69, 0.91]]) {
      ctx.save();
      ctx.translate(x * width, y * height);
      ctx.scale(2.7, 0.45);
      glow(ctx, 0, 0, Math.max(140, width * 0.13), '176,195,198', 0.12);
      ctx.restore();
    }

    function halo(pos, worldRadius, color, alpha) {
      const projection = project(pos);
      if (!projection) return;
      const [x, y, depth] = projection;
      const radius = clamp(worldRadius * height / depth, 4, 154);
      if (x < -radius || y < -radius || x > width + radius || y > height + radius) return;
      glow(ctx, x, y, radius, color, alpha);
    }
    halo(mayLight, 0.55, '255,167,75', 0.56);
    for (const mote of motes) halo(mote, 0.47, '255,229,138', 0.57);
    for (const lamp of game.lanterns) {
      if (!lamp.lit) continue;
      const [x, y, z] = lamp.pos;
      halo([x, y + 3.4, z], 3.1, '255,170,78', 0.57);
      // Cosmetic orbit, drawn only by the graphical renderer.
      for (let i = 0; i < 8; i++) {
        const angle = time * 0.8 + i / 8 * TAU;
        const point = polar(x, z, 1.6 + 0.13 * i, angle, y + 2.2 + 0.45 * i + Math.sin(angle) * 0.25);
        halo(point, 0.23, '255,220,144', 0.72);
      }
    }
    const leaves=game.wind.active || game.windWarn;
    if (leaves) {
      const a=(game.wind.dir_deg ?? 30)*Math.PI/180;
      ctx.fillStyle='#e8df9c88';
      for (let i=0;i<24;i++) {
        const t=(time*.45+i*.618)%1-.5;
        ctx.fillRect(width*((i*.417)%1+t*Math.cos(a)*.55),height*((i*.267)%1+t*Math.sin(a)*.38),7,2);
      }
    }
    if (!view.intro && game.state==='playing') {
      const p=game.player.pos;
      const range=l=>Math.hypot(l.pos[0]-p[0],l.pos[2]-p[2]);
      const lamp=game.lanterns.filter(l=>!l.lit).sort((a,b)=>range(a)-range(b))[0];
      if (lamp) {
        const pt=project([lamp.pos[0],lamp.pos[1]+3,lamp.pos[2]]);
        if (!pt || pt[0]<35 || pt[0]>width-35 || pt[1]<90 || pt[1]>height-85) {
          const delta=sub(lamp.pos,p);
          const theta=Math.atan2(dot(delta,cam.right),dot(delta,cam.forward));
          const ax=Math.sin(theta),ay=-Math.cos(theta);
          const f=Math.min((width/2-37)/Math.max(.001,Math.abs(ax)),(height/2-104)/Math.max(.001,Math.abs(ay)));
          ctx.save();
          ctx.translate(width/2+ax*f,height/2+ay*f);
          ctx.rotate(theta);
          ctx.fillStyle='#f2c14e';
          ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(9,10);ctx.lineTo(0,6);ctx.lineTo(-9,10);ctx.closePath();ctx.fill();
          ctx.restore();
        }
      }
    }
    if (view.pulse && now - view.pulse.at < 580) {
      const progress = clamp((now - view.pulse.at) / 580, 0, 1);
      const [x, , z] = view.pulse.pos;
      ctx.beginPath();
      let first = true;
      for (let i = 0; i <= 64; i++) {
        const p = project(polar(x, z, 0.4 + progress * game.tuning.pulse_radius, i / 64 * TAU, 0.14));
        if (!p) continue;
        if (first) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
        first = false;
      }
      ctx.strokeStyle = 'rgba(255,193,99,' + (1 - progress) + ')';
      ctx.lineWidth = (3 - progress * 2) * ratio;
      ctx.stroke();
    }
  };
}
