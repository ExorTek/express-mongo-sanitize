const express = require('express');
const assert = require('node:assert');
const { test } = require('node:test');
const expressMongoSanitize = require('../index');
const { set } = require('express/lib/application');

// test('should handle nested objects and arrays', async (t) => {
//   const app = express();
//
//   app.use(express.json());
//   app.use(expressMongoSanitize());
//
//   app.post('/', (req, res) => {
//     res.json(req.body);
//   });
//
//   const server = app.listen(3000);
//
//   const response = await fetch('http://localhost:3000', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({
//       user: {
//         username: '$admin',
//         $password: '$secre.t',
//         preferences: { $set: ['admin'] },
//         history: [{ $push: 'log' }, { $inc: 5 }],
//         details: {
//           nested: { $where: 'javascript' },
//         },
//       },
//     }),
//   });
//
//   const body = await response.json();
//
//   assert.strictEqual(response.status, 200);
//
//   assert.deepEqual(body, {
//     user: {
//       username: 'admin',
//       password: 'secret',
//       preferences: { set: ['admin'] },
//       history: [{ push: 'log' }, { inc: 5 }],
//       details: {
//         nested: { where: 'javascript' },
//       },
//     },
//   });
//
//   server.close();
// });

const loadRoutes = () => {
  const router = express.Router();

  router.get('/router', (req, res) => res.send('Router GET route'));
  router.get('/routerRoute/:id', (req, res) => {
    console.log('req.params', req.params);
    res.send('Router GET route');
  });

  return router;
};

test('should handle different request properties (query, params)', async (t) => {
  const express = require('express');
  const app = express();
  const router = loadRoutes();

  app.use(express.json());

  app.use(
    expressMongoSanitize({
      app: app,
      router: router,
      routerBasePath: '/api/v1',
    })
  );

  app.get('/direct', (req, res) => res.send('Direct route'));
  app.get('/directRoute/:id', (req, res) => res.send('Direct route'));
  app.get('/list/:collection/:id/:name', (req, res) => {
    console.log('req.params', req.params);
    res.send('Direct route');
  });
  app.post('/s', (req, res) => {
    console.log('req.body', req.body);
    res.send('Post route');
  });

  app.use('/api/v1', router);

  const server = await app.listen(3000, () => {});

  await fetch('http://localhost:3000/list/$collection/$id/$name', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((res) => res.text())
    .then((data) => console.log(data));

  await fetch('http://localhost:3000/api/v1/routerRoute/$id', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((res) => res.text())
    .then((data) => console.log(data));

  server.close();
});
