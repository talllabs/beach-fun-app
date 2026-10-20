// Drive times from the visitor's location. Location is only requested after a tap,
// rounded to ~100 m before it is sent to the routing service, and never stored.
import { driveText, roundedOrigin, pacificTime } from './conditions.js';
import { driveTimes } from './sources.js';

const OPT_IN = 'beach-cams-drive-from-me';
let state = {config:null, origin:null, timer:null};
const pills = () => [...document.querySelectorAll('.drive[data-beach]')];
const status = () => document.querySelector('#drive-status');
const button = () => document.querySelector('#drive-button');

function mapsLink(beach) {
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios ? `https://maps.apple.com/?daddr=${beach.latitude},${beach.longitude}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${beach.latitude},${beach.longitude}&travelmode=driving`;
}
// Each beach's pill is a link: it opens live-traffic directions in the visitor's maps app.
export function drivePill(beach) {
  const a = document.createElement('a'); a.className = 'drive'; a.dataset.beach = beach.id; a.dataset.default = beach.drive;
  a.textContent = beach.drive; a.href = mapsLink(beach); a.target = '_blank'; a.rel = 'noopener';
  a.title = 'Estimated from Dana Point. Opens directions with live traffic.';
  return a;
}
function resetPills(message) {
  for (const p of pills()) { p.textContent = p.dataset.default; p.title = 'Estimated from Dana Point. Opens directions with live traffic.'; }
  status().textContent = message || 'Drive times are rough estimates from Dana Point.';
  button().textContent = '📍 Drive times from my location'; button().dataset.active = '';
}
async function update() {
  const {config, origin} = state; if (!origin) return;
  try {
    const result = await driveTimes(origin, config.beaches, config.mapboxToken);
    const byId = new Map(config.beaches.map((b, i) => [b.id, result.times[i]]));
    const checked = pacificTime(new Date());
    for (const p of pills()) {
      const t = byId.get(p.dataset.beach); const text = driveText(t?.seconds);
      p.textContent = text ? `${text}${result.traffic ? '' : ' · est.'}` : p.dataset.default;
      p.title = `${text ? `From your location, ${result.provider}, checked ${checked}. ` : ''}Opens directions with live traffic.`;
    }
    status().textContent = result.traffic
      ? `Drive times from your location with live traffic (Mapbox), updated ${checked}. Tap a time for directions.`
      : `Drive times from your location, no live traffic, updated ${checked}. Tap a time for live-traffic directions in Maps.`;
  } catch {
    resetPills('Couldn’t get drive times right now. Showing estimates from Dana Point. Tap a time for live directions.');
  }
}
function locate() {
  if (!('geolocation' in navigator)) { resetPills('This browser can’t share location. Showing estimates from Dana Point.'); return; }
  status().textContent = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(position => {
    state.origin = roundedOrigin(position.coords);
    try { localStorage.setItem(OPT_IN, '1'); } catch { /* storage blocked */ }
    button().textContent = 'Use Dana Point estimates'; button().dataset.active = 'true';
    update(); clearInterval(state.timer); state.timer = setInterval(() => { if (!document.hidden) update(); }, 600000);
  }, error => {
    try { localStorage.removeItem(OPT_IN); } catch { /* storage blocked */ }
    resetPills(error.code === error.PERMISSION_DENIED ? 'Location is off for this site. Showing estimates from Dana Point.' : 'Couldn’t find your location. Showing estimates from Dana Point.');
  }, {enableHighAccuracy:false, timeout:15000, maximumAge:600000});
}
function stop() {
  state.origin = null; clearInterval(state.timer);
  try { localStorage.removeItem(OPT_IN); } catch { /* storage blocked */ }
  resetPills();
}
export async function setupDrive(config) {
  state.config = config;
  button().addEventListener('click', () => button().dataset.active ? stop() : locate());
  resetPills();
  // Only resume automatically if the visitor opted in before and the browser still allows it.
  let optedIn = false; try { optedIn = localStorage.getItem(OPT_IN) === '1'; } catch { /* storage blocked */ }
  if (!optedIn) return;
  try { if ((await navigator.permissions?.query({name:'geolocation'}))?.state === 'granted') locate(); } catch { /* permissions API unavailable */ }
}
export function refreshDrive() { if (state.origin) update(); }
