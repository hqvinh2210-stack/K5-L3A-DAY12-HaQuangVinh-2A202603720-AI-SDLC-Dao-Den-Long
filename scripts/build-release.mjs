import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const target=resolve(root,process.argv[2] ?? 'dist/dao-den-long-v1.0.0');
const files=[
  'index.html','game.contract.json','package.json','package-lock.json','LICENSE','CREDITS.md',
  'src/style.css','src/client.mjs','src/render.mjs','src/maps.mjs','src/audio.mjs','src/sim.mjs',
  'src/serve.mjs','src/settings.mjs','src/scores.mjs','src/leaderboard.mjs','src/leaderboard-ui.mjs',
  'src/headless.mjs','src/run-args.mjs','src/bench.mjs','src/bench-page.mjs','src/bench-metrics.mjs','src/soak.mjs',
];

for (const file of files) {
  const out=resolve(target,file);
  await mkdir(dirname(out),{recursive:true});
  await copyFile(resolve(root,file),out);
}
await copyFile(resolve(root,'docs/release/CHAY.md'),resolve(target,'CHAY.md'));
console.log('Bản web sẵn sàng tại '+target);
