import { allowMethod, handleError, json } from '../_lib/http.js';
import { requireUser } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { parseObjectId, submissionView } from '../_lib/submissions.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  try {
    const user = await requireUser(req);
    const submission = await (await getDb()).collection('submissions').findOne({ _id: parseObjectId(req.query.id) });
    if (!submission) return json(res, 404, { error: 'Жұмыс табылмады.' });
    if (user.role !== 'admin' && !submission.studentId.equals(user._id)) return json(res, 403, { error: 'Бұл жұмысқа қолжетімділік жоқ.' });
    return json(res, 200, { submission: submissionView(submission) });
  } catch (error) {
    return handleError(res, error);
  }
}
