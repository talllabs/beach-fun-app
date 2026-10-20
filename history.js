// Daily history recorded by .github/workflows/record-history.yml into data/history/YYYY-MM.json.
// Nothing is ever deleted: each month stays in its own archive file.
import { gradeLevel } from './conditions.js';

const SVG = 'http://www.w3.org/2000/svg';
let historyRequest;
function loadHistory() {
  historyRequest ||= (async () => {
    const index = await (await fetch('./data/history/index.json', {cache:'no-cache'})).json();
    const months = await Promise.all((index.months || []).map(async m => (await (await fetch(`./data/history/${m}.json`, {cache:'no-cache'})).json()).records || []));
    return months.flat();
  })().catch(error => { historyRequest = undefined; throw error; });
  return historyRequest;
}
function node(tag, attrs = {}, text) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}
function html(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
const dayLabel = day => new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(`${day}T12:00:00Z`));
const dayValue = day => new Date(`${day}T12:00:00Z`).getTime();

function xScale(days, left, width) {
  const t = days.map(dayValue), min = Math.min(...t), max = Math.max(...t);
  return day => max === min ? left + width / 2 : left + (dayValue(day) - min) / (max - min) * width;
}
function tempChart(rows) {
  const W = 360, H = 150, L = 34, R = 10, T = 12, B = 24, w = W - L - R, h = H - T - B;
  const values = rows.map(r => r.temp.value);
  let lo = Math.floor(Math.min(...values) - 1), hi = Math.ceil(Math.max(...values) + 1);
  if (hi - lo < 4) { lo -= 2; hi += 2; }
  const x = xScale(rows.map(r => r.date), L, w), y = v => T + (hi - v) / (hi - lo) * h;
  const svg = node('svg', {viewBox:`0 0 ${W} ${H}`, class:'chart', role:'img', 'aria-label':`Daily water temperature, ${rows.length} reading${rows.length === 1 ? '' : 's'}`});
  for (const v of [lo, (lo + hi) / 2, hi]) {
    svg.append(node('line', {x1:L, x2:W - R, y1:y(v), y2:y(v), class:'grid'}), node('text', {x:L - 8, y:y(v) + 4, class:'axis', 'text-anchor':'end'}, `${Math.round(v)}°`));
  }
  if (rows.length > 1) svg.append(node('path', {d:rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.date).toFixed(1)},${y(r.temp.value).toFixed(1)}`).join(''), class:'line'}));
  for (const r of rows) {
    const tip = `${dayLabel(r.date)}: ${r.temp.value.toFixed(1)}°F · ${r.temp.station}${r.temp.regional ? ' (regional)' : ''}`;
    svg.append(node('circle', {cx:x(r.date), cy:y(r.temp.value), r:4, class:'dot'}));
    const hit = node('circle', {cx:x(r.date), cy:y(r.temp.value), r:12, class:'hit', tabindex:'0'}); hit.append(node('title', {}, tip)); svg.append(hit);
  }
  const first = rows[0].date, last = rows.at(-1).date;
  svg.append(node('text', {x:x(first), y:H - 8, class:'axis', 'text-anchor':rows.length > 1 ? 'start' : 'middle'}, dayLabel(first)));
  if (last !== first) svg.append(node('text', {x:x(last), y:H - 8, class:'axis', 'text-anchor':'end'}, dayLabel(last)));
  return svg;
}
function gradeStrip(rows) {
  const W = 360, H = 52, L = 34, R = 10, w = W - L - R, x = xScale(rows.map(r => r.date), L, w);
  const size = Math.max(6, Math.min(22, w / rows.length - 3)), letters = size >= 14;
  const svg = node('svg', {viewBox:`0 0 ${W} ${H}`, class:'chart', role:'img', 'aria-label':`Daily water quality grades, ${rows.length} day${rows.length === 1 ? '' : 's'}`});
  
  for (const r of rows) {
    const level = r.grade?.grade ? gradeLevel(r.grade.grade) : 'none', cx = x(r.date);
    const g = node('g', {tabindex:'0'});
    g.append(node('title', {}, `${dayLabel(r.date)}: ${r.grade?.grade ? `${r.grade.grade}, tested ${dayLabel(r.grade.sampled)}` : 'no recent test'}${r.grade?.kind === 'nearby' ? ` · nearby sample: ${r.grade.station}` : ''}`));
    if (letters) g.append(node('text', {x:cx, y:20, class:'grade-letter', 'text-anchor':'middle'}, r.grade?.grade || '–'));
    g.append(node('rect', {x:cx - size / 2, y:28, width:size, height:14, rx:4, class:`grade-mark ${level}`}));
    svg.append(g);
  }
  return svg;
}
function table(rows) {
  const t = html('table', 'history-table'); const head = t.createTHead().insertRow();
  for (const h of ['Day', 'Water temp', 'Temp sensor', 'Grade', 'Sampled', 'Grade station']) head.append(html('th', '', h));
  const body = t.createTBody();
  for (const r of [...rows].reverse()) {
    const row = body.insertRow();
    for (const v of [dayLabel(r.date), r.temp ? `${r.temp.value.toFixed(1)}°F` : '—', r.temp ? `${r.temp.station}${r.temp.regional ? ' (regional)' : ''}` : '—',
      r.grade?.grade || 'No recent test', r.grade?.sampled ? dayLabel(r.grade.sampled) : '—', r.grade ? `${r.grade.kind === 'nearby' ? 'Nearby: ' : ''}${r.grade.station}` : '—']) row.insertCell().textContent = v;
  }
  const wrap = html('details', 'history-data'); wrap.append(html('summary', '', 'Show the data as a table'), t);
  return wrap;
}
async function fill(beach, body) {
  body.replaceChildren(html('p', 'history-note', 'Loading history…'));
  try {
    const rows = (await loadHistory()).filter(r => r.beach === beach.id).sort((a, b) => a.date.localeCompare(b.date));
    body.replaceChildren();
    if (!rows.length) { body.append(html('p', 'history-note', 'History starts with today’s reading, recorded each morning. Check back tomorrow for a trend.')); return; }
    const temps = rows.filter(r => Number.isFinite(r.temp?.value));
    body.append(html('h3', 'chart-title', 'Water temperature (°F), one reading per day'));
    body.append(temps.length ? tempChart(temps) : html('p', 'history-note', 'No temperature readings recorded yet.'));
    body.append(html('h3', 'chart-title', 'Latest Heal the Bay grade, as of each day'), gradeStrip(rows), table(rows));
    const archive = html('a', 'metric-link', 'Download the full archive (JSON) ↗'); archive.href = './data/history/index.json'; archive.target = '_blank';
    body.append(html('p', 'history-note', `${rows.length} day${rows.length === 1 ? '' : 's'} recorded since ${dayLabel(rows[0].date)}. Hover or tap a point for details. `), archive);
  } catch {
    body.replaceChildren(html('p', 'history-note', 'History couldn’t load. Try again later.'));
  }
}
export function historyPanel(beach) {
  const panel = html('details', 'history'); const body = html('div', 'history-body');
  panel.append(html('summary', '', 'History · water temperature & grades'), body);
  panel.addEventListener('toggle', () => { if (panel.open) fill(beach, body); });
  return panel;
}
