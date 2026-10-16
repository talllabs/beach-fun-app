// NOAA timestamps are requested in GMT; convert to UTC before displaying Pacific time.
export function utcDate(date) { return date.toISOString().slice(0,10).replaceAll('-',''); }
export function pacificTime(date) {
  return new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date);
}
export function nextTides(predictions, now) {
  const future=predictions.map(p=>({...p,date:new Date(p.t.replace(' ','T')+'Z')})).filter(p=>p.date>now).sort((a,b)=>a.date-b.date);
  return {high:future.find(p=>p.type==='H'),low:future.find(p=>p.type==='L')};
}
