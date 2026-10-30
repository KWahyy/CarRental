import test from 'node:test';
import assert from 'node:assert/strict';
import { emailFrame, emailDetails, emailButton } from '../api/_email-template.js';
test('email content escapes customer text and keeps long fields wrappable',()=>{
 const result=emailDetails([['Customer','<script>alert(1)</script>'],['Email','a'.repeat(180)]]);
 assert.ok(!result.includes('<script>'));assert.ok(result.includes('&lt;script&gt;'));assert.match(result,/overflow-wrap:anywhere/);
});
test('frame supports narrow viewports with inline styles and table layout',()=>{
 const html=emailFrame({label:'New request',title:'Your next drive.',intro:'Details',content:'hello'});
 assert.match(html,/name="viewport"/);assert.match(html,/max-width:600px/);assert.match(html,/role="presentation"/);assert.match(html,/@media/);
});
test('action links disallow executable protocols and keep a large tap target',()=>{
 assert.match(emailButton('Review','javascript:alert(1)'),/href="https:\/\/www.prestigeluxor.com"/);
 assert.match(emailButton('Review','https://www.prestigeluxor.com/quote?token=a&b=c'),/a&amp;b=c/);
 assert.match(emailButton('Call','tel:+19496200024'),/padding:17px/);
});
