import { pacificTime, waterGrade, testedDate, distanceMiles, miles, qualityMatch, shortStationName, ageText, sampleDay, compass, windRelation, dayparts, gradeLevel } from './conditions.js';
import { noaaStations, tidesFor, waterTempFor, healTheBayLocations, marineForecast, windForecast } from './sources.js';
import { historyPanel } from './history.js';
import { drivePill, setupDrive, refreshDrive } from './drive.js';
const beachRoot = document.querySelector('#beaches');
const nav = document.querySelector('#beach-links');
const announce = text => document.querySelector('#announcement').textContent = text;
const states = new Map();
let config;
let youtubePromise;
function youtube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubePromise) youtubePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('YouTube took too long')), 18000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timeout); reject(new Error('YouTube unavailable')); };
    document.head.append(script);
  }).catch(error => { youtubePromise = undefined; throw error; });
  return youtubePromise;
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function safeURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Camera URLs must use HTTPS');
  return url.href;
}
function sourceLink(cam, text) {
  const a = el('a', '', text); a.href = safeURL(cam.sourceUrl); a.target = '_blank'; a.rel = 'noopener'; return a;
}
function label(state, text, live = false) {
  state.badge.textContent = text; state.badge.classList.toggle('live', live);
}
function clearPlayer(state) {
  state.generation++;
  clearTimeout(state.timeout); clearInterval(state.watchdog);
  state.hls?.destroy(); state.hls = null;
  try { state.yt?.destroy(); } catch { /* already removed */ }
  state.yt = null;
  const video = state.player.querySelector('video');
  if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
  state.player.replaceChildren();
  state.running = false;
}
function placeholder(state, title, description, link = false) {
  const box = el('div', 'placeholder');
  box.append(el('span', 'symbol', '≈'), el('strong', '', title), el('p', '', description));
  if (link) box.append(sourceLink(state.cam, 'Visit the free camera source ↗'));
  state.player.append(box);
}
function idle(state) {
  clearPlayer(state);
  if (state.cam.status !== 'enabled') {
    placeholder(state, state.cam.status === 'blocked' ? 'This view can’t embed right now' : 'Cam offline — back soon', state.cam.note, true);
    label(state, state.cam.status === 'blocked' ? 'Embed unavailable' : 'Offline');
  } else {
    placeholder(state, 'A window to the water', 'This camera connects when it’s on your screen.'); label(state, 'Paused to save data');
  }
}
function fail(state, message = 'The camera may be offline or its provider may be blocking playback. Try refreshing in a moment.') {
  clearPlayer(state); state.failed = true;
  placeholder(state, 'Cam offline — let’s try again soon', message, true); label(state, 'Unavailable');
}
function started(state) {
  clearTimeout(state.timeout); state.failed = false;
  state.player.querySelector('.placeholder')?.remove();
  label(state, 'Playing', true);
}
async function start(state) {
  if (state.running || state.failed || !state.visible || document.hidden || state.cam.status !== 'enabled') return;
  clearPlayer(state); state.running = true;
  const generation = state.generation;
  const current = () => generation === state.generation && state.running;
  const cam = state.cam;
  placeholder(state, 'Connecting to the coast…', 'Live cameras sometimes take a few seconds.'); label(state, 'Connecting');
  state.timeout = setTimeout(() => { if (current()) fail(state); }, 35000);
  if (cam.type === 'youtube') {
    try {
      const YT = await youtube(); if (!current()) return;
      const holder = el('div', 'yt-holder'); state.player.append(holder);
      const id = new URL(cam.url).pathname.split('/').filter(Boolean).pop();
      state.yt = new YT.Player(holder, {
        videoId: id, width:'100%', height:'100%',
        playerVars: {autoplay:1, mute:1, playsinline:1, rel:0, origin:location.origin},
        events: {
          onReady: event => { if (!current()) return; event.target.mute(); event.target.playVideo(); },
          onStateChange: event => {
            if (!current()) return;
            if (event.data === YT.PlayerState.PLAYING) started(state);
            else if (event.data === YT.PlayerState.ENDED) fail(state, 'This broadcast has ended. The city may publish a new live stream.');
            else if (event.data === YT.PlayerState.PAUSED) label(state, 'Paused');
          },
          onError: () => { if (current()) fail(state, 'YouTube couldn’t play this broadcast here. It may be offline or have embedding disabled.'); },
          onAutoplayBlocked: () => { if (current()) { clearTimeout(state.timeout); label(state, 'Tap Play to start'); } }
        }
      });
      // Detect long buffering after playback as well as initial failures.
      let bufferingSince = 0;
      state.watchdog = setInterval(() => {
        if (!current() || !state.yt?.getPlayerState) return;
        const status = state.yt.getPlayerState();
        if (status === YT.PlayerState.BUFFERING) {
          bufferingSince ||= Date.now();
          if (Date.now() - bufferingSince > 45000) fail(state, 'This stream has stopped responding. Try the refresh button.');
        } else bufferingSince = 0;
      }, 5000);
    } catch { if (current()) fail(state); }
  } else if (cam.type === 'hls') {
    const video = el('video'); video.autoplay = true; video.muted = true; video.defaultMuted = true;
    video.playsInline = true; video.controls = true; video.preload = 'none';
    video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
    state.player.append(video);
    video.addEventListener('playing', () => { if (current()) started(state); });
    video.addEventListener('error', () => { if (current()) fail(state); });
    video.addEventListener('pause', () => { if (current()) label(state, 'Paused'); });
    const play = () => video.play().catch(() => {
      if (!current()) return;
      clearTimeout(state.timeout); label(state, 'Tap Play to start');
      state.player.querySelector('.placeholder')?.remove();
    });
    if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = safeURL(cam.url); play(); }
    else if (window.Hls?.isSupported()) {
      const hls = new window.Hls({maxBufferLength:15, maxMaxBufferLength:30, startLevel:0}); state.hls = hls;
      hls.on(window.Hls.Events.ERROR, (_, data) => { if (data.fatal && current()) fail(state); });
      hls.on(window.Hls.Events.MANIFEST_PARSED, play);
      hls.loadSource(safeURL(cam.url)); hls.attachMedia(video);
    } else fail(state, 'This browser can’t play this live stream. Try Safari or an up-to-date browser.');
    let lastTime = 0, lastAdvance = Date.now();
    state.watchdog = setInterval(() => {
      if (!current() || video.paused) return;
      if (video.currentTime > lastTime) { lastTime = video.currentTime; lastAdvance = Date.now(); }
      else if (Date.now() - lastAdvance > 45000) fail(state, 'The stream appears frozen. Try the refresh button.');
    }, 5000);
  } else {
    // Cross-origin iframes do not expose reliable playback/error state.
    // Keep only known working approved embeds enabled in cams.json.
    const frame = el('iframe'); frame.title = cam.name;
    const url = new URL(safeURL(cam.url));
    url.searchParams.set('autoplay', '1'); url.searchParams.set('mute', '1'); url.searchParams.set('muted', 'true'); url.searchParams.set('playsinline', '1');
    frame.allow = 'autoplay; fullscreen; picture-in-picture'; frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.src = url.href;
    frame.onerror = () => { if (current()) fail(state); };
    frame.onload = () => { if (current()) { clearTimeout(state.timeout); state.player.querySelector('.placeholder')?.remove(); label(state, 'Provider player · unverified'); } };
    state.player.append(frame);
  }
}
function refresh(state) { state.failed = false; idle(state); start(state); announce(`${state.cam.name} refreshed.`); }
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const state = states.get(entry.target.id); if (!state) continue;
    state.visible = entry.isIntersecting;
    if (state.visible) start(state); else idle(state);
  }
}, {threshold:0, rootMargin:'0px'});
function card(cam) {
  safeURL(cam.url); safeURL(cam.sourceUrl);
  const article = el('article','cam'); article.id = `cam-${cam.id}`;
  const player = el('div','player');
  const meta = el('div','cam-meta'); const names = el('div'); names.append(el('h3','',cam.name),el('p','',cam.provider));
  const button = el('button','refresh','↻'); button.setAttribute('aria-label',`Refresh ${cam.name}`); button.title = `Refresh ${cam.name}`;
  meta.append(names,button);
  const foot = el('div','cam-foot'); const badge = el('span','state'); foot.append(badge,sourceLink(cam,'Camera source ↗'));
  const tools = el('div','cam-tools'); const trouble = el('button','','Blank or frozen?');
  tools.append(trouble); article.append(player,meta,foot,tools);
  const state = {cam,player,badge,visible:false,running:false,generation:0,failed:false};
  states.set(article.id,state); idle(state);
  button.addEventListener('click',()=>refresh(state));
  trouble.addEventListener('click',()=>fail(state,'No picture? The provider may be offline or blocking embeds. Refresh to retry, or check its free source.'));
  observer.observe(player); player.id=article.id+'-player'; states.delete(article.id); states.set(player.id,state);
  return article;
}
const HOUR = 3600000, DAY = 24 * HOUR;
const memo = new Map();
// Reuse slow-changing lists (memory, then localStorage). "at" is when the app fetched the list;
// it is shown as such and never as a measurement time.
function stored(key, maxAge, load) {
  const hit = memo.get(key); if (hit && Date.now() - hit.at < maxAge) return hit.promise;
  const promise = (async () => {
    try { const saved = JSON.parse(localStorage.getItem(key)); if (saved && Date.now() - saved.at < maxAge) return saved; } catch { /* storage unavailable */ }
    const saved = {at:Date.now(), data:await load()};
    try { localStorage.setItem(key, JSON.stringify(saved)); } catch { /* storage full or blocked */ }
    return saved;
  })();
  memo.set(key, {at:Date.now(), promise}); promise.catch(() => { if (memo.get(key)?.promise === promise) memo.delete(key); });
  return promise;
}
// Keep only stations within reach of the coast we cover, so storage stays small.
const near = (list, limit) => list.filter(s => config.beaches.some(b => distanceMiles({lat:b.latitude, lng:b.longitude}, s) <= limit));
let cycle;
function sources() {
  if (cycle && Date.now() - cycle.at < 60000) return cycle;
  const beaches = config.beaches;
  cycle = {at:Date.now(), readings:new Map(), index:new Map(beaches.map((b,i) => [b.id,i])),
    tideStations: stored('beach-cams-tide-stations', DAY, async () => near(await noaaStations('tidepredictions'), 60)),
    tempStations: stored('beach-cams-temp-stations', DAY, async () => near(await noaaStations('watertemp'), 120)),
    grades: stored('beach-cams-grade-list', HOUR, async () => near(await healTheBayLocations(), 10)),
    marine: marineForecast(beaches).catch(() => null), wind: windForecast(beaches).catch(() => null)};
  return cycle;
}
const views = new WeakMap();
const set = (node, text) => { node.textContent = text; };
const pacificDay = date => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(date);
const feet = value => `${value < 10 ? value.toFixed(1) : Math.round(value)} ft`;
function tideText(event) { return event ? `${pacificTime(event.date)} · ${feet(Number(event.v))}` : 'Unavailable'; }
async function conditions(beach, box) {
  const ui = views.get(box), shared = sources(), checked = new Date();
  const [tide, temp] = await Promise.allSettled([
    shared.tideStations.then(s => tidesFor(beach, s.data)),
    shared.tempStations.then(s => waterTempFor(beach, s.data, shared.readings))]);
  let tideNote = 'Tides unavailable';
  if (tide.status === 'fulfilled') {
    set(ui.high, tideText(tide.value.high)); set(ui.low, tideText(tide.value.low));
    const s = tide.value.station; tideNote = `Tides: NOAA ${s.name}${s.type === 'S' ? ' (subordinate)' : ''}, ${miles(s.miles)} away`;
  } else { set(ui.high, 'Unavailable'); set(ui.low, 'Unavailable'); }
  const reading = temp.status === 'fulfilled' ? temp.value : null;
  set(ui.tempLabel, reading?.regional ? 'REGIONAL WATER TEMP' : 'WATER TEMP');
  set(ui.temp, reading ? `${reading.value.toFixed(1)}°F` : 'Unavailable');
  set(ui.tempDetail, reading ? `${reading.station.name} · ${miles(reading.station.miles)} away · measured ${pacificTime(reading.observed)}` : 'No sensor nearby reported in the last 3 hours');
  const i = shared.index.get(beach.id); const [marine, wind] = await Promise.all([shared.marine, shared.wind]);
  const sea = marine?.[i], air = wind?.[i], c = sea?.current, w = air?.current;
  if (Number.isFinite(c?.swell_wave_height)) {
    set(ui.swell, `${feet(c.swell_wave_height)} · ${Math.round(c.swell_wave_period)} s · ${compass(c.swell_wave_direction)}`);
    set(ui.swellDetail, Number.isFinite(c.wave_height) ? `Offshore wave height ${feet(c.wave_height)} · not a breaking-surf estimate` : 'Not a breaking-surf estimate');
  } else { set(ui.swell, 'Unavailable'); set(ui.swellDetail, 'Model forecast unavailable'); }
  if (Number.isFinite(w?.wind_speed_10m)) {
    set(ui.wind, `${Math.round(w.wind_speed_10m)} mph ${compass(w.wind_direction_10m)}`);
    set(ui.windDetail, `${windRelation(w.wind_direction_10m, beach.facing)} for this beach`);
  } else { set(ui.wind, 'Unavailable'); set(ui.windDetail, 'Model forecast unavailable'); }
  const parts = dayparts(sea?.hourly, air?.hourly, pacificDay(checked));
  const part = (name, p) => Number.isFinite(p.swell) || Number.isFinite(p.wind)
    ? `${name}: swell ${Number.isFinite(p.swell) ? `${feet(p.swell)}${Number.isFinite(p.period) ? ` at ${Math.round(p.period)} s` : ''}` : 'n/a'}, wind ${Number.isFinite(p.wind) ? `${Math.round(p.wind)} mph ${windRelation(p.windFrom, beach.facing).toLowerCase()}` : 'n/a'}` : '';
  set(ui.forecast, [part('Morning', parts.morning), part('Afternoon', parts.afternoon)].filter(Boolean).join(' · ') || 'Forecast unavailable');
  set(ui.note, `${tideNote} · Model data: Open-Meteo, grid cells span several km · Pacific time · App checked ${pacificTime(checked)}`);
}
async function waterQuality(beach, box) {
  const ui = views.get(box);
  try {
    const list = await sources().grades; const match = qualityMatch(beach, list.data), s = match.station;
    const fetched = `Heal the Bay list fetched ${pacificTime(new Date(list.at))}`;
    if (match.kind === 'none') {
      set(ui.grade, 'No local result available'); ui.grade.dataset.level = 'none';
      set(ui.gradeDetail, `${s ? `Closest sample (${shortStationName(s.title)}) is ${miles(s.miles)} away` : 'No sampling station nearby'} · ${fetched}`); return;
    }
    const grade = waterGrade(s), date = testedDate(s.grade_updated), sampled = sampleDay(s.grade_updated);
    set(ui.grade, grade ? (date ? `${grade} · Tested ${date}` : grade) : 'No recent test');
    ui.grade.dataset.level = grade ? gradeLevel(grade) : 'none';
    const where = match.kind === 'nearby' ? `Nearby sample: ${shortStationName(s.title)}, ${miles(s.miles)} away` : s.title;
    const old = sampled && Date.now() - sampled > 14 * DAY ? ` · older result (${ageText(sampled)})` : '';
    set(ui.gradeDetail, `${where}${old} · ${fetched}`);
  } catch {
    set(ui.grade, 'No recent test'); ui.grade.dataset.level = 'none'; set(ui.gradeDetail, 'Couldn’t reach Heal the Bay');
  }
}
function metric(box, icon, label, extraClass = '') {
  const node = el('div', `metric ${extraClass}`.trim()); const text = el('div'); const small = el('small', '', label);
  const value = el('strong', '', 'Loading…'); const detail = el('span', 'metric-detail');
  text.append(small, value, detail); node.append(el('span', 'metric-icon', icon), text); box.append(node);
  return {label:small, value, detail, text};
}
function outLink(text, href, label) { const a = el('a', 'metric-link', text); a.href = safeURL(href); a.target = '_blank'; a.rel = 'noopener'; if (label) a.setAttribute('aria-label', label); return a; }
function buildConditions(beach) {
  const box = el('div', 'conditions');
  const high = metric(box, '↗', 'NEXT HIGH'), low = metric(box, '↘', 'NEXT LOW'), temp = metric(box, '≈', 'WATER TEMP');
  const swell = metric(box, '∿', 'SWELL · MODEL FORECAST'), wind = metric(box, '➶', 'WIND · MODEL FORECAST');
  const advisory = metric(box, '!', 'ADVISORY STATUS', 'advisory');
  set(advisory.value, 'Not checked in app'); set(advisory.detail, 'Closures and advisories can change daily. A good grade never overrides one.');
  const county = new URL(beach.advisoryUrl).host.includes('sdbeachinfo') ? 'SD Beach Info' : 'OC Beach Info';
  advisory.text.append(outLink(`Check ${county} ↗`, beach.advisoryUrl, `Current advisories for ${beach.name} at ${county}`));
  const grade = metric(box, '◇', 'LATEST WATER QUALITY GRADE', 'quality'); grade.value.classList.add('grade'); set(grade.value, 'Checking…');
  grade.text.append(outLink('Heal the Bay ↗', beach.qualityUrl, `Water quality report for ${beach.name} at Heal the Bay`));
  const forecast = el('div', 'forecast'); const forecastText = el('span', '', 'Loading forecast…');
  forecast.append(el('small', '', 'TODAY · MODEL FORECAST'), forecastText, outLink('Open-Meteo ↗', 'https://open-meteo.com/en/docs/marine-weather-api'));
  const note = el('div', 'station-note', 'Loading conditions…');
  box.append(forecast, note);
  views.set(box, {high:high.value, low:low.value, temp:temp.value, tempLabel:temp.label, tempDetail:temp.detail, swell:swell.value, swellDetail:swell.detail,
    wind:wind.value, windDetail:wind.detail, grade:grade.value, gradeDetail:grade.detail, forecast:forecastText, note});
  return box;
}
function render(data) {
  beachRoot.replaceChildren(); nav.replaceChildren();
  // The coast runs northwest to southeast, so west to east is north to south along it.
  const beaches = [...data.beaches].sort((a,b)=>a.longitude-b.longitude);
  let count=0;
  for (const [index,beach] of beaches.entries()) {
    const link=el('a','',beach.name); link.href=`#${beach.id}`; nav.append(link);
    const section=el('section','beach'); section.id=beach.id; section.setAttribute('aria-labelledby',`${beach.id}-title`);
    const head=el('div','beach-head'); const title=el('div','beach-title'); const titleText=el('div'); const heading=el('h2','',beach.name); heading.id=`${beach.id}-title`;
    titleText.append(heading,el('p','',beach.area)); title.append(el('span','beach-number',String(index+1).padStart(2,'0')),titleText); head.append(title,drivePill(beach));
    const box=buildConditions(beach);
    const cams=el('div','cams');for(const cam of beach.cams){cams.append(card(cam));count++;}
    if(!beach.cams.length) cams.append(el('p','no-cam','No camera here yet. Tides, water temperature, forecasts and water quality still update.'));
    section.append(head,box,historyPanel(beach),cams);beachRoot.append(section); conditions(beach,box); waterQuality(beach,box);
  }
  document.querySelector('#cam-count').textContent=`${beaches.length} coastal stops · ${count} camera views`;
  const sectionObserver=new IntersectionObserver(entries=>{
    for(const entry of entries) if(entry.isIntersecting){
      nav.querySelectorAll('a').forEach(a=>{const active=a.hash===`#${entry.target.id}`;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    }
  },{rootMargin:'-80px 0px -65% 0px',threshold:0});
  document.querySelectorAll('.beach').forEach(section=>sectionObserver.observe(section));
}
function refreshConditions() {
  cycle = undefined;
  config.beaches.forEach(b => { const box = document.getElementById(b.id).querySelector('.conditions'); conditions(b, box); waterQuality(b, box); });
}
document.querySelector('#refresh-all').addEventListener('click',()=>{
  states.forEach(refresh); if (config) { refreshConditions(); refreshDrive(); }
  announce('Visible cameras and conditions refreshed. Each reading still shows when it was measured. Other cameras connect when you scroll to them.');
});
document.addEventListener('visibilitychange',()=>{states.forEach(state=>{if(document.hidden)idle(state);else start(state);});});
window.addEventListener('pagehide',()=>states.forEach(idle));
window.addEventListener('pageshow',()=>states.forEach(start));
window.addEventListener('offline',()=>{states.forEach(state=>{if(state.running)fail(state,'You’re offline. Reconnect, then refresh this camera.');});});
window.addEventListener('online',()=>{states.forEach(state=>{state.failed=false;start(state);});});
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  try { response = await fetch('./cams.json', {cache:'no-store', signal:controller.signal}); }
  finally { clearTimeout(timeout); }
  if(!response.ok)throw new Error('Camera list unavailable');
  config=await response.json(); render(config); setupDrive(config); beachRoot.dataset.ready = 'true';
  setInterval(()=>{if(!document.hidden)refreshConditions();},600000);
} catch(error) {
  beachRoot.dataset.ready = 'error';
  beachRoot.replaceChildren(el('p','','Couldn’t load the camera list. Check your connection and reload. If you’re opening a local file, use the preview instructions in README.md.'));
  console.error(error);
}
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
