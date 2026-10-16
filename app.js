import { nextTides, pacificTime, utcDate } from './conditions.js';
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
const requestCache = new Map();
async function noaa(product, station) {
  const key = `${product}:${station}`;
  if (requestCache.has(key)) return requestCache.get(key);
  const request = (async()=> {
    const query = new URLSearchParams({product,station,application:'BeachCams',time_zone:'gmt',units:'english',format:'json'});
    if (product === 'predictions') {
      query.set('begin_date',utcDate(new Date())); query.set('range','72'); query.set('interval','hilo'); query.set('datum','MLLW');
    } else query.set('date','latest');
    const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(),15000);
    try {
      const response = await fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${query}`,{signal:controller.signal});
      if (!response.ok) throw new Error('NOAA unavailable'); const data = await response.json();
      if (data.error) throw new Error(data.error.message); return data;
    } finally { clearTimeout(timer); }
  })(); requestCache.set(key,request); return request;
}
async function conditions(beach, box) {
  const [tide,temp] = await Promise.allSettled([noaa('predictions',beach.tideStation),noaa('water_temperature',beach.temperatureStation)]);
  const high = box.querySelector('[data-high]'), low = box.querySelector('[data-low]'), water = box.querySelector('[data-water]'), note = box.querySelector('.station-note');
  if (tide.status === 'fulfilled') {
    const next = nextTides(tide.value.predictions || [],new Date());
    high.textContent = next.high ? pacificTime(next.high.date) : 'Unavailable';
    low.textContent = next.low ? pacificTime(next.low.date) : 'Unavailable';
  } else { high.textContent='Unavailable'; low.textContent='Unavailable'; }
  let tempNote = 'Temperature unavailable';
  if (temp.status === 'fulfilled') {
    const reading = temp.value.data?.at(-1); const age = reading ? Date.now()-new Date(reading.t.replace(' ','T')+'Z').getTime() : Infinity;
    if (reading && reading.v !== '' && Number.isFinite(Number(reading.v)) && age < 3*3600000 && age > -600000) {
      water.textContent=`${Number(reading.v).toFixed(1)}°F`;
      tempNote=`Water: ${beach.temperatureStationName}, observed ${pacificTime(new Date(reading.t.replace(' ','T')+'Z'))}`;
    } else {water.textContent='Unavailable';tempNote='Temperature reading missing or over 3 hours old';}
  } else water.textContent='Unavailable';
  note.textContent=`Tides: ${beach.tideStationName} (nearby station) · ${tempNote} · Pacific time · Checked ${pacificTime(new Date())}`;
}
function render(data) {
  beachRoot.replaceChildren(); nav.replaceChildren();
  const beaches = [...data.beaches].sort((a,b)=>b.latitude-a.latitude);
  let count=0;
  for (const [index,beach] of beaches.entries()) {
    const link=el('a','',beach.name); link.href=`#${beach.id}`; nav.append(link);
    const section=el('section','beach'); section.id=beach.id; section.setAttribute('aria-labelledby',`${beach.id}-title`);
    const head=el('div','beach-head'); const title=el('div','beach-title'); const titleText=el('div'); const heading=el('h2','',beach.name); heading.id=`${beach.id}-title`;
    titleText.append(heading,el('p','',beach.area)); title.append(el('span','beach-number',String(index+1).padStart(2,'0')),titleText); head.append(title,el('span','drive',beach.drive));
    const box=el('div','conditions');
    for (const [icon,label,attribute] of [['↗','NEXT HIGH','high'],['↘','NEXT LOW','low'],['≈','WATER TEMP','water']]) {
      const metric=el('div','metric'); const text=el('div'); const value=el('strong','','Loading…'); value.dataset[attribute]=''; text.append(el('small','',label),value);metric.append(el('span','metric-icon',icon),text);box.append(metric);
    }
    box.append(el('div','station-note','NOAA nearby station data · Pacific time'));
    const cams=el('div','cams');for(const cam of beach.cams){cams.append(card(cam));count++;}
    section.append(head,box,cams);beachRoot.append(section); conditions(beach,box);
  }
  document.querySelector('#cam-count').textContent=`${beaches.length} coastal stops · ${count} camera views`;
  const sectionObserver=new IntersectionObserver(entries=>{
    for(const entry of entries) if(entry.isIntersecting){
      nav.querySelectorAll('a').forEach(a=>{const active=a.hash===`#${entry.target.id}`;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    }
  },{rootMargin:'-80px 0px -65% 0px',threshold:0});
  document.querySelectorAll('.beach').forEach(section=>sectionObserver.observe(section));
}
document.querySelector('#refresh-all').addEventListener('click',()=>{
  states.forEach(refresh); requestCache.clear();
  config?.beaches.forEach(beach=>conditions(beach,document.getElementById(beach.id).querySelector('.conditions')));
  announce('Visible cameras and NOAA conditions refreshed. Other cameras connect when you scroll to them.');
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
  config=await response.json(); render(config); beachRoot.dataset.ready = 'true';
  setInterval(()=>{if(!document.hidden){requestCache.clear();config.beaches.forEach(b=>conditions(b,document.getElementById(b.id).querySelector('.conditions')));}},600000);
} catch(error) {
  beachRoot.dataset.ready = 'error';
  beachRoot.replaceChildren(el('p','','Couldn’t load the camera list. Check your connection and reload. If you’re opening a local file, use the preview instructions in README.md.'));
  console.error(error);
}
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
