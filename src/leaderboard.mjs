import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { topScores, validEntry } from './scores.mjs';

export function createLeaderboard(path=process.env.LANTERN_LEADERBOARD ??
  join(homedir(),'.dao-den-long','leaderboard.json')) {
  let queue=Promise.resolve();

  async function read() {
    try {
      const data=JSON.parse(await readFile(path,'utf8'));
      if (!Array.isArray(data.entries)) throw new Error('Invalid leaderboard file');
      return {entries:topScores(data.entries)};
    } catch (error) {
      if (error.code==='ENOENT') return {entries:[]};
      throw error;
    }
  }

  function add(entry) {
    if (!validEntry(entry)) throw new TypeError('Invalid score');
    const pending=queue.then(async ()=>{
      const {entries}=await read();
      const clean={name:entry.name,score:entry.score,nights_won:entry.nights_won,
        achieved_at:entry.achieved_at,seed:entry.seed};
      const result={entries:topScores([...entries,clean])};
      await mkdir(dirname(path),{recursive:true});
      const temp=path+'.'+randomUUID()+'.tmp';
      try {
        await writeFile(temp,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
        await rename(temp,path);
      } finally {
        await rm(temp,{force:true});
      }
      return result;
    });
    queue=pending.catch(()=>{});
    return pending;
  }

  return {read,add};
}
