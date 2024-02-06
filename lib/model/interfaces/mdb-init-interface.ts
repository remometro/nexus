/* eslint-disable @typescript-eslint/no-unused-vars */
// mdb-init-interface.ts
import { v4 as uuid } from "uuid"
import type {
  UserSchema,
  INCharacter,
  UserDecoration,
  OrgDecoration,
  ILogger,
  ILogContext,
} from "@types";
import { MongoConnector, _setDb as setDb } from "../mdb-connector";
import {
  DATABASE_STRING as databaseName,
  DATABASE_USERS_STRING as userDatabaseName,
  DATABASE_ORGS_STRING as orgsDatabaseName,
} from "./constants";
import {
  patience
} from "./helpers"
import * as servicesInterfaces from "./services"

import { dbLog } from "@log";

console.log("===== init iface =====", { orgsDatabaseName, userDatabaseName })

/* to-do: move types to declaration file */
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

messageState.get = () => {
  // console.log("@@@ getting current message @@@")
  return messageState
};

oplog._ = {}
oplog._.queue = []

oplog._.decorateLog = ({ type, action, verb, status, message, priority }) => {
  // console.log("@@@ decorating log @@@")
  const statusMessage: ILogContext = {
    type: type || "mongodb",
    action: action || messageState.get().action,
    verb: verb || messageState.get().verb,
    status: status || messageState.get().status,
    message: message || messageState.get().message,
    time: new Date().toISOString(),
    priority: priority || messageState.get().priority || "default",
    _id: uuid(),
  };

  // console.log("@@@ decorated log @@@", { statusMessage })

  return statusMessage
}

oplog._.addToQueue = (payload: ILogContext) => {
  const _action = oplog._.decorateLog(payload)

  const entry = dbLog(_action);

  oplog._.queue.push(_action);
  oplog.push(_action);

  return _action
};

oplog._.inform = (payload) => {
  if (!process.env.ENABLE_LOG === "true")
  if (!Object.isObject(payload) && process.env.LOG_DEPTH == "1") {
    messageState.status = status || messageState.get().status
    console.log("@@@ oplog informing @@@", payload)
  } else {
    const { action, verb, status, message } = payload;
    messageState.action = action || messageState.get().action;
    messageState.verb = verb || messageState.get().verb;
    messageState.status = status || messageState.get().status;
    messageState.message = message || messageState.get().message;
  }

  // console.log({ messageState })

  const log = oplog._.decorateLog(messageState)


  dbLog(log);
  oplog.push(log);
}

oplog._.update = (payload: ILogContext) => {
  const { action, verb, status, message } = payload;
  messageState.action = action || messageState.action;
  messageState.verb = verb || messageState.verb;
  messageState.status = status || messageState.status;
  messageState.message = message || messageState.message;

  oplog._.addToQueue({ action, verb, status, message });
};

oplog._.throw = (e: string) => {
  const ms = {}
  ms.status = "error"
  ms.message = (e as string) || ""
  oplog._.inform(ms);
};


// console.log({ oplog })


/* to-do: move types to declaration file */
interface ILogSafeActionOptions {
    last?: number;
    retry?: boolean;
    interval?: number;
    required?: boolean;
}

interface ILogSafeActionArgs {
  err?: string;
  func: any;
  expectedResult?: any,
  options?: ILogSafeActionOptions
}

/* to-do: use a generic type */
type ILogSafeAction = (fn: ILogSafeActionArgs<"func">, res: ILogSafeActionArgs<"expectedResult">, config: ILogSafeActionOptions) => ILogSafeActionArgs<"expectedResult">

oplog._.safeAction = async (payload: ILogContext, func: any, options: ILogSafeActionOptions) => {
  const verb = payload?.verb || messageState?.verb
  const whatToDo = async () => {
      try {
          messageState.status = "active"
          messageState.message = `[${verb}]:execution-context:starting`
          oplog._.inform();
          

          messageState.status = "done"
          messageState.message = `[${verb}]:success`
          oplog._.inform();

          messageState.status = "active"
          messageState.message = `[${verb}]:deeper-execution-context:starting`
          oplog._.inform();

          
          console.log({ func, type: typeof func })
          if(typeof func === 'function') {
            return await func()
          }
          

          messageState.status = "done"
          oplog._.inform();
          return func
        } catch (e) {
          if(process.LOG_DEPTH == '1'){
            console.error(e)
          }
        }
    };
  return await whatToDo()
}

oplog._.safeActionSync = (func: any, options: ILogSafeActionOptions) => {
  oplog._.safeAction(func, options).then((err, res) => {
    if(err) oplog._.throw(err)
    return res
  })
}



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

const prepare = async (name: Tdbs): (() => any) => {
    console.log("@@@@ prepare @@@@")
    const conn = await MongoConnector;
    const db_conn = await setDb(name);
    const db = await db_conn.db(name);
    console.log("@@@@ prepare again @@@@", { conn, db_conn, db })
    return db;
};


// to-do: singleton + mutex
// to tired to figure this any now
const Instance: any = {}

/* private methods */
/* 0. init */
const init = async ({ name }) => {
    const usersDb = userDatabaseName || databaseName
    console.log("----- @@@ Starting a brand new instance of NexusDB @@@ -----", { Instance })

    const _users = {
      status: "loading",
      db: await prepare(usersDb)
    }

    Instance.users = _users
    console.log({Instance})

    if (process.env.NEXUS_MODE == "full") {
      console.log("FULL MODE", { orgsDatabaseName })
      const _orgs = {
        status: "loading",
        db: await prepare(orgsDatabaseName),
      }
    }

    Instance.private = {}
    Instance.private.loadUsers = async () => {
      const users = await Instance.users.db.collection("users")
      return users 
    }
    Instance.private.users = await Instance.private.loadUsers()

    Instance.public = {}
    Instance.public.getUser = async (email: string) => {
      return await Instance.private.users.findOne({ email })
    }
    Instance.public.updateUser = async ({ email, query, value }) => {
      return await Instance.private.users.updateOne(
          { email },
          { $addToSet: { [query]: value } },
        );
    }


    Instance.ready = true
    return true
}


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
    }
  ) =>
  async () => {
    const collection = await Instance.private[collection];
    const result = collection.updateMany(
      {},
      { $set: schema },
      { upsert: true },
    );
  };

const defineUserSchema = defineSchema(
  {
    db: userDatabaseName || databaseName,
    collection: "users",
    schema: _UserSchema,
  }
);

const defineOrgSchema = defineSchema(
  {
    db: orgsDatabaseName || databaseName,
    collection: "organizations",
    schema: _OrgSchema,
  }
);



const defineRelations = async () => {
  messageState.action = "define schema relations"
  oplog._.inform({
      verb: "enforcing schema relations",
      status: "active",
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

   oplog._.inform({
      verb: "enforcing schema relations",
      status: "ready",
      message: ``,
   });
};



const _initSchemas = async () => {
  messageState.action = "init:schemas"
  oplog._.inform({
      verb: "enforcing schemas",
      status: "active",
      message: ``,
   });
  // IMPORTANT: to-do; work on race conditions; the backwards upsert schema enforcing is the way
  await defineUserSchema();
  await defineOrgSchema();

  await defineRelations();

  oplog._.inform({
      verb: "enforcing schemas",
      status: "ready",
      message: ``,
   });
};

// migrations: add this env var and set it to 'true' to enforce schemas
// or run yarn dev:schema (local), start:schema (CI)
if (process.env.NEXUS_SCHEMA === "true") {
  _initSchemas();
  oplog._.inform({
      verb: "starting data layer (with schema)",
      status: "done",
      message: ``,
   });
} else {
  oplog._.inform({
      verb: "skipping schema loading",
      status: "schema:done",
      message: `not enforcing schemas`,
   });
}

/* decorate public interface */


const getNexus = async () => {
  if (!Instance?.ready) {
    const finished = await init({ name: "NexusDB" })
  }
  return Instance.public
}

const PublicNexus = Instance.public || getNexus()


/* to-do: services, projects, billing, krn cols interfaces. 
(check respective dbs, maybe split init for each db) */

export { 
  PublicNexus as NexusInterface,
}
