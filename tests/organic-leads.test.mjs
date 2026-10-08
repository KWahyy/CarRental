import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/quote.js';

async function request(overrides = {}) {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.RESEND_API_KEY;
  const oldService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service';
  process.env.RESEND_API_KEY = 'test-only-key';
  const saved = [];
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'api.resend.com') return Response.json({id:'test-mail'});
    if (parsed.pathname === '/rest/v1/quote_requests') {
      if (options.method === 'POST') {
        saved.push(JSON.parse(options.body));
        return Response.json([{id:'test-quote'}]);
      }
      if (options.method === 'PATCH') return new Response(null, {status:204});
    }
    throw new Error(`Unexpected network request blocked: ${parsed.pathname}`);
  };
  const res = { code: 0, status(code) { this.code = code; return this; }, setHeader() { return this; }, end(body) { this.body = JSON.parse(body); } };
  try {
    await handler({method:'POST',headers:{},body:{name:'Test renter',phone:'5550100',requestType:'availability',vehicle:'Test car',message:'Return date: 2026-11-03T12:00',...overrides}},res);
    return {res,saved};
  } finally {
    globalThis.fetch = originalFetch;
    if (oldService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldService;
    if (oldKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = oldKey;
  }
}

test('organic attribution and return details survive into the CRM record', async () => {
  const {res,saved} = await request({attribution:{landing_page:'/cars/tesla-cybertruck',first_referrer:'https://www.google.com/',unexpected:'do not retain'}});
  assert.equal(res.code,200);
  assert.match(saved[0].message,/Return date: 2026-11-03T12:00/);
  assert.match(saved[0].message,/Landing page: \/cars\/tesla-cybertruck/);
  assert.match(saved[0].message,/First referrer: https:\/\/www.google.com\//);
  assert(!saved[0].message.includes('do not retain'));
});

test('initial self-drive wedding inquiry does not require insurance or email', async () => {
  const {res,saved} = await request({requestType:'wedding',source:'wedding',addons:['Self-drive'],email:'',insuranceProvider:''});
  assert.equal(res.code,200);
  assert.equal(saved.length,1);
  assert.equal(saved[0].email,null);
});

test('invalid supplied contact details still fail before any side effect', async () => {
  for (const values of [{phone:''},{email:'invalid-address'}]) {
    const {res,saved} = await request(values);
    assert.equal(res.code,400);
    assert.equal(saved.length,0);
  }
});
