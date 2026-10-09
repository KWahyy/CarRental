import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {renderPublicDocument} from '../src/public-render.js';
const source=readFileSync('wedding.html','utf8');
const car=(slug,image)=>({slug,name:'Current vehicle '+slug,make:'Current make',model:slug,car_photos:[{position:1,url:image}],price:1000});
const render=rows=>parseHTML(renderPublicDocument(source,rows,{path:'/wedding'})).document;
test('wedding cards use current inventory photos and links, replacing retired cars',()=>{
 const rows=[car('rolls-royce-cullinan-black-badge-rental','https://example.com/new-cover.jpg'),...Array.from({length:6},(_,i)=>car('active-'+i,'https://example.com/'+i+'.jpg'))];
 const doc=render(rows),cards=[...doc.querySelectorAll('.wedding-fleet-car')];
 assert.equal(cards.length,6);assert.equal(new Set(cards.map(c=>c.getAttribute('href'))).size,6);
 assert.equal(cards[0].getAttribute('href'),'/cars/'+rows[0].slug);assert.match(cards[0].querySelector('img').src,/new-cover/);
 assert.ok(!doc.querySelector('.wedding-fleet-lookbook').innerHTML.includes('portofino'));
 rows[0].car_photos[0].url='https://example.com/changed-cover.jpg';assert.match(render(rows).querySelector('.wedding-fleet-car img').src,/changed-cover/);
 const archived=render(rows.slice(1));assert.ok(!archived.querySelector('.wedding-fleet-lookbook').innerHTML.includes('cullinan'));assert.equal(archived.querySelectorAll('.wedding-fleet-car').length,6);
});
test('small or empty inventory never brings back retired wedding cars',()=>{
 const doc=render([car('only-car','/only.jpg')]);assert.equal(doc.querySelectorAll('.wedding-fleet-car').length,1);assert.equal(doc.querySelector('#wedding-fleet-title').textContent,'Choose your arrival.');
 assert.equal(render([]).querySelectorAll('.wedding-fleet-car').length,0);
});
