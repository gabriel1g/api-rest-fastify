import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';

import { knex } from '../database';
import { checkSessionIdExists } from '../middlewares/check-session-id-exists';

export async function transactionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request) => {
    console.log(`hook: ${request.method} ${request.url}`);
  });

  app.post('/', async (request, reply) => {
    const createTransactionBodySchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(['credit', 'debit']),
    });
    const { title, amount, type } = createTransactionBodySchema.parse(request.body);

    let { sessionId } = request.cookies;

    if (!sessionId) {
      sessionId = crypto.randomUUID();

      reply.setCookie('sessionId', sessionId, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }

    await knex('transactions').insert({
      id: crypto.randomUUID(),
      title,
      amount: type === 'credit' ? amount : amount * -1,
      session_id: sessionId,
    });

    return reply.status(201).send();
  });

  app.get('/', { preHandler: [checkSessionIdExists] }, async (request, reply) => {
    const { sessionId } = request.cookies;

    return await knex('transactions').where('session_id', sessionId).select('*');
  });

  app.get('/:id', { preHandler: checkSessionIdExists }, async (request) => {
    const getTransactionParamsSchema = z.object({ id: z.string().uuid() });
    const { id } = getTransactionParamsSchema.parse(request.params);
    const { sessionId } = request.cookies;

    return await knex('transactions').where({ id, session_id: sessionId }).select('*').first();
  });

  app.get('/summary', { preHandler: checkSessionIdExists }, async (request, reply) => {
    const { sessionId } = request.cookies;

    return await knex('transactions')
      .where('session_id', sessionId)
      .sum('amount', { as: 'amount' })
      .first();
  });

  app.put('/:id', { preHandler: [checkSessionIdExists] }, async (request, reply) => {
    const getTransactionParamsSchema = z.object({ id: z.string().uuid() });
    const updateTransactionBodySchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(['credit', 'debit']),
    });
    const { id } = getTransactionParamsSchema.parse(request.params);
    const { title, amount, type } = updateTransactionBodySchema.parse(request.body);
    const { sessionId } = request.cookies;

    await knex('transactions')
      .update({
        title,
        amount: type === 'credit' ? amount : amount * -1,
      })
      .where({ id, session_id: sessionId });
  });

  app.delete('/:id', { preHandler: [checkSessionIdExists] }, async (request, reply) => {
    const getTransactionParamsSchema = z.object({ id: z.string().uuid() });
    const { id } = getTransactionParamsSchema.parse(request.params);
    const { sessionId } = request.cookies;

    await knex('transactions').where({ id, session_id: sessionId }).delete('*');
  });
}
