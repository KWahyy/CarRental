import test from 'node:test';
import assert from 'node:assert/strict';
import signHandler from '../api/agreements-public.js';
import downloadHandler from '../api/agreement-pdf.js';

const id='11111111-1111-4111-8111-111111111111';
const token='a'.repeat(48);
const signature='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const res=()=>({code:0,status(n){this.code=n;return this},setHeader(){return this},end(body){this.body=body;return this}});

async function scenario(t,{uploadFails=false,storageReadFails=false}={}){
  const envKeys=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
  const previous=envKeys.map(key=>process.env[key]);
  process.env.SUPABASE_URL='https://database.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY='test-server-key';
  t.after(()=>envKeys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];}));
  let agreement={id,access_token:token,agreement_number:'TEST-1',status:'draft',customer_name:'Test renter',vehicle_name:'Test vehicle',terms:'Test agreement',important_terms:[{key:'term',title:'Test term',body:'Test only'}]};
  const files=new Map();
  t.mock.method(globalThis,'fetch',async(url,options={})=>{
    const path=new URL(url).pathname;
    if(path==='/auth/v1/user')return Response.json({id:'test-employee'});
    if(path.endsWith('/admin_profiles'))return Response.json([{role:'owner'}]);
    if(path.endsWith('/rental_agreements')){
      if(options.method==='PATCH')agreement={...agreement,...JSON.parse(options.body)};
      return Response.json([agreement]);
    }
    if(path.endsWith('/rental_agreement_events'))return new Response(null,{status:201});
    if(path.startsWith('/storage/v1/object/')){
      const key=path.split('/rental-documents/')[1];
      if(options.method==='POST'){
        assert.equal(options.headers['x-upsert'],'false');
        if(uploadFails)return Response.json({message:'Storage unavailable'},{status:503});
        assert.equal(files.has(key),false);
        files.set(key,Buffer.from(options.body));
        return Response.json({Key:key});
      }
      if(storageReadFails)return new Response(null,{status:503});
      return new Response(files.get(key));
    }
    throw new Error(`Unexpected test request: ${path}`);
  });
  const response=res();
  // Simulate the renter's separate device: no staff session or Authorization header.
  await signHandler({method:'POST',headers:{'user-agent':'Test remote browser'},body:{token,printed_name:'Test renter',signature_data:signature,initials:{term:'TR'},consents:{reviewed:true,electronic:true,intent:true}}},response);
  return{response,files,getAgreement:()=>agreement};
}

test('remote signature retains a PDF that the CRM downloads byte-for-byte',async t=>{
  const {response,files,getAgreement}=await scenario(t);
  assert.equal(response.code,200,response.body);
  const agreement=getAgreement();
  assert.equal(agreement.status,'signed');
  assert.equal(agreement.signature_name,'Test renter');
  assert.ok(agreement.signed_at);
  assert.ok(files.has(agreement.signed_pdf_path));
  const download=res();
  await downloadHandler({method:'GET',query:{id},headers:{authorization:'Bearer test-staff'}},download);
  assert.equal(download.code,200);
  assert.deepEqual(download.body,files.get(agreement.signed_pdf_path));
});

test('failed PDF storage cannot report a successful signature',async t=>{
  const {response,getAgreement}=await scenario(t,{uploadFails:true});
  assert.equal(response.code,502);
  assert.equal(getAgreement().status,'draft');
  assert.equal(getAgreement().signed_pdf_path,undefined);
});

test('CRM never substitutes a regenerated PDF when the stored copy is unavailable',async t=>{
  await scenario(t,{storageReadFails:true});
  const download=res();
  await downloadHandler({method:'GET',query:{id},headers:{authorization:'Bearer test-staff'}},download);
  assert.equal(download.code,502);
  assert.match(download.body,/saved signed PDF/);
});
