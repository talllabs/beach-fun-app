import test from 'node:test';
import assert from 'node:assert/strict';
import {nextTides,pacificTime,utcDate,waterGrade,testedDate,distanceMiles,qualityMatch,shortStationName,windRelation,compass,dayparts,ageText,gradeLevel,driveText,chunks,roundedOrigin} from '../conditions.js';
import {readFileSync} from 'node:fs';
test('next tides skip past events and select each type across UTC midnight',()=>{
 const next=nextTides([{t:'2026-10-16 19:18',type:'H'},{t:'2026-10-17 04:08',type:'L'},{t:'2026-10-17 20:32',type:'H'}],new Date('2026-10-16T20:00:00Z'));
 assert.equal(next.low.date.toISOString(),'2026-10-17T04:08:00.000Z');assert.equal(next.high.date.toISOString(),'2026-10-17T20:32:00.000Z');
});
test('Pacific display follows daylight saving time independent of device timezone',()=>{
 assert.match(pacificTime(new Date('2026-10-17T04:08:00Z')),/9:08 PM PDT/); assert.match(pacificTime(new Date('2026-12-17T04:08:00Z')),/8:08 PM PST/);
 assert.equal(utcDate(new Date('2026-10-17T04:08:00Z')),'20261017');
});
test('empty predictions do not invent tide times',()=>assert.deepEqual(nextTides([],new Date()),{high:undefined,low:undefined}));
test('camera configuration has unique IDs, secure URLs and station attribution',()=>{
 const data=JSON.parse(readFileSync(new URL('../cams.json',import.meta.url)));const ids=new Set(),beachIds=new Set();
 for(const beach of data.beaches){assert.ok(!beachIds.has(beach.id));beachIds.add(beach.id);assert.ok(Array.isArray(beach.cams));assert.ok(beach.latitude>32&&beach.latitude<34.5&&beach.longitude>-119&&beach.longitude<-117);assert.ok(beach.facing>=0&&beach.facing<360);if(beach.qualityStation!==undefined)assert.match(beach.qualityStation,/^\d+$/);for(const u of [beach.qualityUrl,beach.advisoryUrl])assert.equal(new URL(u).protocol,'https:');for(const cam of beach.cams){assert.ok(!ids.has(cam.id));ids.add(cam.id);assert.equal(new URL(cam.url).protocol,'https:');assert.equal(new URL(cam.sourceUrl).protocol,'https:');assert.ok(['hls','youtube','iframe'].includes(cam.type));}}
});
test('Heal the Bay grades and test dates',()=>{
 assert.equal(waterGrade({dry_grade:'A+'}),'A+'); assert.equal(waterGrade({dry_grade:'b'}),'B');
 assert.equal(waterGrade({dry_grade:'ns'}),null); assert.equal(waterGrade({}),null); assert.equal(waterGrade(undefined),null);
 assert.equal(testedDate('2026-10-16'),'Oct 16'); assert.equal(testedDate('2026-10-16T00:00:00.000Z'),'Oct 16');
 assert.equal(testedDate('2026-10-17T03:00:00Z'),'Oct 16'); assert.equal(testedDate(''),''); assert.equal(testedDate('nope'),'');
});
test('distances and water quality station matching',()=>{
 assert.ok(Math.abs(distanceMiles({lat:33.4612,lng:-117.6870},{lat:33.3735,lng:-117.5655})-9.2)<0.5);
 const beach={latitude:33.3735,longitude:-117.5655,qualityStation:'241'};
 const calafia={id:'241',title:'San Clemente State Beach - Avenida Calafia',active:true,lat:33.4045,lng:-117.6070};
 const local={id:'9',title:'San Onofre State Beach - Surf Beach',active:true,lat:33.3740,lng:-117.5660};
 assert.equal(qualityMatch(beach,[calafia]).kind,'nearby'); // Calafia is 3.2 mi from San Onofre
 assert.equal(qualityMatch(beach,[{...calafia,lat:33.45,lng:-117.66}]).kind,'none');
 assert.equal(qualityMatch({...beach,qualityStation:undefined},[calafia,local]).station.id,'9');
 assert.equal(qualityMatch({...beach,qualityStation:undefined},[calafia,local]).kind,'local');
 assert.equal(qualityMatch({...beach,qualityStation:undefined},[{...local,active:false}]).kind,'none');
 assert.equal(shortStationName(calafia.title),'Avenida Calafia');
});
test('wind relative to the beach and compass points',()=>{
 assert.equal(windRelation(225,225),'Onshore'); assert.equal(windRelation(45,225),'Offshore'); assert.equal(windRelation(315,225),'Cross-shore');
 assert.equal(windRelation(350,200),'Offshore'); assert.equal(compass(0),'N'); assert.equal(compass(359),'N'); assert.equal(compass(225),'SW'); assert.equal(windRelation(NaN,200),'');
});
test('morning and afternoon forecasts use local hours of the day',()=>{
 const time=['2026-10-20T07:00','2026-10-20T08:00','2026-10-20T13:00','2026-10-20T14:00','2026-10-21T08:00'];
 const parts=dayparts({time,swell_wave_height:[2,3,4,4,9],swell_wave_period:[12,14,10,10,20]},{time,wind_speed_10m:[4,6,12,14,30],wind_direction_10m:[350,10,250,270,90]},'2026-10-20');
 assert.equal(parts.morning.swell,2.5); assert.equal(parts.afternoon.wind,13); assert.ok(parts.morning.windFrom<5||parts.morning.windFrom>355);
});
test('freshness and grade levels',()=>{
 const now=new Date('2026-10-20T16:00:00Z');
 assert.equal(ageText(new Date('2026-10-20T15:30:00Z'),now),'30 min ago'); assert.equal(ageText(new Date('2026-10-16T12:00:00Z'),now),'4 days ago');
 assert.equal(gradeLevel('A+'),'good'); assert.equal(gradeLevel('C'),'fair'); assert.equal(gradeLevel('F'),'poor');
});
test('drive time text, request groups and rounded location',()=>{
 assert.equal(driveText(1090),'18 min drive'); assert.equal(driveText(3900),'1 hr 5 min drive'); assert.equal(driveText(3600),'1 hr drive'); assert.equal(driveText(20),'1 min drive'); assert.equal(driveText(undefined),'');
 assert.deepEqual(chunks([1,2,3,4,5],2),[[1,2],[3,4],[5]]);
 assert.deepEqual(roundedOrigin({latitude:33.467891,longitude:-117.698456}),{lat:33.468,lng:-117.698});
});
