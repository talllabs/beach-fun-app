import test from 'node:test';
import assert from 'node:assert/strict';
import {nextTides,pacificTime,utcDate,waterGrade,testedDate} from '../conditions.js';
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
 const data=JSON.parse(readFileSync(new URL('../cams.json',import.meta.url)));const ids=new Set();
 for(const beach of data.beaches){assert.ok(beach.tideStationName&&beach.temperatureStationName);assert.ok(Array.isArray(beach.cams));assert.match(beach.qualityStation,/^\d+$/);assert.ok(beach.qualityStationName);if(beach.qualityUrl)assert.equal(new URL(beach.qualityUrl).protocol,'https:');assert.match(beach.tideStation,/^\d{7}$/);for(const cam of beach.cams){assert.ok(!ids.has(cam.id));ids.add(cam.id);assert.equal(new URL(cam.url).protocol,'https:');assert.equal(new URL(cam.sourceUrl).protocol,'https:');assert.ok(['hls','youtube','iframe'].includes(cam.type));}}
});
test('Heal the Bay grades and test dates',()=>{
 assert.equal(waterGrade({dry_grade:'A+'}),'A+'); assert.equal(waterGrade({dry_grade:'b'}),'B');
 assert.equal(waterGrade({dry_grade:'ns'}),null); assert.equal(waterGrade({}),null); assert.equal(waterGrade(undefined),null);
 assert.equal(testedDate('2026-10-16'),'Oct 16'); assert.equal(testedDate('2026-10-16T00:00:00.000Z'),'Oct 16');
 assert.equal(testedDate('2026-10-17T03:00:00Z'),'Oct 16'); assert.equal(testedDate(''),''); assert.equal(testedDate('nope'),'');
});
