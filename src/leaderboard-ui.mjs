import { normalizeName, timestampWithOffset, topScores } from './scores.mjs';

const localKey='dao-den-long-scores';
const number=new Intl.NumberFormat('vi-VN');
const date=new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'});

function browserScores() {
  const saved=JSON.parse(localStorage.getItem(localKey)??'{"entries":[]}');
  return topScores(Array.isArray(saved.entries) ? saved.entries : []);
}

async function readScores() {
  const response=await fetch('/api/leaderboard');
  const isJson=response.headers.get('content-type')?.includes('application/json');
  if ([404,405,501].includes(response.status) || (response.ok && !isJson)) {
    return {entries:browserScores(),local:true};
  }
  if (!response.ok) throw new Error('Score API failed');
  return response.json();
}

async function addScore(entry) {
  const board=await readScores();
  if (board.local) {
    localStorage.setItem(localKey,JSON.stringify({entries:topScores([...board.entries,entry])}));
    return;
  }
  const response=await fetch('/api/leaderboard',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)});
  if (!response.ok) throw new Error('Score API failed');
}

export function scoreUI() {
  const $=id=>document.getElementById(id);
  const form=$('score-form');
  const input=$('score-name');
  const status=$('score-status');
  const save=$('save-score');
  let result;

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (!result || save.disabled) return;
    const name=normalizeName(input.value);
    if (name===null) {
      status.textContent='Tên phải có 3–12 chữ cái, chữ số hoặc dấu gạch dưới.';
      input.setAttribute('aria-invalid','true');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    save.disabled=true;
    const current=result;
    try {
      await addScore({...current,name,achieved_at:timestampWithOffset()});
      if (result===current) {
        input.disabled=true;
        status.textContent='Đã lưu điểm.';
      }
    } catch {
      if (result===current) {
        status.textContent='Không lưu được điểm. Hãy thử lại.';
        save.disabled=false;
      }
    }
  });

  return {
    offer(entry,name) {
      result=entry;
      form.hidden=!entry;
      input.value=normalizeName(name)??'';
      input.removeAttribute('aria-invalid');
      input.disabled=false;
      save.disabled=false;
      status.textContent=entry ? 'Tổng điểm để lưu · '+number.format(entry.score) : '';
    },
    async show() {
      const list=$('leaderboard-entries');
      const status=$('leaderboard-status');
      list.replaceChildren();
      status.textContent='Đang đọc điểm…';
      try {
        const {entries}=await readScores();
        status.textContent=entries.length ? '' : 'Chưa có điểm nào được lưu.';
        for (const entry of entries) {
          const row=document.createElement('li');
          const name=document.createElement('strong');
          name.textContent=entry.name;
          const stats=document.createElement('span');
          stats.textContent=number.format(entry.score)+' điểm · '+entry.nights_won+'/3 đêm';
          const time=document.createElement('time');
          time.dateTime=entry.achieved_at;
          time.textContent=date.format(new Date(entry.achieved_at));
          row.append(name,stats,time);
          list.append(row);
        }
      } catch {
        status.textContent='Không đọc được bảng xếp hạng.';
      }
    },
  };
}
