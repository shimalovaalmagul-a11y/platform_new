'use strict';

const resultState = { data: null, submissions: null, loading: false };
const learningActions = new Set(['complete', 'match-check', 'sequence-check', 'device-check', 'assemble', 'final-review', 'self-review']);
const quizSave = { status: '', message: '', pending: null };

function resultBar(label, value, maximum, caption) {
  const score = Math.max(0, Number(value) || 0);
  const ratio = maximum ? Math.min(100, Math.round(score / maximum * 100)) : 0;
  return `<div class="metric-row"><div><span>${authEscape(label)}</span><b>${authEscape(caption || `${score} / ${maximum}`)}</b></div><div class="metric-track" role="progressbar" aria-label="${authEscape(label)}" aria-valuemin="0" aria-valuemax="${maximum}" aria-valuenow="${score}"><i style="width:${ratio}%"></i></div></div>`;
}

function learningSnapshot() {
  if (typeof state === 'undefined' || typeof questions === 'undefined') return null;
  const checked = id => Object.prototype.hasOwnProperty.call(state.fb || {}, id);
  const games = {};
  if (checked('match')) games.match = matches.filter((item, index) => state.match[index] === String(index)).length;
  if (checked('sequence')) games.sequence = state.sequence.every((value, index) => value === index) ? 1 : 0;
  if (checked('device')) games.device = devices.filter((item, index) => state.device[index] === item[1]).length;
  const quizFinished = state.qi >= questions.length;
  return {
    lessonIds: [...state.done],
    quiz: quizFinished ? { score: state.quiz.filter((answer, index) => answer === questions[index][2]).length, total: questions.length, completed: true } : null,
    games,
    finalPrepared: String(state.drafts.final || '').trim().length >= 80,
  };
}

window.syncLearningProgress = async function syncLearningProgress({ silent = true } = {}) {
  if (!authState.user || authState.user.role === 'admin') return null;
  const snapshot = learningSnapshot();
  if (!snapshot) return null;
  try {
    return await api('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
  } catch (error) {
    if (!silent) throw error;
    return null;
  }
};

function showQuizSaveStatus() {
  if (location.hash.slice(1).split('/')[0] !== 'quiz' || typeof state === 'undefined' || typeof questions === 'undefined' || state.qi < questions.length) return;
  const view = document.getElementById('view');
  const actions = view?.querySelector('.actions');
  if (!actions) return;
  let target = document.getElementById('quiz-save-status');
  if (!target) {
    target = document.createElement('div');
    target.id = 'quiz-save-status';
    target.setAttribute('role', 'status');
    target.setAttribute('aria-live', 'polite');
    actions.before(target);
  }
  const status = quizSave.status || (authState.user ? 'pending' : 'guest');
  const message = quizSave.message || (status === 'guest' ? 'Нәтиже әзірше осы бетте ғана тұр. Мұғалімге көрінуі үшін тіркел немесе жүйеге кір.' : 'Нәтижені мұғалімге сақтау қажет.');
  const action = status === 'guest' ? '<p><a class="button secondary" href="#account">Нәтижені сақтау үшін кіру →</a></p>' : status === 'error' || status === 'pending' ? '<p><button class="secondary" data-result-action="save-quiz">Қайта сақтау</button></p>' : '';
  target.innerHTML = `<div class="feedback ${status === 'error' ? 'error' : ''}"><b>${authEscape(message)}</b>${action}</div>`;
}

window.saveFinishedQuiz = async function saveFinishedQuiz() {
  if (typeof state === 'undefined' || typeof questions === 'undefined' || state.qi < questions.length) return false;
  if (!authState.user) {
    quizSave.status = 'guest';
    quizSave.message = '';
    showQuizSaveStatus();
    return false;
  }
  if (quizSave.pending) return quizSave.pending;
  quizSave.status = 'saving';
  quizSave.message = 'Нәтиже деректер қорына сақталуда…';
  showQuizSaveStatus();
  quizSave.pending = (async () => {
    try {
      const response = await window.syncLearningProgress({ silent: false });
      if (!response?.progress?.quiz?.completed) throw new Error('Сервер тест нәтижесін растаған жоқ.');
      quizSave.status = 'saved';
      quizSave.message = `Нәтиже сақталды: ${response.progress.quiz.score} / ${response.progress.quiz.total}. Мұғалім оны әкімші панелінен көре алады.`;
      return true;
    } catch (error) {
      if (error.status === 401) {
        authState.user = null;
        setAuthToken('');
        authHeader();
        window.dispatchEvent(new Event('authstatechange'));
        quizSave.status = 'guest';
        quizSave.message = 'Нәтиже сақталмады: жүйеге қайта кіріп, оны сақта.';
      } else {
        quizSave.status = 'error';
        quizSave.message = `Нәтиже сақталмады: ${error.message} Қайта сақтау батырмасын бас.`;
      }
      return false;
    } finally {
      quizSave.pending = null;
      showQuizSaveStatus();
    }
  })();
  return quizSave.pending;
};

function updateResultsNavigation() {
  const nav = document.querySelector('aside nav');
  if (!nav) return;
  let link = document.getElementById('results-nav-link');
  if (!authState.user) {
    link?.remove();
    return;
  }
  const isAdmin = authState.user.role === 'admin';
  if (!link) {
    link = document.createElement('a');
    link.id = 'results-nav-link';
    link.href = '#results';
    link.dataset.view = 'results';
    nav.append(link);
  }
  link.innerHTML = `${isAdmin ? '12' : '11'} <span>${isAdmin ? 'Нәтижелер және зерттеу' : 'Менің нәтижелерім'}</span>`;
}

function studentResultsView() {
  return head('МЕНІҢ НӘТИЖЕЛЕРІМ', 'Оқу жолың мен<br><em>бағаланған жұмысың</em>', 'Диаграмма оқу қадамдары аяқталып, мұғалім бағалауды енгізгенде ашылады.') + '<div id="results-content" class="card" role="status">Нәтижелер жүктелуде…</div>';
}

function adminResultsView() {
  return head('НӘТИЖЕЛЕР ЖӘНЕ ЗЕРТТЕУ', 'Сыныптың оқу<br><em>динамикасы</em>', 'Атаулы деректер тек әкімшіге көрінеді. Жиынтық диаграмма зерттеу үшін қолданылады.') + '<div class="actions"><button class="primary" data-result-action="refresh">Жаңарту</button><button class="secondary" data-result-action="csv">CSV жүктеу</button></div><div id="results-content" role="status">Нәтижелер жүктелуде…</div>';
}

function renderStudentResults(data) {
  const target = document.getElementById('results-content');
  if (!target) return;
  const progress = data.progress || {};
  const games = progress.games || {};
  const grade = data.grade?.grading;
  const quizTotal = progress.quiz?.total || (typeof questions === 'undefined' ? 14 : questions.length);
  const learning = `<section class="card results-card"><h2>Оқу қадамдары</h2>${resultBar('Зерттеу сабақтары', (progress.lessonIds || []).length, 6)}${resultBar('Мазмұн тесті', progress.quiz?.score || 0, quizTotal, progress.quiz?.completed ? `${progress.quiz.score} / ${quizTotal}` : 'Әлі аяқталмады')}${resultBar('Кейіпкерді таны', games.match || 0, 5)}${resultBar('Оқиға тізбегі', games.sequence || 0, 1)}${resultBar('Тіл детективі', games.device || 0, 4)}${resultBar('Қорытынды талдау', progress.finalPrepared ? 1 : 0, 1, progress.finalPrepared ? 'Дайын' : 'Дайындалуда')}</section>`;
  if (!data.learningComplete) {
    target.innerHTML = learning + '<section class="notice results-notice"><b>Бағалау диаграммасы әлі ашылмайды.</b><p>Алты сабақты, тестті және үш ойынды аяқта. Қорытынды талдауды жіберген соң мұғалімнің бағасы осы жерде көрсетіледі.</p></section>';
    return;
  }
  if (!grade) {
    target.innerHTML = learning + '<section class="notice results-notice"><b>Оқу қадамдары аяқталды.</b><p>Қорытынды жұмысың мұғалім бағалауын күтіп тұр. Баға енгізілгенде А және Д критерийлері диаграммада көрінеді.</p></section>';
    return;
  }
  target.innerHTML = learning + `<section class="card results-card"><div class="submission-meta"><h2>Мұғалім бағасы</h2><span>${formatDate(grade.gradedAt)}</span></div><div class="score-grid">${resultBar('А · Талдау', grade.scoreA, 8)}${resultBar('Д · Тілді қолдану', grade.scoreD, 8)}${resultBar('Жалпы нәтиже', grade.total, 16)}</div><div class="feedback"><b>Мұғалімнің кері байланысы</b><p class="submission-text">${authEscape(grade.feedback)}</p></div></section>`;
}

function gradeForm(item) {
  const grade = item.grading;
  return `<details class="grading-panel" ${grade ? 'open' : ''}><summary>${grade ? `Бағаланды: А ${grade.scoreA}/8 · Д ${grade.scoreD}/8` : 'Бағалау және кері байланыс'}</summary><form class="auth-form grade-form" data-submission-id="${authEscape(item.id)}"><div class="grade-inputs"><label>А · Талдау<input name="scoreA" type="number" min="0" max="8" value="${grade?.scoreA ?? ''}" required></label><label>Д · Тілді қолдану<input name="scoreD" type="number" min="0" max="8" value="${grade?.scoreD ?? ''}" required></label></div><label>Оқушыға кері байланыс<textarea name="feedback" rows="4" minlength="5" maxlength="5000" required>${authEscape(grade?.feedback || '')}</textarea></label><button class="primary" type="submit">${grade ? 'Бағаны жаңарту' : 'Бағалау нәтижесін жіберу'}</button><div class="form-result" role="status"></div></form></details>`;
}

function renderAdminResults(data, submissions) {
  const target = document.getElementById('results-content');
  if (!target) return;
  resultState.data = data;
  resultState.submissions = submissions;
  const summary = data.summary;
  const students = data.students || [];
  target.innerHTML = `<section class="summary-grid"><article class="card"><small>ТІРКЕЛГЕН ОҚУШЫ</small><strong>${summary.students}</strong></article><article class="card"><small>ОҚУДЫ АЯҚТАДЫ</small><strong>${summary.learningComplete}</strong></article><article class="card"><small>БАҒАЛАНДЫ</small><strong>${summary.graded}</strong></article><article class="card"><small>ОРТАША ҰПАЙ</small><strong>${summary.averageA ?? '—'} / ${summary.averageD ?? '—'}</strong><span>А / Д</span></article></section><section class="card results-card"><h2>Критерийлер бойынша орташа нәтиже</h2>${resultBar('А · Талдау', summary.averageA || 0, 8, summary.averageA === null ? 'Баға жоқ' : `${summary.averageA} / 8`)}${resultBar('Д · Тілді қолдану', summary.averageD || 0, 8, summary.averageD === null ? 'Баға жоқ' : `${summary.averageD} / 8`)}</section><section class="card results-card"><h2>Оқушылардың ілгерілеуі</h2><div class="results-table-wrap"><table class="results-table"><thead><tr><th>Оқушы</th><th>Сабақ</th><th>Тест</th><th>Дайындық</th><th>А</th><th>Д</th><th>Күйі</th></tr></thead><tbody>${students.map(student => `<tr><td><b>${authEscape(student.name)}</b><br><small>${authEscape(student.email)}</small></td><td>${student.progress.lessonIds.length} / 6</td><td>${student.progress.quiz?.completed ? `${student.progress.quiz.score} / ${student.progress.quiz.total}` : '—'}</td><td>${student.progress.finalPrepared ? 'Иә' : '—'}</td><td>${student.grade?.scoreA ?? '—'}</td><td>${student.grade?.scoreD ?? '—'}</td><td>${student.grade ? 'Бағаланды' : student.learningComplete ? 'Бағалауды күтеді' : 'Орындалуда'}</td></tr>`).join('') || '<tr><td colspan="7">Әзірге тіркелген оқушы жоқ.</td></tr>'}</tbody></table></div></section><section class="results-card"><h2>Жұмыстарды бағалау</h2>${submissions.map(item => `<article class="card submission-card"><div class="submission-meta"><span><b>${authEscape(item.student.name)}</b> · ${authEscape(item.student.email)}</span><span>${formatDate(item.createdAt)}</span></div><h3>${authEscape(item.title)}</h3><p class="submission-text">${authEscape(item.analysis)}</p>${gradeForm(item)}</article>`).join('') || '<div class="empty">Бағалайтын жұмыс жоқ.</div>'}</section>`;
}

async function loadResults() {
  const target = document.getElementById('results-content');
  if (!target || !authState.user || resultState.loading) return;
  resultState.loading = true;
  try {
    if (authState.user.role === 'admin') {
      const [data, work] = await Promise.all([api('/api/admin/results'), api('/api/admin/submissions?limit=100')]);
      renderAdminResults(data, work.submissions);
    } else {
      renderStudentResults(await api('/api/results'));
    }
  } catch (error) {
    target.innerHTML = authMessage(error.message, true);
  } finally {
    resultState.loading = false;
  }
}

async function saveGrade(form) {
  const result = form.querySelector('.form-result');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  result.textContent = 'Баға сақталуда…';
  try {
    await api(`/api/admin/submissions/${encodeURIComponent(form.dataset.submissionId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    result.innerHTML = authMessage('Баға мен кері байланыс сақталды.');
    await loadResults();
  } catch (error) {
    result.innerHTML = authMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function downloadCsv() {
  if (!resultState.data?.students) return;
  const safe = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [['Оқушы', 'Email', 'Сабақ', 'Тест', 'А', 'Д', 'Жалпы', 'Оқу аяқталды']];
  for (const student of resultState.data.students) rows.push([student.name, student.email, `${student.progress.lessonIds.length}/6`, student.progress.quiz?.completed ? `${student.progress.quiz.score}/${student.progress.quiz.total}` : '', student.grade?.scoreA ?? '', student.grade?.scoreD ?? '', student.grade?.total ?? '', student.learningComplete ? 'Иә' : 'Жоқ']);
  const blob = new Blob([`\ufeff${rows.map(row => row.map(safe).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ushqan-uya-natizheleri.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function renderResultsRoute() {
  updateResultsNavigation();
  showQuizSaveStatus();
  if (location.hash.slice(1).split('/')[0] !== 'results') return;
  const target = document.getElementById('view');
  if (!target) return;
  if (!authState.loaded) target.innerHTML = head('НӘТИЖЕЛЕР', 'Тіркелгіні тексеру…');
  else if (!authState.user) target.innerHTML = head('НӘТИЖЕЛЕР', 'Кіру қажет', 'Нәтиже тек тіркелген оқушыға және әкімшіге қолжетімді.') + '<a class="button" href="#account">Кіру →</a>';
  else {
    target.innerHTML = authState.user.role === 'admin' ? adminResultsView() : studentResultsView();
    document.querySelectorAll('[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === 'results'));
    loadResults();
  }
}

document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'quiz-next') setTimeout(() => window.saveFinishedQuiz(), 0);
  if (action === 'quiz-reset') { quizSave.status = ''; quizSave.message = ''; }
  if (learningActions.has(action)) setTimeout(() => window.syncLearningProgress(), 0);
  const resultAction = event.target.closest('[data-result-action]')?.dataset.resultAction;
  if (resultAction === 'save-quiz') window.saveFinishedQuiz();
  if (resultAction === 'refresh') loadResults();
  if (resultAction === 'csv') downloadCsv();
});

document.addEventListener('submit', event => {
  if (event.target.matches('.grade-form')) {
    event.preventDefault();
    saveGrade(event.target);
  }
});

window.addEventListener('hashchange', renderResultsRoute);
window.addEventListener('authstatechange', renderResultsRoute);
renderResultsRoute();
