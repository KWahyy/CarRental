import assert from 'node:assert/strict';
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8775';
for(const path of ['/admin','/admin/','/admin/index.html']){
 const response=await fetch(base+path);assert.equal(response.status,200,`${path} should serve admin`);
 const html=await response.text();assert.match(html,/data-login-form/,`${path} must retain login`);assert.match(html,/noindex/i,`${path} must remain non-indexable`);
}
for(const path of ['/src/admin.js','/src/admin-store.js','/src/supabase-config.js'])assert.equal((await fetch(base+path)).status,200,path);
assert.equal((await fetch(base+'/not-a-real-page-admin-check')).status,404);
for(const method of ['GET','POST','PATCH']){
 const response=await fetch(base+'/api/fleet',{method,...(method==='GET'?{}:{headers:{'Content-Type':'application/json'},body:'{}'})});
 assert.equal(response.status,401,`${method} must reach the authenticated fleet handler`);
 assert.equal((await response.json()).error,'Sign in required.');
}
assert.equal((await fetch(base+'/api/_invoice-core')).status,404);
console.log('PASS: admin URL variants, login markup, noindex, required modules, and unknown-route 404.');
