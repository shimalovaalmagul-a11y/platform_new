'use strict';
const authState = { user: null, loaded: false, loading: false, error: '', adminLoaded: false };

const authEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const formatDate = value => value ? new Intl.DateTimeFormat('kk-KZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Сұрау орындалмады.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function authMessage(message, error = false) {
  return `<div class="feedback ${error ? 'error' : ''}" role="status">${authEscape(message)}</div>`;
}

function authHeader() {
  const link = document.getElementById('auth-link');
  if (link) link.textContent = authState.user ? authState.user.name : 'Кіру';

  const nav = document.querySelector('aside nav');
  let adminLink = document.getElementById('admin-nav-link');
  if (authState.user?.role === 'admin' && !adminLink) {
    adminLink = document.createElement('a');
    adminLink.id = 'admin-nav-link';
    adminLink.href = '#admin';
    adminLink.dataset.view = 'admin';
    adminLink.innerHTML = '11 <span>Әкімші панелі</span>';
    nav.append(adminLink);
  }
  if (authState.user?.role !== 'admin') adminLink?.remove();
}

async function authRefresh() {
  if (authState.loading) return;
  authState.loading = true;
  try {
    const { user } = await api('/api/auth/me');
    authState.user = user;
    authState.error = '';
  } catch (error) {
    authState.user = null;
    authState.error = error.message;
  } finally {
    authState.loaded = true;
    authState.loading = false;
    authHeader();
  }
}

function accountPage() {
  if (!authState.loaded) return head('ЖЕКЕ КАБИНЕТ', 'Кіру немесе тіркелу', 'Тіркелгіні тексеріп жатырмыз…');
  if (authState.user) {
    return head('ЖЕКЕ КАБИНЕТ', `Сәлем, <em>${authEscape(authState.user.name)}</em>`) + `
      <section class="card"><p><b>Рөлі:</b> ${authState.user.role === 'admin' ? 'әкімші' : 'оқушы'}</p><p><b>Email:</b> ${authEscape(authState.user.email)}</p>
      <div class="actions"><a class="button" href="${authState.user.role === 'admin' ? '#admin' : '#submit'}">${authState.user.role === 'admin' ? 'Жұмыстарды қарау →' : 'Жұмысты жіберу →'}</a><button class="secondary" data-auth-action="logout">Шығу</button></div></section>`;
  }
  const backend = authState.error ? authMessage(authState.error.includes('MONGODB_URI') ? 'Деректер қоры әлі қосылмаған. MongoDB және құпия айнымалылар Vercel-ге енгізілген соң кіру ашылады.' : authState.error, true) : '';
  return head('ЖЕКЕ КАБИНЕТ', 'Кіру немесе тіркелу', 'Оқушы өз атымен тіркеледі де, жұмысын мұғалімге жібере алады.') + `${backend}
    <div class="grid2"><section class="card"><h2>Кіру</h2><form id="login-form" class="auth-form"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Құпиясөз<input name="password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Кіру</button><div class="form-result" role="status"></div></form></section>
    <section class="card"><h2>Оқушыны тіркеу</h2><form id="register-form" class="auth-form"><label>Аты-жөні<input name="name" autocomplete="name" minlength="2" maxlength="80" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Құпиясөз<input name="password" type="password" autocomplete="new-password" minlength="10" required></label><p class="hint">Кемінде 10 таңба қолдан. Құпиясөзді мұғалімге жіберме.</p><button class="primary" type="submit">Тіркелу</button><div class="form-result" role="status"></div></form></section></div>`;
}

function submitPage() {
  if (!authState.loaded) return head('ЖҰМЫСТЫ ЖІБЕРУ', 'Тіркелгіні тексеру…');
  if (!authState.user) return head('ЖҰМЫСТЫ ЖІБЕРУ', 'Алдымен жүйеге кір', 'Жұмыс тек тіркелген оқушының атымен қабылданады.') + `<a class="button" href="#account">Кіру немесе тіркелу →</a>`;
  if (authState.user.role === 'admin') return head('ӘКІМШІ', 'Жұмыстарды қарау') + `<a class="button" href="#admin">Әкімші панеліне өту →</a>`;
  const draft = typeof state !== 'undefined' ? state.drafts.final || '' : '';
  return head('ЖҰМЫСТЫ ЖІБЕРУ', 'Талдауыңды мұғалімге жібер', 'Жіберілген мәтін мен файлды әкімші панелінен көріп, жүктеп алуға болады.') + `
    <section class="card"><form id="submission-form" class="auth-form" enctype="multipart/form-data">
      <label>Жұмыс атауы<input name="title" maxlength="140" value="Ұшқан ұя үзінді талдауы" required></label>
      <label>Талдау мәтіні<textarea name="analysis" rows="14" minlength="80" maxlength="50000" required>${authEscape(draft)}</textarea></label>
      <label>Қосымша дереккөздер мен қолданылған көмек<textarea name="additionalSources" rows="3" maxlength="4000" placeholder="Дереккөз атауы немесе сілтемесі және қолдану мақсаты"></textarea></label>
      <label>Файлды тіркеу (қажет болса)<input name="attachment" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"></label>
      <p class="hint">PDF, DOCX немесе TXT. Ең көбі 4 МБ.</p>
      <label class="check-row"><input name="integrityConfirmed" type="checkbox" required><span>Осы жұмысты өзім жаздым. Алынған сөздер мен ойлардың дереккөздерін және қолданған көмекті көрсеттім.</span></label>
      <button class="primary" type="submit">Жұмысты жіберу</button><div class="form-result" role="status"></div></form></section>
    <p class="notice">Жіберген соң файл мен мәтін мұғалімнің әкімші панелінде сақталады. Жібермес бұрын соңғы нұсқаны тексер.</p>`;
}

function adminPage() {
  if (!authState.loaded) return head('ӘКІМШІ ПАНЕЛІ', 'Тіркелгіні тексеру…');
  if (!authState.user) return head('ӘКІМШІ ПАНЕЛІ', 'Кіру қажет') + `<a class="button" href="#account">Әкімші ретінде кіру →</a>`;
  if (authState.user.role !== 'admin') return head('ӘКІМШІ ПАНЕЛІ', 'Қолжетімділік жоқ', 'Бұл бөлім тек әкімші тіркелгісіне ашық.');
  return head('ӘКІМШІ ПАНЕЛІ', 'Оқушылардың жұмыстары', 'Соңғы жіберілген жұмыстар осында көрсетіледі.') + `
    <div class="actions"><button class="primary" data-auth-action="reload-admin">Жаңарту</button><button class="secondary" data-auth-action="logout">Шығу</button></div>
    <div id="admin-result" class="hint" role="status">Жұмыстар жүктелуде…</div><div id="admin-submissions"></div>`;
}

function renderAdminSubmissions(submissions) {
  const target = document.getElementById('admin-submissions');
  if (!target) return;
  if (!submissions.length) {
    target.innerHTML = '<div class="empty">Әзірге жіберілген жұмыс жоқ.</div>';
    return;
  }
  target.innerHTML = submissions.map(item => `<article class="card submission-card"><div class="submission-meta"><span><b>${authEscape(item.student.name)}</b> · ${authEscape(item.student.email)}</span><span>${formatDate(item.createdAt)}</span></div><h2>${authEscape(item.title)}</h2><p class="submission-text">${authEscape(item.analysis)}</p>${item.additionalSources ? `<details><summary>Дереккөздер мен көмек</summary><p>${authEscape(item.additionalSources)}</p></details>` : ''}${item.attachment ? `<p><a class="button secondary" href="/api/submissions/${encodeURIComponent(item.id)}/download">${authEscape(item.attachment.filename)} жүктеу</a> <span class="hint">${Math.ceil(item.attachment.size / 1024)} КБ</span></p>` : '<p class="hint">Файл тіркелмеген.</p>'}<p class="hint">Академиялық адалдық растауы: ${item.integrityConfirmed ? 'берілді' : 'берілмеді'}</p></article>`).join('');
}

async function loadAdminSubmissions() {
  const result = document.getElementById('admin-result');
  if (!result) return;
  result.textContent = 'Жұмыстар жүктелуде…';
  try {
    const { submissions } = await api('/api/admin/submissions?limit=100');
    result.textContent = `Барлығы: ${submissions.length} жұмыс.`;
    renderAdminSubmissions(submissions);
  } catch (error) {
    result.innerHTML = authMessage(error.message, true);
  }
}

async function handleAuthForm(form, endpoint) {
  const result = form.querySelector('.form-result');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  result.textContent = 'Күте тұрыңыз…';
  try {
    const data = Object.fromEntries(new FormData(form));
    const response = await api(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    authState.user = response.user;
    authState.loaded = true;
    authHeader();
    location.hash = authState.user.role === 'admin' ? 'admin' : 'submit';
  } catch (error) {
    result.innerHTML = authMessage(error.message, true);
    button.disabled = false;
  }
}

async function handleSubmission(form) {
  const result = form.querySelector('.form-result');
  const button = form.querySelector('button[type="submit"]');
  if (typeof integrity !== 'undefined' && !integrity.accepted) {
    result.innerHTML = authMessage('Алдымен қорытынды жұмыс бетіндегі академиялық адалдық растауын белгілеңіз.', true);
    return;
  }
  button.disabled = true;
  result.textContent = 'Жұмыс жіберілуде…';
  try {
    const data = new FormData(form);
    const response = await api('/api/submissions', { method: 'POST', body: data });
    result.innerHTML = authMessage(`Жұмыс жіберілді: ${response.submission.title}`);
    form.reset();
    if (typeof state !== 'undefined') state.saved = true;
  } catch (error) {
    result.innerHTML = authMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function authEnhance(view) {
  if (!authState.loaded && !authState.loading) authRefresh().then(() => {
    if (location.hash.slice(1).split('/')[0] === view && ['account', 'submit', 'admin'].includes(view)) render();
  });
  authHeader();
  if (view === 'admin' && authState.user?.role === 'admin') loadAdminSubmissions();
}

document.addEventListener('submit', event => {
  if (event.target.id === 'login-form') { event.preventDefault(); handleAuthForm(event.target, '/api/auth/login'); }
  if (event.target.id === 'register-form') { event.preventDefault(); handleAuthForm(event.target, '/api/auth/register'); }
  if (event.target.id === 'submission-form') { event.preventDefault(); handleSubmission(event.target); }
});

document.addEventListener('click', event => {
  const action = event.target.closest('[data-auth-action]')?.dataset.authAction;
  if (!action) return;
  if (action === 'reload-admin') loadAdminSubmissions();
  if (action === 'logout') api('/api/auth/logout', { method: 'POST' }).finally(() => { authState.user = null; authState.loaded = true; authHeader(); location.hash = 'account'; });
});

function markAuthView(view) {
  document.querySelectorAll('[data-view]').forEach(link => {
    const active = link.dataset.view === view;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function showAuthRoute() {
  const view = location.hash.slice(1).split('/')[0];
  const target = document.getElementById('view');
  if (!target) return;

  if (view === 'account' || view === 'submit' || view === 'admin') {
    target.innerHTML = view === 'account' ? accountPage() : view === 'submit' ? submitPage() : adminPage();
    markAuthView(view);
    authEnhance(view);
    return;
  }

  if (view === 'final' && !document.getElementById('submission-link')) {
    const actions = target.querySelector('.actions');
    if (actions) actions.insertAdjacentHTML('beforeend', '<a id="submission-link" class="button light" href="#submit">Мұғалімге жіберу →</a>');
  }
}

window.addEventListener('hashchange', showAuthRoute);
authRefresh().then(showAuthRoute);
