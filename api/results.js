import { allowMethod, handleError, json } from './_lib/http.js';
import { requireUser } from './_lib/auth.js';
import { getDb } from './_lib/db.js';
import { isLearningComplete, progressView } from './_lib/progress.js';
import { submissionView } from './_lib/submissions.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  try {
    const user = await requireUser(req);
    const db = await getDb();
    const [progress, gradedSubmission] = await Promise.all([
      db.collection('progress').findOne({ studentId: user._id }),
      db.collection('submissions').findOne({ studentId: user._id, 'grading.status': 'graded' }, { sort: { 'grading.gradedAt': -1 } }),
    ]);
    const safeProgress = progressView(progress);
    return json(res, 200, {
      progress: safeProgress,
      learningComplete: isLearningComplete(safeProgress),
      grade: gradedSubmission ? submissionView(gradedSubmission) : null,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
