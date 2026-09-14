import { allowMethod, handleError, json, readJson } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
import { getDb } from './_lib/db.js';
import { cleanProgress, progressView } from './_lib/progress.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET', 'POST'])) return;
  try {
    const user = await requireUser(req);
    const collection = (await getDb()).collection('progress');
    if (req.method === 'GET') {
      const progress = await collection.findOne({ studentId: user._id });
      return json(res, 200, { progress: progressView(progress) });
    }

    const next = cleanProgress(await readJson(req));
    const previous = await collection.findOne({ studentId: user._id });
    const quiz = next.quiz && (!previous?.quiz || next.quiz.score >= previous.quiz.score) ? next.quiz : previous?.quiz || null;
    const games = { ...(previous?.games || {}) };
    for (const [name, score] of Object.entries(next.games)) games[name] = Math.max(score, games[name] || 0);
    const progress = {
      studentId: user._id,
      lessonIds: [...new Set([...(previous?.lessonIds || []), ...next.lessonIds])].sort((a, b) => a - b),
      quiz,
      games,
      finalPrepared: Boolean(previous?.finalPrepared || next.finalPrepared),
      updatedAt: new Date(),
    };
    await collection.updateOne({ studentId: user._id }, { $set: progress }, { upsert: true });
    return json(res, 200, { progress: progressView(progress) });
  } catch (error) {
    return handleError(res, error);
  }
}
