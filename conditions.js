// NOAA timestamps are requested in GMT; convert to UTC before displaying Pacific time.
export function utcDate(date) { return date.toISOString().slice(0,10).replaceAll('-',''); }
export function pacificTime(date) {
  return new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date);
}
export function nextTides(predictions, now) {
  const future=predictions.map(p=>({...p,date:new Date(p.t.replace(' ','T')+'Z')})).filter(p=>p.date>now).sort((a,b)=>a.date-b.date);
  return {high:future.find(p=>p.type==='H'),low:future.find(p=>p.type==='L')};
}
// Heal the Bay grades: "ns" (not sampled) or anything unexpected means no recent test.
export function waterGrade(source) {
  const grade = String(source?.dry_grade ?? '').trim().toUpperCase();
  return /^[A-F][+-]?$/.test(grade) ? grade : null;
}
// Sample dates arrive as ISO strings; a bare date or UTC midnight is a calendar day, not a moment.
export function testedDate(value) {
  const text = String(value ?? '');
  const day = /^(\d{4}-\d{2}-\d{2})(T00:00(:00(\.0+)?)?(Z|\+00:00)?)?$/.exec(text);
  const date = new Date(day ? `${day[1]}T12:00:00Z` : text);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US',{timeZone:day?'UTC':'America/Los_Angeles',month:'short',day:'numeric'}).format(date);
}
