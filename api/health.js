import { allowMethod, json } from './_lib/http.js';

export default function handler(req, res) {
  if (!allowMethod(req, res, ['GET'])) return;
  return json(res, 200, { ready: Boolean(process.env.MONGODB_URI && process.env.APP_JWT_SECRET), storage: 'mongodb-gridfs' });
}
