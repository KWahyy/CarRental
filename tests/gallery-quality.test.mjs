import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizedFleetImageUrl} from '../src/supabase-fleet.js';
import {galleryAssets} from '../src/vehicle-gallery-assets.js';
test('large partner galleries use the high-quality image while thumbnails stay small',()=>{
 const source=Object.keys(galleryAssets)[0];
 assert.match(optimizedFleetImageUrl(source,{width:1600}),/-large\.webp$/);
 assert.match(optimizedFleetImageUrl(source,{width:320}),/-thumb\.webp$/);
});

test('reviewed portrait Ferrari exteriors use the same framing for original and local aliases', async()=>{
 const {galleryPreviewPosition}=await import('../src/supabase-fleet.js');
 const local='/assets/partner-fleet/ferrari-296-gtb/01.webp';
 const source=Object.keys(galleryAssets).find(url=>url.startsWith('https:') && galleryAssets[url]==='30a042653098f02f');
 assert.equal(galleryPreviewPosition(source),'50% 65%');
 const alias=Object.keys(galleryAssets).find(url=>url.startsWith('/assets/partner-fleet/ferrari-296-gtb/') && galleryAssets[url]==='30a042653098f02f');
 assert.ok(alias);assert.equal(galleryPreviewPosition(alias),'50% 65%');
 assert.equal(galleryPreviewPosition('/uploads/new-crm-photo.jpg'),'');
});
