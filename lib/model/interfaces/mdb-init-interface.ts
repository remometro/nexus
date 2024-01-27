/* eslint-disable @typescript-eslint/no-unused-vars */
// mdb-init-interface.ts
import type {
  UserSchema,
  INCharacter,
  UserDecoration,
  OrgDecoration,
  ILogger,
  ILogContext,
} from "@types";
import { MongoConnector, setDb } from "@model";
import {
  DATABASE_STRING as databaseName,
  DATABASE_USERS_STRING as userDatabaseName,
  DATABASE_ORGS_STRING as orgsDatabaseName,
} from "./constants";
import {
  patience
} from "./helpers"

import { dbLog } from "@log";

// console.log(dbLog)

// we can get more specific later
type Tdbs = "nexus" | "organizations" | "test" | string;

interface IDBGeneric {
  [x: string]: {
    db: unknown;
    collection: unknown;
  };
}

type TDBModel = IDBGeneric & {
  history: ILogContext[];
  collectGarbage: () => void;
};

/* to-do: database connection logs and error handling */
export const oplog: ILogger = [] as unknown as ILogger;
const messageState: ILogContext = {};

oplog._ = {}
oplog._.addToQueue = ({ action, verb, status, message }: ILogContext) => {
  const log: ILogContext = {
    type: "mongodb",
    action: "database",
    verb: verb || messageState.verb,
    status: status || messageState.status,
    message: message || messageState.message,
    time: new Date().toISOString()
  };

  const entry = dbLog(log);
  oplog.push(log);
};

oplog._.update = (payload: ILogContext) => {
  const { action, verb, status, message } = payload;
  messageState.action = action || messageState.action;
  messageState.verb = verb || messageState.verb;
  messageState.status = status || messageState.status;
  messageState.message = message || messageState.message;

  oplog._.addToQueue({ action, verb, status, message });
};

oplog._.throw = (e: string) => {
  const ms = (e as string) || "";
  oplog._.update({ status: "error", message: ms });
};

oplog._.safeAction = (func: any) => {
  const pleaseQueueIt = async () => {
    if(!messageState.status.includes("idle")) {
      await patience()
    }
  }
  
  pleaseQueueIt()


  try {
      return func();
    } catch (e) {
      if (typeof e === "string") {
        oplog._.throw(e);
      } else {
        oplog._.throw(JSON.stringify(e));
      }
    }
};

/* to-do: oplog + garbage collection */
oplog._.history = [] as unknown as ILogContext[];
oplog._.collectGarbage = () => {
  oplog._.history = [..._init.history, ...oplog];
  oplog._.length = 0
};

/* schemas */
const _UserSchema: UserDecoration = {
  rickmorty: {
    favorites: {
      characters: [] as INCharacter["id"][],
    },
  },
  organizations: [],
};

const _OrgSchema: OrgDecoration = {
  name: "demo",
  members: [],
  rickmorty_meta: {
    favorites: {
      characters: [] as INCharacter["id"][],
    },
  },
};

/* private */
const getDB = (name: Tdbs) => async () => {
  return await oplog._.safeAction(async () => {
    oplog._.update({
      verb: "connecting to database",
      status: "init:active",
      message: name || "",
    });
    const conn = await MongoConnector;
    const db_conn = await setDb(name);
    const db = await db_conn.db(name);
    oplog._.update({
      verb: "connected to database",
      status: "init:ready",
      message: name || "",
    });
    return db;
  });
};

const init =
  (db: Tdbs): (() => any) =>
  async (): Promise<any> => {
    return (await oplog._.safeAction(async () => {
      const _getDB = getDB(db);
      const _db = await _getDB();
      console.log({ _db })
      return _db;
    })) as IDBGeneric;
  };


// to-do: singleton + mutex
// to tired to figure this any now
const _init: any = {
  [userDatabaseName || databaseName]: init(userDatabaseName || databaseName),
};

if (process.env.NEXUS_MODE === "full") {
  _init[orgsDatabaseName] = init(orgsDatabaseName);
}

// _init[databaseName] = init(databaseName);

const getCollection =
  async (_db = databaseName) =>
  async (_collection = "users") => {
    return oplog._.safeAction(async () => {
      oplog._.update({
        verb: "loading collection",
        status: "init:active",
        message: `${_db}|${_collection}`,
      });
      if (!_init[_db].db) {
        const db = await _init[_db]();
        _init[_db].db = db;
      }
      console.log({ testing: _init[_db] })
      const collection = await _init[_db].db.collection(_collection);
      if (!_init[_db].db) return oplog._.throw("error connecting to db");

      oplog._.update({
        verb: "loading collection",
        status: "init:ready",
        message: `${_db}|${_collection}`,
      });

      /* init-collections */
      _init[_db].collections = { ..._init[_db].collections };
      _init[_db].collections[_collection] = collection;

      return collection;
    });
  };

/* private methods */

const getUserCollection = async () => {
  return await oplog._.safeAction(async () => {
    const col = await getCollection(userDatabaseName);

    console.log({ Nexus: _init[userDatabaseName] })
    const _col = await col("users")
    //const _col = _init[userDatabaseName].collections || await col("users");

    oplog._.update({
        verb: "loaded collection",
        status: "init:idle",
        message: `${userDatabaseName}|${"users"}`,
    });

    /* coming soon: Nachus: The Cache Layer */
    oplog._.status = {
    ...oplog._.status,
    users: {
        status: "ready",
        firstLoaded: "EOT",
        lastUpdate: new Date().toISOString()
      }
    }

    return _col;
  });

};

const getOrgCollection = async () => {
  return await oplog._.safeAction(async () => {
    const col = await getCollection(orgsDatabaseName);
    const _col = await col("organizations");
    _init[orgsDatabaseName].collections["organizations"] = _col;

    oplog._.update({
        verb: "loaded collection",
        status: "init:idle",
        message: `${orgsDatabaseName}|${"organisations"}`,
    });
    oplog._.status = {
    ...oplog._.status,
    organizations: 'ready'
    }
    return _col;
  });
};


/** ORM **/

// IMPORTANT: to-do: to enforce on existing docs (not on insert only)
const createSchemaQuery = () => {
  // use $exists: false
};

const defineSchema =
  (
    {
      schema,
      db,
      collection: collectionName,
    }: {
      schema: UserDecoration | OrgDecoration;
      db: string;
      collection: string;
    },
    getOneCollection: () => any,
  ) =>
  async () => {
    /* add safe actions */
    oplog._.update({
        verb: "enforcing users schema",
        status: "init:active",
        message: `${db}|${collection}`,
    });
    const collection = await getOneCollection();
    const result = collection.updateMany(
      {},
      { $set: schema },
      { upsert: true },
    );
    oplog._.update({
        verb: "enforcing orgs schema",
        status: "init:ready",
        message: `${db}|${collection}`,
    });
  };

const defineUserSchema = defineSchema(
  {
    db: userDatabaseName || databaseName,
    collection: "users",
    schema: _UserSchema,
  },
  getUserCollection,
);

const defineOrgSchema = defineSchema(
  {
    db: orgsDatabaseName || databaseName,
    collection: "organizations",
    schema: _OrgSchema,
  },
  getOrgCollection,
);

const defineRelations = async () => {
  oplog._.update({
      verb: "enforcing schema relations",
      status: "init:active",
      message: ``,
  });
  const oCollection = await getOrgCollection();
  const uCollection = await getUserCollection();

  /* get demo org */
  const demoOrg = await oCollection.findOne({ name: "demo" });

  // const _userQuerySchema = { ..._UserSchema, organizations: [demoOrg] }
  const _userQuerySchema = { organizations: demoOrg };

  /* users -> org relations */

  /* IMPORTANT: to-do: extract method to add to org */
  const userQuerySchema = {
    db: userDatabaseName || databaseName,
    collection: "users",
    schema: _userQuerySchema,
  };

  const result = uCollection.updateMany(
    {},
    { $push: _userQuerySchema },
    { upsert: true },
  );

   oplog._.update({
      verb: "enforcing schema relations",
      status: "init:ready",
      message: ``,
   });
};

const _initSchemas = async () => {
  oplog._.update({
      verb: "enforcing schemas",
      status: "init:active",
      message: ``,
   });
  // IMPORTANT: to-do; work on race conditions; the backwards upsert schema enforcing is the way
  await defineUserSchema();
  await defineOrgSchema();

  await defineRelations();

  oplog._.update({
      verb: "enforcing schemas",
      status: "init:ready",
      message: ``,
   });
};

// migrations: add this env var and set it to 'true' to enforce schemas
// or run yarn dev:schema (local), start:schema (CI)
if (process.env.NEXUS_SCHEMA === "true") {
  _initSchemas();
  oplog._.update({
      verb: "starting data layer (with schema)",
      status: "init:done",
      message: ``,
   });
} else {
  oplog._.update({
      verb: "starting data layer",
      status: "init:done",
      message: ``,
   });
}

_init.oplog = oplog
_init.log = oplog._.update

_init.getUsers = getUserCollection
/* to-do: services, projects, billing, krn cols interfaces. 
(check respective dbs, maybe split init for each db) */

export { 
  _init as NexusDB 
};
