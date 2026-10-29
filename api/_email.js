// Switch EMAIL_PROVIDER to google only after Google Workspace credentials are configured.
export function emailConfigured(env = process.env) {
  const provider = env.EMAIL_PROVIDER || 'resend';
  if (provider === 'google') return env.GOOGLE_SMTP_USER === 'contact@prestigeluxor.com' && Boolean(env.GOOGLE_SMTP_APP_PASSWORD?.trim());
  return provider === 'resend' && Boolean(env.RESEND_API_KEY);
}

export async function sendBusinessEmail(message, { env = process.env, createTransport } = {}) {
  const provider = env.EMAIL_PROVIDER || 'resend';
  if (provider === 'google') {
    if (!emailConfigured(env)) throw new Error('Google email is not configured.');
    const factory = createTransport || (await import('nodemailer')).default.createTransport;
    const transport = factory({host:'smtp.gmail.com',port:465,secure:true,
      auth:{user:env.GOOGLE_SMTP_USER,pass:env.GOOGLE_SMTP_APP_PASSWORD.replace(/\s/g,'')},
      connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000});
    const result = await transport.sendMail({
      from:'Prestige Luxor <contact@prestigeluxor.com>',to:message.to,
      replyTo:message.reply_to || 'contact@prestigeluxor.com',
      subject:message.subject,text:message.text,html:message.html,
      disableFileAccess:true,disableUrlAccess:true,
    });
    if (!result.accepted?.length || result.rejected?.length) throw new Error('Email recipients were not accepted by Google.');
    return {id:result.messageId};
  }
  if (provider !== 'resend' || !emailConfigured(env)) throw new Error('Email delivery is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({...message,from:env.QUOTE_FROM_EMAIL || 'Prestige Luxor <onboarding@resend.dev>'}),
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.message || 'Email could not be delivered.');
  return data;
}
