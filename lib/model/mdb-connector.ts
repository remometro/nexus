// mdb-auth.ts TS-Doc?

// This approach is taken from https://github.com/vercel/next.js/tree/canary/examples/with-mongodb
import { MongoClient } from 'mongodb';
import { dbLog as log } from '@log';

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const full_uri = process.env.MONGODB_URI;
const uri_arr = full_uri.split('?');
const uri = uri_arr[0];
const domain = uri.split('@')[1];
const params = '?' + uri_arr[1];

const options = {};

let client;
let clientPromise: Promise<MongoClient>;

const genPromise = (name = '') => {
  const dest = uri + name + params;

  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!global._mongoClientPromise) {
      client = new MongoClient(dest, options);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(dest, options);
    clientPromise = client.connect();
  }

  log({
    type: 'connector',
    action: 'init',
    verb: 'connect',
    status: 'connecting-to',
    message: domain,
  });

  return clientPromise;
};

clientPromise = genPromise();

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export const _setDb = async (db: string) => {
  return genPromise(db);
};
export default clientPromise;
