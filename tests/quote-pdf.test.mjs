import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {createQuotePdf,quotePdfFilename} from '../api/_quote-pdf.js';
import {sendBusinessEmail} from '../api/_email.js';
const quote={quote_number:'PL-Q-PREVIEW',revision:1,status:'sent',customer_first_name:'Sample',customer_last_name:'Client',vehicle_name:'2022 Ferrari Roma',start_at:'2026-11-28T18:00:00Z',end_at:'2026-11-29T18:00:00Z',rate_type:'daily',rate_amount:745,duration_value:1,subtotal:745,rental_total:745,amount_required:250,security_deposit:1000,remaining_balance:745};
test('quote generates a readable PDF and long customer messages paginate',async()=>{
 const bytes=await createQuotePdf(quote);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
 const long=await createQuotePdf({...quote,customer_message:'Rental details '.repeat(400)});
 assert.ok((await PDFDocument.load(long)).getPageCount()>1);
 assert.equal(quotePdfFilename({quote_number:'../../unsafe\r\n'}),'------unsafe--.pdf');
});
test('Google email receives exact PDF bytes as an attachment',async()=>{
 const pdf=await createQuotePdf(quote);let mail;
 await sendBusinessEmail({to:['test@example.com'],attachments:[{filename:quotePdfFilename(quote),content:pdf.toString('base64')}]},{env:{EMAIL_PROVIDER:'google',GOOGLE_SMTP_USER:'contact@prestigeluxor.com',GOOGLE_SMTP_APP_PASSWORD:'test'},createTransport:()=>({sendMail:async m=>{mail=m;return {messageId:'test',accepted:m.to,rejected:[]};}})});
 assert.deepEqual(mail.attachments[0].content,pdf);
 assert.equal(mail.attachments[0].contentType,'application/pdf');
 assert.equal(mail.disableFileAccess,true);
});
test('quote send workflow attaches the PDF through Google without contacting a customer',async t=>{
 const {sendQuoteEmail}=await import('../api/quotes.js');
 const nodemailer=(await import('nodemailer')).default;
 const old={EMAIL_PROVIDER:process.env.EMAIL_PROVIDER,GOOGLE_SMTP_USER:process.env.GOOGLE_SMTP_USER,GOOGLE_SMTP_APP_PASSWORD:process.env.GOOGLE_SMTP_APP_PASSWORD};
 Object.assign(process.env,{EMAIL_PROVIDER:'google',GOOGLE_SMTP_USER:'contact@prestigeluxor.com',GOOGLE_SMTP_APP_PASSWORD:'test'});
 let mail;
 t.mock.method(nodemailer,'createTransport',()=>({sendMail:async m=>{mail=m;return {messageId:'mock-google',accepted:m.to,rejected:[]};}}));
 try {
  const missing=await sendQuoteEmail(quote,'https://www.prestigeluxor.com');assert.equal(missing.delivered,false);
  const result=await sendQuoteEmail({...quote,customer_email:'test@example.com'},'https://www.prestigeluxor.com');
  assert.equal(result.delivered,true);assert.equal(mail.attachments[0].filename,'PL-Q-PREVIEW.pdf');
  assert.equal((await PDFDocument.load(mail.attachments[0].content)).getPageCount(),1);
 } finally {for(const [key,value] of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
