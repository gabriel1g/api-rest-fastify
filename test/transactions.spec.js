import { execSync } from 'child_process';
import supertest from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { app } from '../src/app';

describe('transactions routes', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    execSync('npm run knex -- migrate:rollback --all');
    execSync('npm run knex -- migrate:latest');
  });

  test('user can create a new transaction', async () => {
    await supertest(app.server)
      .post('/transactions')
      .send({
        title: 'New transaction',
        amount: 1200,
        type: 'credit',
      })
      .expect(201);
  });

  test('list all transactions', async () => {
    const createTransactionResponse = await supertest(app.server).post('/transactions').send({
      title: 'Credit transaction',
      amount: 5000,
      type: 'credit',
    });
    const cookies = createTransactionResponse.get('Set-Cookie');

    await supertest(app.server).post('/transactions').set('Cookie', cookies).send({
      title: 'Debit transaction',
      amount: 2000,
      type: 'debit',
    });

    const listTransactionResponse = await supertest(app.server)
      .get('/transactions')
      .set('Cookie', cookies)
      .expect(200);
    const transactionId = listTransactionResponse.body[0].id;
    const getTransactionResponseId = await supertest(app.server)
      .get(`/transactions/${transactionId}`)
      .set('Cookie', cookies)
      .expect(200);
    const summaryResponse = await supertest(app.server)
      .get('/transactions/summary')
      .set('Cookie', cookies)
      .expect(200);

    expect(getTransactionResponseId.body).toEqual(
      expect.objectContaining({
        id: transactionId,
        title: expect.any(String),
        amount: expect.any(Number),
      })
    );
  });
});
