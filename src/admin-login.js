export function initAdminLogin({ document, auth, onSignedIn, location, history }) {
  const find = selector => document.querySelector(selector);
  const login = find('[data-login-form]');
  const reset = find('[data-reset-form]');
  const update = find('[data-new-password-form]');
  const status = find('[data-login-status]');
  let recovery = new URLSearchParams(location.search).get('recovery') === '1' || new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
  let busy = false;
  function message(text, error = false) { status.textContent = text; status.dataset.tone = error ? 'error' : ''; }
  function mode(value) {
    login.hidden = value !== 'login'; reset.hidden = value !== 'reset'; update.hidden = value !== 'update';
    find('[data-login-title]').textContent = { login:'Welcome back.', reset:'Reset your password.', update:'Choose a new password.' }[value];
    find('[data-login-description]').textContent = { login:'Sign in to your Prestige Luxor workspace.', reset:'We’ll email a secure link to your account address.', update:'Set a new password to regain access to your workspace.' }[value];
    message('');
  }
  async function run(form, label, action) {
    if (busy) return;
    if (!auth) { message('Sign-in is temporarily unavailable. Please contact your workspace administrator.', true); return; }
    busy = true;
    const button = form.querySelector('[type="submit"]'), original = button.textContent;
    button.textContent = label; form.setAttribute('aria-busy', 'true');
    const buttons = [...document.querySelectorAll('.admin-login-panel button')]; buttons.forEach(button => button.disabled = true);
    message('');
    try { await action(); } catch { message('Unable to connect. Check your connection and try again.', true); }
    finally { busy = false; button.textContent = original; form.removeAttribute('aria-busy'); buttons.forEach(button => button.disabled = false); }
  }
  const password = login.elements.password, toggle = find('[data-password-toggle]');
  toggle.addEventListener('click', () => { const shown = password.type === 'password'; password.type = shown ? 'text' : 'password'; toggle.textContent = shown ? 'Hide' : 'Show'; toggle.setAttribute('aria-pressed', String(shown)); toggle.setAttribute('aria-label', shown ? 'Hide password' : 'Show password'); });
  for (const event of ['keydown','keyup']) password.addEventListener(event, e => { find('[data-caps-note]').hidden = !e.getModifierState?.('CapsLock'); });
  password.addEventListener('blur', () => { find('[data-caps-note]').hidden = true; });
  find('[data-forgot-password]').addEventListener('click', () => { reset.elements.email.value = login.elements.email.value; mode('reset'); reset.elements.email.focus(); });
  document.querySelectorAll('[data-back-login]').forEach(button => button.addEventListener('click', async () => {
    if (recovery && auth) { try { const { error } = await auth.signOut(); if (error) throw error; } catch { message('Unable to end the recovery session. Please try again.', true); return; } }
    recovery = false; history.replaceState({}, '', location.pathname); update.reset(); mode('login'); login.elements.email.focus();
  }));
  login.addEventListener('submit', event => { event.preventDefault(); run(login, 'Signing in…', async () => {
    const { error } = await auth.signInWithPassword({ email:login.elements.email.value.trim(), password:password.value });
    if (error) { message(error.status === 429 ? 'Too many attempts. Please wait a moment and try again.' : 'Unable to sign in. Check your email and password, or reset your password.', true); return; }
    password.value = ''; message(''); onSignedIn();
  }); });
  reset.addEventListener('submit', event => { event.preventDefault(); run(reset, 'Sending link…', async () => {
    const redirectTo = new URL('/admin/?recovery=1', location.origin).href;
    const { error } = await auth.resetPasswordForEmail(reset.elements.email.value.trim(), { redirectTo });
    if (error) { message('Unable to send a reset link right now. Please try again later.', true); return; }
    message('If this email matches an account, a reset link is on its way. Check your inbox and spam folder.');
  }); });
  update.addEventListener('submit', event => { event.preventDefault();
    if (update.elements.password.value.length < 12 || update.elements.password.value !== update.elements.confirm.value) { message('Use at least 12 characters and make sure both passwords match.', true); return; }
    run(update, 'Saving password…', async () => {
      const { data, error:sessionError } = await auth.getSession();
      if (sessionError || !data.session) { message('This reset link has expired or is invalid. Request a new link.', true); return; }
      const { error } = await auth.updateUser({ password:update.elements.password.value });
      if (error) { message('Password could not be updated. Try a different password or request a new reset link.', true); return; }
      update.reset(); recovery = false; history.replaceState({}, '', location.pathname); message(''); onSignedIn();
    });
  });
  if (recovery) mode('update');
  auth?.onAuthStateChange?.(event => { if (event === 'PASSWORD_RECOVERY') { recovery = true; find('[data-login-view]').hidden = false; find('[data-admin-view]').hidden = true; mode('update'); } });
  return { isRecovery: () => recovery };
}
