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

// ---- Location matching ----
const toRad = deg => deg * Math.PI / 180;
export function distanceMiles(a, b) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}
export function byDistance(beach, stations) {
  const here = {lat:beach.latitude, lng:beach.longitude};
  return stations.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .map(s => ({...s, miles:distanceMiles(here, s)})).sort((a,b) => a.miles - b.miles);
}
export function miles(value) { return value < 0.1 ? 'under 0.1 mi' : `${value < 10 ? value.toFixed(1) : Math.round(value)} mi`; }
// Water quality stations: a pinned id wins if it is still close; otherwise the nearest active station.
export const LOCAL_SAMPLE_MILES = 0.5, NEARBY_SAMPLE_MILES = 4;
export function qualityMatch(beach, locations) {
  const ranked = byDistance(beach, locations.filter(l => l.active !== false));
  const pinned = beach.qualityStation && ranked.find(l => String(l.id) === String(beach.qualityStation));
  const station = pinned || ranked[0];
  if (!station || station.miles > NEARBY_SAMPLE_MILES) return {kind:'none', station};
  return {kind: station.miles <= LOCAL_SAMPLE_MILES ? 'local' : 'nearby', station};
}
export function shortStationName(title = '') {
  return String(title).split(/\s+-\s+/).pop().trim() || String(title);
}
// ---- Freshness ----
export function ageText(date, now = new Date()) {
  const minutes = Math.round((now - date) / 60000);
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60); if (hours < 36) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}
// A bare date or UTC midnight is a calendar day, not a moment (see testedDate).
export function sampleDay(value) {
  const day = /^(\d{4}-\d{2}-\d{2})(T00:00(:00(\.0+)?)?(Z|\+00:00)?)?$/.exec(String(value ?? ''));
  const date = new Date(day ? `${day[1]}T12:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}
// ---- Wind & swell ----
const POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export function compass(deg) { return Number.isFinite(deg) ? POINTS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16] : ''; }
// windFrom: direction the wind blows from. facing: compass direction the beach faces out to sea.
export function windRelation(windFrom, facing) {
  if (!Number.isFinite(windFrom) || !Number.isFinite(facing)) return '';
  const diff = Math.abs(((windFrom - facing) % 360 + 540) % 360 - 180);
  return diff <= 45 ? 'Onshore' : diff >= 135 ? 'Offshore' : 'Cross-shore';
}
function average(values) { const v = values.filter(Number.isFinite); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : NaN; }
function circularAverage(values) {
  const v = values.filter(Number.isFinite); if (!v.length) return NaN;
  const x = average(v.map(d=>Math.cos(toRad(d)))), y = average(v.map(d=>Math.sin(toRad(d))));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
// Morning 6-11am and afternoon 12-5pm, from hourly series already in Pacific local time.
export function dayparts(marineHourly, windHourly, day) {
  const pick = (hourly, key, from, to) => (hourly?.time || []).map((t,i)=>[t,hourly[key]?.[i]])
    .filter(([t]) => t.startsWith(day) && +t.slice(11,13) >= from && +t.slice(11,13) <= to).map(([,v]) => v);
  const part = (from, to) => ({
    swell: average(pick(marineHourly,'swell_wave_height',from,to)), period: average(pick(marineHourly,'swell_wave_period',from,to)),
    wind: average(pick(windHourly,'wind_speed_10m',from,to)), windFrom: circularAverage(pick(windHourly,'wind_direction_10m',from,to))
  });
  return {morning: part(6, 11), afternoon: part(12, 17)};
}
export function gradeLevel(grade) { return {A:'good', B:'fair', C:'fair'}[String(grade)[0]] || 'poor'; }
// ---- Drive times ----
export function driveText(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} min drive` : `${Math.floor(minutes / 60)} hr ${minutes % 60 ? `${minutes % 60} min ` : ''}drive`;
}
export function chunks(list, size) { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; }
// Rounded to ~100 m before leaving the device; precise location is never sent or stored.
export function roundedOrigin(coords) { return {lat:Math.round(coords.latitude * 1000) / 1000, lng:Math.round(coords.longitude * 1000) / 1000}; }
