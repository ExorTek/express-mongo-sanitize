const express = require('express');
const { test } = require('node:test');
const assert = require('node:assert');
const expressMongoSanitize = require('../index');

test('should handle nested objects and arrays', async () => {
  const app = express();

  app.use(express.json());
  app.use(expressMongoSanitize());

  app.post('/', (req, res) => {
    res.json(req.body);
  });

  const server = app.listen(3000);

  const response = await fetch('http://localhost:3000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user: {
        username: '$admin',
        $password: '$secre.t',
        preferences: { $set: ['admin'] },
        history: [{ $push: 'log' }, { $inc: 5 }],
        details: {
          nested: { $where: 'javascript' },
        },
      },
    }),
  });

  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(data, {
    user: {
      username: 'admin',
      password: 'secret',
      preferences: { set: ['admin'] },
      history: [{ push: 'log' }, { inc: 5 }],
      details: {
        nested: { where: 'javascript' },
      },
    },
  });

  server.close();
});

test('should handle different request properties (query, params)', async () => {
  const app = express();

  app.use(express.json());
  app.use(
    expressMongoSanitize({
      app,
    })
  );

  app.get('/:id', (req, res) => {
    res.json({
      query: req.query,
      params: req.params,
    });
  });

  const server = app.listen(3000);

  const response = await fetch('http://localhost:3000/$123?filter[$regex]=admin', {
    method: 'GET',
  });

  const data = await response.json();
  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(data, { query: { filter: { regex: 'admin' } }, params: { id: '123' } });

  server.close();
});

test('should respect stringOptions configuration', async () => {
  const app = express();

  app.use(express.json());
  app.use(
    expressMongoSanitize({
      stringOptions: {
        trim: true,
        lowercase: true,
        maxLength: 5,
      },
    })
  );

  app.post('/', (req, res) => {
    res.json(req.body);
  });

  const server = app.listen(3000);

  const response = await fetch('http://localhost:3000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: '  $HELLO WORLD  ',
      nested: { value: '  $TEST  ' },
    }),
  });

  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(data, {
    text: 'hello',
    nested: { value: 'test' },
  });

  server.close();
});

test(`should handle array options correctly`, async () => {
  const app = express();

  app.use(express.json());
  app.use(
    expressMongoSanitize({
      arrayOptions: {
        filterNull: true,
        distinct: true,
      },
    })
  );

  app.post('/', (req, res) => {
    res.json(req.body);
  });

  const server = app.listen(3000);

  const response = await fetch('http://localhost:3000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: ['$test', '$test', null, '$value', null],
    }),
  });

  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(data, {
    items: ['test', 'value'],
  });

  server.close();
});

test(`should respect allowedKeys configuration`, async () => {
  const app = express();

  app.use(express.json());
  app.use(
    expressMongoSanitize({
      allowedKeys: ['username', 'email'],
    })
  );

  app.post('/', (req, res) => {
    res.json(req.body);
  });

  const server = app.listen(3000);

  const response = await fetch('http://localhost:3000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: '$admin',
      email: 'test@example.com',
      password: '$ecret',
      role: '$super',
    }),
  });

  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(data, {
    username: 'admin',
    email: 'test@example.com',
  });

  server.close();
});

test(`should respect deniedKeys configuration`, async () => {
  const app = express();

  app.use(express.json());
  app.use(
    expressMongoSanitize({
      deniedKeys: ['email', 'password'],
    })
  );

  app.post('/', (req, res) => {
    res.json(req.body);
  });

  const server = app.listen(3000);

  const response = await fetch('http://localhost:3000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: '$admin',
      email: 'test@example.com',
      password: '$ecret',
      role: '$super',
    }),
  });

  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(data, {
    username: 'admin',
    role: 'super',
  });

  server.close();
});

test(`should handle manual mode and custom route options`, async () => {
  const app = express();

  app.use(express.json());
  app.use(
    expressMongoSanitize({
      mode: 'manual',
    })
  );

  app.post('/', (req, res) => {
    req.sanitize({
      replaceWith: '_',
    });
    res.json(req.body);
  });

  const server = app.listen(3000);

  const response = await fetch('http://localhost:3000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: '$admin',
    }),
  });

  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(data, {
    username: '_admin',
  });

  server.close();
});

test(`should remove matches body`, async () => {
  const app = express();

  app.use(express.json());
  app.use(
    expressMongoSanitize({
      removeMatches: true,
    })
  );

  app.post('/', (req, res) => {
    res.json(req.body);
  });

  const server = app.listen(3000);

  const response = await fetch('http://localhost:3000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: '$admin',
      email: 'mail@mail.com',
      password: '$ecret',
      role: '$super',
    }),
  });

  const data = await response.json();

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(data, {});

  server.close();
});
