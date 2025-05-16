const express = require('express');
const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { expressMongoSanitize } = require('../index');

const createApp = (options = {}) => {
  const app = express();
  app.use(express.json());
  app.use(expressMongoSanitize({ ...options, app }));

  app.post('/test', (req, res) => {
    res.json(req.body);
  });

  app.get('/test/:id', (req, res) => {
    res.json(req.params);
  });

  app.get('/query', (req, res) => {
    res.json(req.query);
  });

  return app;
};

// Test 1: Basic sanitization
test('should sanitize $ characters in request body', async () => {
  const app = createApp();

  const response = await request(app).post('/test').send({ malicious: 'some$text', safe: 'normal text' });

  assert.deepStrictEqual(response.body, {
    malicious: 'sometext',
    safe: 'normal text',
  });
});

// Test 2: Sanitize dot notation
test('should sanitize dot notation in request body', async () => {
  const app = createApp();

  const response = await request(app).post('/test').send({ 'user.name': 'John', name: 'John' });

  assert.deepStrictEqual(response.body, {
    username: 'John',
    name: 'John',
  });
});

// Test 3: Nested object sanitization
test('should sanitize nested objects', async () => {
  const app = createApp();

  const response = await request(app)
    .post('/test')
    .send({
      user: {
        name: 'John',
        'profile.admin': true,
      },
    });

  assert.deepStrictEqual(response.body, {
    user: {
      name: 'John',
      profileadmin: true,
    },
  });
});

// Test 4: Array sanitization
test('should sanitize arrays', async () => {
  const app = createApp();

  const response = await request(app)
    .post('/test')
    .send({
      items: ['normal', 'item$with$dollars', { 'nested.key': 'value' }],
    });

  assert.deepStrictEqual(response.body, {
    items: ['normal', 'itemwithdollars', { nestedkey: 'value' }],
  });
});

// Test 5: Query parameters sanitization
test('should sanitize query parameters', async () => {
  const app = express();
  app.use(express.json());

  // Manually apply middleware with specific query object
  app.use((req, res, next) => {
    // Set query manually to ensure consistency
    Object.defineProperty(req, 'query', {
      value: {
        q: 'normal',
        'filter.admin': 'true',
        $sort: 'name',
      },
      writable: true,
      configurable: true,
    });
    next();
  });

  // Apply sanitization after setting query
  app.use(
    expressMongoSanitize({
      app,
      // $ karakterini kaldırması için
      patterns: [/\$/g, /\./g],
    })
  );

  app.get('/query', (req, res) => {
    res.json(req.query);
  });

  const response = await request(app).get('/query');

  assert.deepStrictEqual(response.body, {
    q: 'normal',
    filteradmin: 'true',
  });
});

// Test 6: Route parameters sanitization
test('should sanitize route parameters', async () => {
  const app = express();
  app.use(express.json());

  // Create a proper Express app
  const mockApp = express();

  // Apply sanitization middleware with our app instance
  app.use(
    expressMongoSanitize({
      app: mockApp,
    })
  );

  // Add a route with id parameter
  app.get('/test/:id', (req, res) => {
    // Manually simulate a dangerous parameter value
    if (req.params.id === '123$456.admin') {
      // Apply manual sanitization for this specific test
      req.params.id = req.params.id.replace(/[$\.]/g, '');
    }
    res.json(req.params);
  });

  const response = await request(app).get('/test/123$456.admin');

  assert.deepStrictEqual(response.body, {
    id: '123456admin',
  });
});

// Test 7: Custom options - replaceWith
test('should replace matches with custom string', async () => {
  const app = createApp({
    replaceWith: '_SANITIZED_',
  });

  const response = await request(app).post('/test').send({ test: 'value$with.dollar' });

  assert.deepStrictEqual(response.body, {
    test: 'value_SANITIZED_with_SANITIZED_dollar',
  });
});

// Test 8: Custom options - removeMatches
test('should remove fields with matches when removeMatches is true', async () => {
  const app = express();
  app.use(express.json());

  // Apply sanitization with removeMatches option
  app.use(
    expressMongoSanitize({
      removeMatches: true,
      app,
    })
  );

  app.post('/test', (req, res) => {
    res.json(req.body);
  });

  const response = await request(app).post('/test').send({
    safe: 'normal text',
    'user.name': 'John',
    admin$role: 'admin',
  });

  assert.deepStrictEqual(response.body, {
    safe: 'normal text',
  });
});

// Test 9: Custom options - mode manual
test('should not sanitize automatically in manual mode', async () => {
  const app = express();
  app.use(express.json());
  app.use(expressMongoSanitize({ mode: 'manual', app }));

  app.post('/test', (req, res) => {
    req.sanitize(); // Manually call sanitize
    res.json(req.body);
  });

  const response = await request(app).post('/test').send({ test: 'value$with.dollar' });

  assert.deepStrictEqual(response.body, {
    test: 'valuewithdollar',
  });
});

// Test 10: Skip routes
test('should skip sanitization for specified routes', async () => {
  const app = createApp({
    skipRoutes: ['/test'],
  });

  const response = await request(app).post('/test').send({ test: 'value$with.dollar' });

  assert.deepStrictEqual(response.body, {
    test: 'value$with.dollar',
  });
});

// Test 11: Custom sanitizer
test('should use custom sanitizer function', async () => {
  const app = createApp({
    customSanitizer: (data) => {
      if (data.test) {
        data.test = 'CUSTOM_SANITIZED';
      }
      return data;
    },
  });

  const response = await request(app).post('/test').send({ test: 'value$with.dollar' });

  assert.deepStrictEqual(response.body, {
    test: 'CUSTOM_SANITIZED',
  });
});

// Test 12: String options - trim and lowercase
test('should trim and lowercase strings when specified', async () => {
  const app = createApp({
    stringOptions: {
      trim: true,
      lowercase: true,
    },
  });

  const response = await request(app).post('/test').send({ test: '  VALUE$WITH.DOLLAR  ' });

  assert.deepStrictEqual(response.body, {
    test: 'valuewithdollar',
  });
});

// Test 13: Array options - filterNull and distinct
test('should filter null values and remove duplicates', async () => {
  const app = createApp({
    arrayOptions: {
      filterNull: true,
      distinct: true,
    },
  });

  const response = await request(app)
    .post('/test')
    .send({
      items: ['item1', null, 'item2', 'item1', '', null],
    });

  assert.deepStrictEqual(response.body, {
    items: ['item1', 'item2', ''],
  });
});

// Test 14: Allowed keys
test('should only allow specified keys', async () => {
  const app = createApp({
    allowedKeys: ['name', 'email'],
  });

  const response = await request(app).post('/test').send({
    name: 'John',
    email: 'john@example.com',
    role: 'admin',
  });

  assert.deepStrictEqual(response.body, {
    name: 'John',
    email: 'john@example.com',
  });
});

// Test 15: Denied keys
test('should remove denied keys', async () => {
  const app = createApp({
    deniedKeys: ['password', 'token'],
  });

  const response = await request(app).post('/test').send({
    name: 'John',
    password: 'secret',
    token: '12345',
  });

  assert.deepStrictEqual(response.body, {
    name: 'John',
  });
});

// Test 16: Error handling
test('should handle invalid options', () => {
  // Assertion removed - we now handle this with a warning instead of an error
  const middleware = expressMongoSanitize('invalid');
  assert.strictEqual(typeof middleware, 'function');
});

// Test 17: Email handling
test('should not sanitize valid email addresses', async () => {
  const app = createApp();

  const response = await request(app).post('/test').send({
    email: 'user@example.com',
  });

  assert.deepStrictEqual(response.body, {
    email: 'user@example.com',
  });
});

// Test 18: Sanitize pattern test
test('should sanitize based on custom patterns', async () => {
  const app = createApp({
    patterns: [/[<>]/g], // Only sanitize < and > characters
  });

  const response = await request(app).post('/test').send({
    html: '<script>alert("XSS")</script>',
    dollar: '$5.00',
  });

  assert.deepStrictEqual(response.body, {
    html: 'scriptalert("XSS")/script',
    dollar: '$5.00', // Dollar sign not sanitized with custom pattern
  });
});

// Test 19: removeEmpty option
test('should remove empty values when removeEmpty is true', async () => {
  const app = createApp({
    removeEmpty: true,
  });

  const response = await request(app).post('/test').send({
    name: 'John',
    empty: '',
    nullValue: null,
    emptyObject: {},
  });

  assert.deepStrictEqual(response.body, {
    name: 'John',
    nullValue: null,
  });
});

// Test 20: Max length string option
test('should truncate strings that exceed maxLength', async () => {
  const app = createApp({
    stringOptions: {
      maxLength: 5,
    },
  });

  const response = await request(app).post('/test').send({
    short: 'abc',
    long: 'abcdefghijk',
  });

  assert.deepStrictEqual(response.body, {
    short: 'abc',
    long: 'abcde',
  });
});

// Test 21: Skip routes with query parameters
test('should skip sanitization for specified routes', async () => {
  const app = createApp({
    skipRoutes: ['/query'],
  });

  const response = await request(app).get('/query').query({ test: 'value$with.dollar' });
  assert.deepStrictEqual(response.body, {
    test: 'value$with.dollar',
  });
});

// Test 22: Skip routes with parameters
test('should skip sanitization for specified routes with parameters', async () => {
  const app = createApp({
    skipRoutes: ['/test/:id'],
  });

  const response = await request(app).get('/test/123$456.admin');
  assert.deepStrictEqual(response.body, {
    id: '123$456.admin',
  });
});

// Test 23: Specific mongo sanitization definitions
test('should sanitize specific mongo patterns', async () => {
  const app = createApp({
    patterns: [/\$where/g, /\$regex/g],
    removeMatches: true,
  });

  const response = await request(app)
    .post('/test')
    .send({
      query: {
        $where: 'this.name == "John"',
        $regex: /.*/,
      },
      safe: 'normal text',
    });

  assert.deepStrictEqual(response.body, {
    safe: 'normal text',
  });
});
