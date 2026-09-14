import { clientError } from './http.js';

const GAME_MAX = { match: 5, sequence: 1, device: 4 };

function numberInRange(value, min, max, label) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) throw clientError(`${label} жарамсыз.`);
  return numeric;
}

export function cleanProgress(input) {
  const lessons = Array.isArray(input.lessonIds) ? [...new Set(input.lessonIds.map(Number))].sort((a, b) => a - b) : [];
  if (lessons.some(value => !Number.isInteger(value) || value < 0 || value > 5)) throw clientError('Сабақтар тізімі жарамсыз.');

  let quiz = null;
  if (input.quiz) {
    const total = numberInRange(input.quiz.total, 1, 50, 'Тест сұрақтарының саны');
    quiz = { score: numberInRange(input.quiz.score, 0, total, 'Тест ұпайы'), total, completed: input.quiz.completed === true };
  }

  const games = {};
  for (const [name, max] of Object.entries(GAME_MAX)) {
    if (input.games?.[name] !== undefined && input.games[name] !== null) games[name] = numberInRange(input.games[name], 0, max, 'Ойын нәтижесі');
  }

  return { lessonIds: lessons, quiz, games, finalPrepared: input.finalPrepared === true };
}

export function cleanGrade(input) {
  const scoreA = numberInRange(input.scoreA, 0, 8, 'А критерийінің ұпайы');
  const scoreD = numberInRange(input.scoreD, 0, 8, 'Д критерийінің ұпайы');
  const feedback = String(input.feedback || '').trim();
  if (feedback.length < 5 || feedback.length > 5_000) throw clientError('Кері байланыс 5–5000 таңба болуы керек.');
  return { scoreA, scoreD, feedback, total: scoreA + scoreD, status: 'graded' };
}

export function progressView(progress) {
  return {
    lessonIds: progress?.lessonIds || [],
    quiz: progress?.quiz || null,
    games: progress?.games || {},
    finalPrepared: Boolean(progress?.finalPrepared),
    updatedAt: progress?.updatedAt || null,
  };
}

export function isLearningComplete(progress) {
  const gameScores = progress?.games || {};
  return (progress?.lessonIds || []).length === 6
    && progress?.quiz?.completed === true
    && gameScores.match === GAME_MAX.match
    && gameScores.sequence === GAME_MAX.sequence
    && gameScores.device === GAME_MAX.device
    && progress?.finalPrepared === true;
}
