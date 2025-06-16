const express4 = require('express4');
const express = require('express');
const { test, after } = require('node:test');
const assert = require('node:assert');
const { expressMongoSanitize, paramSanitizeHandler } = require('../');

const expressVersions = [
  {
    name: 'Express v4',
    app: express4,
  },
  {
    name: 'Express v5',
    app: express,
  },
];

for (const version of expressVersions) {
  test(`[${version.name}] should handle nested objects and arrays`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize());

    app.post('/', (req, res) => {
      res.json(req.body);
    });

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: {
          username: '$admin',
          $password: '$secre.t',
          preferences: { $set: ['admin'] },
          history: [{ $push: 'log' }, { $inc: 5 }],
          details: { nested: { $where: 'javascript' } },
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
        details: { nested: { where: 'javascript' } },
      },
    });

    server.close();
  });

  test(`[${version.name}] should respect stringOptions configuration`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(
      expressMongoSanitize({
        stringOptions: { trim: true, lowercase: true, maxLength: 5 },
      })
    );

    app.post('/', (req, res) => {
      res.json(req.body);
    });

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  test(`[${version.name}] should handle array options correctly`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(
      expressMongoSanitize({
        arrayOptions: { filterNull: true, distinct: true },
      })
    );

    app.post('/', (req, res) => {
      res.json(req.body);
    });

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  test(`[${version.name}] should respect allowedKeys configuration`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(
      expressMongoSanitize({
        allowedKeys: ['username', 'email'],
      })
    );

    app.post('/', (req, res) => {
      res.json(req.body);
    });

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  test(`[${version.name}] should respect deniedKeys configuration`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(
      expressMongoSanitize({
        deniedKeys: ['email', 'password'],
      })
    );

    app.post('/', (req, res) => {
      res.json(req.body);
    });

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  test(`[${version.name}] should handle manual mode and custom route options`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(
      expressMongoSanitize({
        mode: 'manual',
      })
    );

    app.post('/', (req, res) => {
      req.sanitize({ replaceWith: '_' });
      res.json(req.body);
    });

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '$admin' }),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(data, {
      username: '_admin',
    });

    server.close();
  });

  test(`[${version.name}] should remove matches body`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(
      expressMongoSanitize({
        removeMatches: true,
      })
    );

    app.post('/', (req, res) => {
      res.json(req.body);
    });

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  test(`[${version.name}] should skip specified routes`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(
      expressMongoSanitize({
        skipRoutes: ['/skip'],
      })
    );

    app.post('/skip', (req, res) => {
      res.json(req.body);
    });

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '$admin' }),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(data, { username: '$admin' });

    server.close();
  });

  test(`[${version.name}] should remove empty values if removeEmpty is true`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(
      expressMongoSanitize({
        removeEmpty: true,
      })
    );

    app.post('/', (req, res) => {
      res.json(req.body);
    });

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '',
        password: null,
        role: '$admin',
      }),
    });

    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(data, { role: 'admin' });

    server.close();
  });

  test(`[${version.name}] should sanitize params`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize());

    app.param('username', paramSanitizeHandler());
    app.get('/user/:username', (req, res) => {
      res.json({ username: req.params.username });
    });

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/user/$admin`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(data, { username: 'admin' });

    server.close();
  });

  test(`[${version.name}] should use customSanitizer if provided`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(
      expressMongoSanitize({
        customSanitizer: (data) => {
          if (typeof data === 'string') return 'SAFE';
          if (Array.isArray(data)) return data.map(() => 'SAFE');
          if (typeof data === 'object' && data !== null) {
            const out = {};
            for (const k in data) {
              if (Array.isArray(data[k])) {
                out[k] = data[k].map(() => 'SAFE');
              } else if (typeof data[k] === 'string') {
                out[k] = 'SAFE';
              } else {
                out[k] = data[k];
              }
            }
            return out;
          }
          return data;
        },
      })
    );

    app.post('/', (req, res) => {
      res.json(req.body);
    });

    const server = app.listen(0);
    const port = server.address().port;
    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: '$bar', arr: ['$baz', '$qux'] }),
    });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(data, { foo: 'SAFE', arr: ['SAFE', 'SAFE'] });
    server.close();
  });
}

after(() => {
  setTimeout(() => process.exit(0), 100);
});
