const offsetDate=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?[+-]\d\d:\d\d$/;

export function normalizeName(value) {
  if (typeof value!=='string') return null;
  const name=value.trim().normalize('NFC');
  return /^[\p{L}0-9_]{3,12}$/u.test(name) ? name : null;
}

export function validEntry(value) {
  return value && typeof value.name==='string' && normalizeName(value.name)===value.name &&
    Number.isSafeInteger(value.score) && value.score>=0 &&
    Number.isInteger(value.nights_won) && value.nights_won>=0 && value.nights_won<=3 &&
    typeof value.achieved_at==='string' && offsetDate.test(value.achieved_at) &&
    Number.isFinite(Date.parse(value.achieved_at)) && Number.isSafeInteger(value.seed);
}

export function topScores(entries) {
  return entries.filter(validEntry).sort((a,b)=>b.score-a.score ||
    Date.parse(a.achieved_at)-Date.parse(b.achieved_at)).slice(0,10);
}

export function timestampWithOffset(date=new Date()) {
  const offset=-date.getTimezoneOffset();
  const pad=value=>String(Math.abs(value)).padStart(2,'0');
  const shifted=new Date(date.getTime()+offset*60000);
  return shifted.toISOString().slice(0,-1)+(offset<0 ? '-' : '+')+
    pad(Math.trunc(offset/60))+':'+pad(offset%60);
}
