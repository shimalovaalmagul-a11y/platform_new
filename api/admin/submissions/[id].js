import { allowMethod, handleError, json, readJson } from '../../_lib/http.js';
import { requireAdmin } from '../../_lib/auth.js';
import { getDb } from '../../_lib/db.js';
import { cleanGrade } from '../../_lib/progress.js';
import { parseObjectId, submissionView } from '../../_lib/submissions.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['PATCH'])) return;
  try {
    const admin = await requireAdmin(req);
    const grading = { ...cleanGrade(await readJson(req)), gradedAt: new Date(), graderId: admin._id };
    const collection = (await getDb()).collection('submissions');
    const result = await collection.findOneAndUpdate(
      { _id: parseObjectId(req.query.id) },
      { $set: { grading, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!result) return json(res, 404, { error: 'Жұмыс табылмады.' });
    return json(res, 200, { submission: submissionView(result) });
  } catch (error) {
    return handleError(res, error);
  }
}
