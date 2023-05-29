"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/app.ts
var import_fastify = __toESM(require("fastify"));
var import_cookie = __toESM(require("@fastify/cookie"));

// src/routes/transactions.ts
var import_node_crypto = __toESM(require("crypto"));
var import_zod2 = require("zod");

// src/database.ts
var import_knex = require("knex");

// src/env/index.ts
var import_dotenv = require("dotenv");
var import_zod = require("zod");
if (process.env.NODE_ENV === "test") {
  (0, import_dotenv.config)({ path: ".env.test" });
} else {
  (0, import_dotenv.config)();
}
var envSchema = import_zod.z.object({
  NODE_ENV: import_zod.z.enum(["development", "test", "production"]).default("production"),
  DATABASE_URL: import_zod.z.string(),
  PORT: import_zod.z.coerce.number().default(3333)
});
var _env = envSchema.safeParse(process.env);
if (_env.success === false) {
  console.log("\u26A0 Invalid environment variables!", _env.error.format());
  throw Error("Invalid environment variables.");
}
var env = _env.data;

// src/database.ts
var config2 = {
  client: "sqlite3",
  connection: {
    filename: env.DATABASE_URL
  },
  useNullAsDefault: true,
  migrations: {
    extension: "ts",
    directory: "./db"
  }
};
var knex = (0, import_knex.knex)(config2);

// src/middlewares/check-session-id-exists.ts
async function checkSessionIdExists(request, reply) {
  if (!request.cookies.sessionId) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

// src/routes/transactions.ts
async function transactionsRoutes(app2) {
  app2.addHook("preHandler", async (request) => {
    console.log(`hook: ${request.method} ${request.url}`);
  });
  app2.post("/", async (request, reply) => {
    const createTransactionBodySchema = import_zod2.z.object({
      title: import_zod2.z.string(),
      amount: import_zod2.z.number(),
      type: import_zod2.z.enum(["credit", "debit"])
    });
    const { title, amount, type } = createTransactionBodySchema.parse(request.body);
    let { sessionId } = request.cookies;
    if (!sessionId) {
      sessionId = import_node_crypto.default.randomUUID();
      reply.setCookie("sessionId", sessionId, {
        path: "/",
        maxAge: 1e3 * 60 * 60 * 24 * 7
      });
    }
    await knex("transactions").insert({
      id: import_node_crypto.default.randomUUID(),
      title,
      amount: type === "credit" ? amount : amount * -1,
      session_id: sessionId
    });
    return reply.status(201).send();
  });
  app2.get("/", { preHandler: [checkSessionIdExists] }, async (request, reply) => {
    const { sessionId } = request.cookies;
    return await knex("transactions").where("session_id", sessionId).select("*");
  });
  app2.get("/:id", { preHandler: checkSessionIdExists }, async (request) => {
    const getTransactionParamsSchema = import_zod2.z.object({ id: import_zod2.z.string().uuid() });
    const { id } = getTransactionParamsSchema.parse(request.params);
    const { sessionId } = request.cookies;
    return await knex("transactions").where({ id, session_id: sessionId }).select("*").first();
  });
  app2.get("/summary", { preHandler: checkSessionIdExists }, async (request, reply) => {
    const { sessionId } = request.cookies;
    return await knex("transactions").where("session_id", sessionId).sum("amount", { as: "amount" }).first();
  });
  app2.put("/:id", { preHandler: [checkSessionIdExists] }, async (request, reply) => {
    const getTransactionParamsSchema = import_zod2.z.object({ id: import_zod2.z.string().uuid() });
    const updateTransactionBodySchema = import_zod2.z.object({
      title: import_zod2.z.string(),
      amount: import_zod2.z.number(),
      type: import_zod2.z.enum(["credit", "debit"])
    });
    const { id } = getTransactionParamsSchema.parse(request.params);
    const { title, amount, type } = updateTransactionBodySchema.parse(request.body);
    const { sessionId } = request.cookies;
    await knex("transactions").update({
      title,
      amount: type === "credit" ? amount : amount * -1
    }).where({ id, session_id: sessionId });
  });
  app2.delete("/:id", { preHandler: [checkSessionIdExists] }, async (request, reply) => {
    const getTransactionParamsSchema = import_zod2.z.object({ id: import_zod2.z.string().uuid() });
    const { id } = getTransactionParamsSchema.parse(request.params);
    const { sessionId } = request.cookies;
    await knex("transactions").where({ id, session_id: sessionId }).delete("*");
  });
}

// src/app.ts
var app = (0, import_fastify.default)();
app.register(import_cookie.default);
app.register(transactionsRoutes, {
  prefix: "transactions"
});

// src/server.ts
app.listen({ port: env.PORT }).then(() => console.log("http server is running"));
