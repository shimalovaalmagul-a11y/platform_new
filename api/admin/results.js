import { allowMethod, handleError, json } from '../_lib/http.js';
import { requireAdmin } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { isLearningComplete, progressView } from '../_lib/progress.js';

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  try {
    await requireAdmin(req);
    const db = await getDb();
    const [users, allProgress, graded] = await Promise.all([
      db.collection('users').find({ role: 'student' }).sort({ createdAt: 1 }).limit(500).toArray(),
      db.collection('progress').find({}).toArray(),
      db.collection('submissions').find({ 'grading.status': 'graded' }).sort({ 'grading.gradedAt': -1 }).toArray(),
    ]);
    const progressByStudent = new Map(allProgress.map(item => [item.studentId.toString(), progressView(item)]));
    const gradeByStudent = new Map();
    for (const submission of graded) if (!gradeByStudent.has(submission.studentId.toString())) gradeByStudent.set(submission.studentId.toString(), submission.grading);
    const students = users.map(user => {
      const progress = progressByStudent.get(user._id.toString()) || progressView(null);
      const grade = gradeByStudent.get(user._id.toString()) || null;
      return { id: user._id.toString(), name: user.name, email: user.email, progress, grade, learningComplete: isLearningComplete(progress) };
    });
    const gradedStudents = students.filter(item => item.grade);
    const average = key => gradedStudents.length ? Math.round(gradedStudents.reduce((sum, item) => sum + item.grade[key], 0) / gradedStudents.length * 10) / 10 : null;
    return json(res, 200, {
      summary: {
        students: students.length,
        learningComplete: students.filter(item => item.learningComplete).length,
        graded: gradedStudents.length,
        averageA: average('scoreA'),
        averageD: average('scoreD'),
      },
      students,
    });
  } catch (error) {
    return handleError(res, error);
  }
}
