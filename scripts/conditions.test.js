import test from 'node:test';
import assert from 'node:assert/strict';
import {nextTides,pacificTime,utcDate,waterGrade,testedDate,distanceMiles,qualityMatch,shortStationName,windRelation,compass,dayparts,ageText,gradeLevel,driveText,chunks,roundedOrigin,surfEstimate,surfRange,surfQuality,oceanFacing} from '../conditions.js';
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
 for(const beach of data.beaches){assert.ok(!beachIds.has(beach.id));beachIds.add(beach.id);assert.ok(Array.isArray(beach.cams));assert.ok(beach.latitude>32&&beach.latitude<34.5&&beach.longitude>-119&&beach.longitude<-117);assert.ok(beach.facing>=0&&beach.facing<360);assert.ok(beach.exposure>=0&&beach.exposure<=1);for(const id of beach.qualityStations||[])assert.match(id,/^\d+$/);for(const u of [beach.qualityUrl,beach.advisoryUrl])assert.equal(new URL(u).protocol,'https:');for(const cam of beach.cams){assert.ok(!ids.has(cam.id));ids.add(cam.id);assert.equal(new URL(cam.url).protocol,'https:');assert.equal(new URL(cam.sourceUrl).protocol,'https:');assert.ok(['hls','youtube','iframe'].includes(cam.type));}}
});
test('Heal the Bay grades and test dates',()=>{
 assert.equal(waterGrade({dry_grade:'A+'}),'A+'); assert.equal(waterGrade({dry_grade:'b'}),'B');
 assert.equal(waterGrade({dry_grade:'ns'}),null); assert.equal(waterGrade({}),null); assert.equal(waterGrade(undefined),null);
 assert.equal(testedDate('2026-10-16'),'Oct 16'); assert.equal(testedDate('2026-10-16T00:00:00.000Z'),'Oct 16');
 assert.equal(testedDate('2026-10-17T03:00:00Z'),'Oct 16'); assert.equal(testedDate(''),''); assert.equal(testedDate('nope'),'');
});
test('distances and water quality station matching',()=>{
 assert.ok(Math.abs(distanceMiles({lat:33.4612,lng:-117.6870},{lat:33.3735,lng:-117.5655})-9.2)<0.5);
 const now=new Date('2026-10-20T16:00:00Z'), g=(o)=>({active:true,dry_grade:'A',grade_updated:'2026-10-16',...o});
 const onofre={latitude:33.3735,longitude:-117.5655,qualityStations:['241']};
 const calafia=g({id:'241',title:'San Clemente State Beach - Avenida Calafia',lat:33.4045,lng:-117.6070});
 const ungraded=g({id:'2112',title:'San Onofre State Beach - Surf Beach',lat:33.3740,lng:-117.5660,dry_grade:'ns'});
 let m=qualityMatch(onofre,[calafia,ungraded],now); assert.equal(m.station.id,'241'); assert.equal(m.kind,'nearby'); // 3.2 mi, preferred and graded
 m=qualityMatch({...onofre,qualityStations:undefined},[calafia,ungraded],now); assert.equal(m.station.id,'241'); // nearest graded wins over nearer ungraded
 m=qualityMatch({...onofre,qualityStations:undefined},[ungraded],now); assert.equal(m.station.id,'2112'); // falls back to nearest ocean station without a grade
 assert.equal(qualityMatch(onofre,[{...calafia,lat:33.45,lng:-117.66}],now).kind,'nearby'); // preferred station is used even beyond 4 mi
 assert.equal(qualityMatch({...onofre,qualityStations:undefined},[{...calafia,lat:33.45,lng:-117.66}],now).kind,'none');
 assert.equal(qualityMatch({...onofre,qualityStations:undefined},[{...ungraded,active:false}],now).kind,'none');
 // Harbor, creek and drain stations are skipped for open beaches but allowed for a harbor beach.
 const sc={latitude:33.4192,longitude:-117.6205};
 const drain=g({id:'1051',title:'San Clemente Pier drain (Point Zero)',lat:33.4192,lng:-117.6205}), tower=g({id:'240',title:'San Clemente City Beach - Clock Tower North',lat:33.4230,lng:-117.6270});
 assert.equal(qualityMatch(sc,[drain,tower],now).station.id,'240');
 const dock=g({id:'7',title:'Dana Point Harbor, Harbor Patrol Dock',lat:33.4605,lng:-117.6990});
 assert.equal(qualityMatch({latitude:33.46,longitude:-117.6985,harbor:true},[dock],now).station.id,'7');
 assert.equal(qualityMatch({latitude:33.46,longitude:-117.6985},[dock],now).kind,'none');
 assert.equal(qualityMatch(sc,[g({...tower,grade_updated:'2026-08-01'}),drain],now).station.id,'240'); // grade too old: still the nearest ocean station, shown as "No recent test"
 assert.equal(shortStationName(calafia.title),'Avenida Calafia');
 assert.ok(oceanFacing('Monarch Beach')&&oceanFacing('Dana Point - Baby Beach')&&!oceanFacing('Newport Bay - Channel Place')&&!oceanFacing('Carlsbad, Encina Creek outlet'));
});
test('surf estimate depends on swell, direction, period and exposure',()=>{
 const swell={height:3,period:12,direction:215};
 const open=surfEstimate(swell,215,1), doheny=surfEstimate(swell,200,0.45), harbor=surfEstimate(swell,180,0.05);
 assert.ok(open>doheny&&doheny>harbor); assert.ok(harbor<0.5);
 assert.ok(surfEstimate({...swell,direction:35},215,1)<0.5); // swell from behind the beach
 assert.ok(surfEstimate({...swell,period:16},215,1)>surfEstimate({...swell,period:8},215,1));
 assert.equal(surfEstimate({height:NaN,period:12,direction:200},200,1),null);
 assert.equal(surfRange(0.3),'Flat'); assert.equal(surfRange(0.6),'Up to 1 ft'); assert.equal(surfRange(1),'1–2 ft'); assert.equal(surfRange(2.4),'2–3 ft'); assert.equal(surfRange(4.6),'4–5 ft');
 assert.equal(surfQuality('Offshore',12,3),'Clean'); assert.equal(surfQuality('Onshore',14,3),'Choppy'); assert.equal(surfQuality('Cross-shore',8,3),'Fair'); assert.equal(surfQuality('Onshore',4,3),'Clean'); assert.equal(surfQuality('Onshore',14,0.2),'Flat');
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
