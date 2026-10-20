// Records one reading per beach per day into data/history/YYYY-MM.json (run by GitHub Actions).
// Re-running on the same day replaces that day's readings; older days are never removed.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { qualityMatch, waterGrade, sampleDay } from '../conditions.js';
import { noaaStations, waterTempFor, healTheBayLocations } from '../sources.js';

const root = new URL('../', import.meta.url);
const dir = new URL('data/history/', root);
const config = JSON.parse(readFileSync(new URL('cams.json', root)));
const now = new Date();
const today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Los_Angeles'}).format(now);
const settle = p => p.then(v => v, e => { console.warn(e.message); return null; });
const [tempStations, locations] = await Promise.all([settle(noaaStations('watertemp')), settle(healTheBayLocations())]);
const readings = new Map();
const records = [];
for (const beach of config.beaches) {
  const temp = tempStations ? await settle(waterTempFor(beach, tempStations, readings, now)) : null;
  let grade = null;
  if (locations) {
    const match = qualityMatch(beach, locations);
    if (match.kind !== 'none') {
      const sampled = sampleDay(match.station.grade_updated);
      grade = {grade:waterGrade(match.station), sampled:sampled ? sampled.toISOString().slice(0,10) : null, station:match.station.title, kind:match.kind, miles:+match.station.miles.toFixed(1)};
    }
  }
  records.push({date:today, beach:beach.id,
    temp: temp ? {value:temp.value, station:temp.station.name, miles:+temp.station.miles.toFixed(1), observed:temp.observed.toISOString(), regional:temp.regional} : null, grade});
}
if (!tempStations && !locations) { console.error('No source responded; nothing recorded.'); process.exit(1); }
mkdirSync(dir, {recursive:true});
const month = today.slice(0, 7), file = new URL(`${month}.json`, dir), indexFile = new URL('index.json', dir);
const existing = existsSync(file) ? JSON.parse(readFileSync(file)).records : [];
const merged = [...existing.filter(r => r.date !== today), ...records].sort((a, b) => a.date.localeCompare(b.date) || a.beach.localeCompare(b.beach));
writeFileSync(file, JSON.stringify({month, records:merged}, null, 1) + '\n');
const months = new Set(existsSync(indexFile) ? JSON.parse(readFileSync(indexFile)).months : []); months.add(month);
writeFileSync(indexFile, JSON.stringify({updated:now.toISOString(), months:[...months].sort()}, null, 1) + '\n');
console.log(`Recorded ${records.length} beaches for ${today}: ${records.filter(r => r.temp).length} temperatures, ${records.filter(r => r.grade?.grade).length} grades.`);
