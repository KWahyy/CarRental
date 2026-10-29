import test from 'node:test';
import assert from 'node:assert/strict';
import { sendBusinessEmail, emailConfigured } from '../api/_email.js';
const env = { EMAIL_PROVIDER:'google', GOOGLE_SMTP_USER:'contact@prestigeluxor.com', GOOGLE_SMTP_APP_PASSWORD:'test-secret' };
test('Google sends as the authenticated Prestige mailbox and preserves customer reply-to', async () => {
 let options, mail;
 const result = await sendBusinessEmail({to:['contact@prestigeluxor.com'],reply_to:'customer@example.com',subject:'Quote',text:'Details',html:'<p>Details</p>'}, {env,createTransport:o => {options=o;return {sendMail:async m=>{mail=m;return {messageId:'test-id',accepted:m.to,rejected:[]};}};}});
 assert.equal(options.host,'smtp.gmail.com'); assert.equal(options.secure,true);
 assert.equal(options.auth.user,'contact@prestigeluxor.com');
 assert.equal(mail.from,'Prestige Luxor <contact@prestigeluxor.com>');
 assert.equal(mail.replyTo,'customer@example.com'); assert.equal(result.id,'test-id');
 assert.equal(mail.disableFileAccess,true); assert.equal(mail.disableUrlAccess,true);
});
test('Google mode never falls back to Resend when credentials are missing', async()=>{
 const missing={EMAIL_PROVIDER:'google',RESEND_API_KEY:'old'};
 assert.equal(emailConfigured(missing),false);
 await assert.rejects(sendBusinessEmail({to:['a@example.com']},{env:missing}),/Google email is not configured/);
});
test('rejected Google recipients do not report success',async()=>{
 await assert.rejects(sendBusinessEmail({to:['a@example.com']},{env,createTransport:()=>({sendMail:async()=>({accepted:[],rejected:['a@example.com']})})}),/not accepted/);
});
test('unknown provider fails closed',()=>assert.equal(emailConfigured({EMAIL_PROVIDER:'typo',RESEND_API_KEY:'key'}),false));
