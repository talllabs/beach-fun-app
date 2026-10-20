// Data sources shared by the app (browser) and scripts/record-history.mjs (Node).
// Every function returns plain data and never touches the page.
import { byDistance, nextTides, utcDate, chunks } from './conditions.js';

const NOAA = 'https://api.tidesandcurrents.noaa.gov';
export const TEMP_MAX_AGE = 3 * 3600000;
export const REGIONAL_TEMP_MILES = 10;

export async function getJSON(url, timeout = 15000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {signal:controller.signal});
    if (!response.ok) throw new Error(`${new URL(url).host} returned ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

// NOAA metadata: every tide prediction station (reference "R" and subordinate "S"),
// or every station with a water temperature sensor.
export async function noaaStations(type) {
  const data = await getJSON(`${NOAA}/mdapi/prod/webapi/stations.json?type=${type}`, 20000);
  return (data.stations || []).map(s => ({id:String(s.id), name:s.name, lat:Number(s.lat), lng:Number(s.lng), type:s.type}));
}

export async function noaaData(params) {
  const query = new URLSearchParams({application:'BeachCams', time_zone:'gmt', units:'english', format:'json', ...params});
  const data = await getJSON(`${NOAA}/api/prod/datagetter?${query}`);
  if (data.error) throw new Error(data.error.message);
  return data;
}

// Nearest prediction station. Subordinate stations only offer high/low predictions,
// which is exactly what the app shows.
export async function tidesFor(beach, predictionStations, now = new Date()) {
  const station = byDistance(beach, predictionStations)[0];
  if (!station) throw new Error('No tide station found');
  const data = await noaaData({product:'predictions', station:station.id, begin_date:utcDate(now), range:'72', interval:'hilo', datum:'MLLW'});
  return {station, ...nextTides(data.predictions || [], now)};
}

// Closest sensor that reported within the last 3 hours, nearest first.
export async function waterTempFor(beach, tempStations, readings = new Map(), now = new Date()) {
  for (const station of byDistance(beach, tempStations).slice(0, 4)) {
    if (!readings.has(station.id)) readings.set(station.id, noaaData({product:'water_temperature', station:station.id, date:'latest'}).catch(() => null));
    const reading = (await readings.get(station.id))?.data?.at(-1);
    if (!reading || reading.v === '' || !Number.isFinite(Number(reading.v))) continue;
    const observed = new Date(reading.t.replace(' ', 'T') + 'Z'); const age = now - observed;
    if (age > TEMP_MAX_AGE || age < -600000) continue;
    return {station, value:Number(reading.v), observed, regional:station.miles > REGIONAL_TEMP_MILES};
  }
  return null;
}

// Heal the Bay's public list of ~1100 sampling locations, trimmed to what the app uses.
export async function healTheBayLocations() {
  const list = await getJSON('https://admin.beachreportcard.org/api/locations/', 20000);
  if (!Array.isArray(list)) throw new Error('Unexpected Heal the Bay data');
  return list.map(item => {
    const s = item?._source || {}; const [lat, lng] = Array.isArray(s.geo) ? s.geo.map(Number) : [NaN, NaN];
    return {id:String(item?._id), title:s.title, active:s.active, dry_grade:s.dry_grade, grade_updated:s.grade_updated, lat, lng};
  });
}

// Open-Meteo accepts many coordinates at once and returns one result per beach.
// Model grid cells span several kilometres, so neighbouring beaches can share values.
const list = (beaches, key) => beaches.map(b => b[key]).join(',');
export async function marineForecast(beaches) {
  const query = new URLSearchParams({latitude:list(beaches,'latitude'), longitude:list(beaches,'longitude'),
    current:'wave_height,swell_wave_height,swell_wave_period,swell_wave_direction,sea_surface_temperature',
    hourly:'wave_height,swell_wave_height,swell_wave_period,swell_wave_direction', temperature_unit:'fahrenheit', length_unit:'imperial',
    cell_selection:'sea', timezone:'America/Los_Angeles', forecast_days:'1'});
  const data = await getJSON(`https://marine-api.open-meteo.com/v1/marine?${query}`);
  return Array.isArray(data) ? data : [data];
}
export async function windForecast(beaches) {
  const query = new URLSearchParams({latitude:list(beaches,'latitude'), longitude:list(beaches,'longitude'),
    current:'wind_speed_10m,wind_direction_10m', hourly:'wind_speed_10m,wind_direction_10m',
    wind_speed_unit:'mph', timezone:'America/Los_Angeles', forecast_days:'1'});
  const data = await getJSON(`https://api.open-meteo.com/v1/forecast?${query}`);
  return Array.isArray(data) ? data : [data];
}

// Drive times from one origin to every beach. Mapbox's driving-traffic profile uses live
// traffic (max 10 coordinates per request, so beaches go in groups of 9). Without a token,
// the public OSRM demo server gives a no-traffic estimate.
export async function driveTimes(origin, beaches, mapboxToken) {
  const traffic = Boolean(mapboxToken);
  const groups = traffic ? chunks(beaches, 9) : [beaches];
  const results = await Promise.all(groups.map(async group => {
    const coords = [origin, ...group.map(b => ({lat:b.latitude, lng:b.longitude}))].map(c => `${c.lng},${c.lat}`).join(';');
    const url = traffic
      ? `https://api.mapbox.com/directions-matrix/v1/mapbox/driving-traffic/${coords}?sources=0&annotations=duration,distance&access_token=${encodeURIComponent(mapboxToken)}`
      : `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&annotations=duration,distance`;
    const data = await getJSON(url);
    if (data.code !== 'Ok') throw new Error(data.message || data.code || 'No route');
    return group.map((_, i) => ({seconds:data.durations?.[0]?.[i + 1], meters:data.distances?.[0]?.[i + 1]}));
  }));
  return {traffic, provider:traffic ? 'Mapbox live traffic' : 'OSRM, no live traffic', times:results.flat()};
}
