import { GridFSBucket, MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
let clientPromise;

function requireUri() {
  if (!uri) {
    const error = new Error('MONGODB_URI параметрі орнатылмаған.');
    error.status = 503;
    throw error;
  }
}

export async function getDb() {
  requireUri();
  if (!clientPromise) {
    const client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 7000 });
    clientPromise = client.connect();
  }
  const client = await clientPromise;
  return client.db();
}

export async function getFilesBucket() {
  return new GridFSBucket(await getDb(), { bucketName: 'submission_files' });
}

export async function ensureIndexes() {
  const db = await getDb();
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('submissions').createIndex({ studentId: 1, createdAt: -1 }),
    db.collection('submissions').createIndex({ createdAt: -1 }),
    db.collection('progress').createIndex({ studentId: 1 }, { unique: true }),
  ]);
}
