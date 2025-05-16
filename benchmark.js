'use strict';

const Benchmark = require('benchmark');
const express = require('express');
const request = require('supertest');
const expressMongoSanitize = require('./index');
const http = require('http');

// Create a benchmark suite
const suite = new Benchmark.Suite();

// Setup test data with various levels of complexity
const testData = {
  simple: {
    body: { name: 'John', age: 30 },
  },
  medium: {
    body: {
      user: {
        name: 'John',
        email: 'john@example.com',
        preferences: {
          theme: 'dark',
          notifications: true,
        },
      },
      query: '$where: function() { return true }',
      sort: { $eleMatch: { field: 1 } },
    },
  },
  complex: {
    body: {
      users: Array(50)
        .fill()
        .map((_, i) => ({
          // Reduced from 100 to 50 for better performance
          id: i,
          name: `User${i}`,
          email: `user${i}@example.com`,
          metadata: {
            created: new Date(),
            lastLogin: new Date(),
            settings: {
              theme: i % 2 ? 'light' : 'dark',
              language: i % 3 ? 'en' : 'es',
              notifications: {
                email: true,
                push: i % 2 === 0,
              },
            },
          },
          $where: `function() { return this.id === ${i} }`,
          '.': { dangerous: true },
        })),
      filters: {
        $and: [{ $or: [{ status: 'active' }, { status: 'pending' }] }, { $nin: { category: ['deleted', 'banned'] } }],
      },
    },
  },
  emptyFields: {
    body: {
      query: { '': {} },
      safe: 'normal text',
    },
  },
};

// Create a server pool to reuse servers
const serverPool = [];
const MAX_SERVERS = 5;

async function getServer() {
  if (serverPool.length > 0) {
    return serverPool.pop();
  }

  return null; // Will create a new server if none is available
}

function releaseServer(server) {
  if (serverPool.length < MAX_SERVERS) {
    serverPool.push(server);
  } else {
    server.close();
  }
}

// Function to create an Express app with the middleware
function createApp(options = {}, useMiddleware = true) {
  const app = express();
  app.use(express.json({ limit: '10mb' })); // Increased limit

  // Only apply sanitization middleware if useMiddleware is true
  if (useMiddleware) {
    app.use(expressMongoSanitize({ ...options, app }));
  }

  app.post('/test', (req, res) => {
    res.json(req.body);
  });

  return app;
}

// Allow some time between requests
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Modified to handle server properly with increased timeout
async function runTest(app, data) {
  let server = await getServer();
  const needsNewServer = !server;

  if (needsNewServer) {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
  }

  const port = server.address().port;

  // Create a new agent for each request with increased timeout
  const agent = request.agent(server).timeout(5000); // 5 second timeout

  const res = await agent.post('/test').send(data).expect(200);

  // Small delay to prevent overwhelming the system
  await sleep(10);

  if (needsNewServer) {
    releaseServer(server);
  }

  return res;
}

console.log('Starting benchmarks...');

// Add benchmark tests for no middleware scenario
// 0. Benchmark with NO middleware - Simple data
suite.add('NO middleware - Simple data', {
  defer: true,
  fn: function (deferred) {
    const app = createApp({}, false); // false indicates no middleware
    runTest(app, testData.simple.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (no middleware, simple data):', err.message);
        deferred.resolve(); // Resolve anyway to continue the benchmark
      });
  },
});

// 0-B. Benchmark with NO middleware - Medium data
suite.add('NO middleware - Medium data', {
  defer: true,
  fn: function (deferred) {
    const app = createApp({}, false);
    runTest(app, testData.medium.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (no middleware, medium data):', err.message);
        deferred.resolve();
      });
  },
});

// 0-C. Benchmark with NO middleware - Complex data
suite.add('NO middleware - Complex data', {
  defer: true,
  fn: function (deferred) {
    const app = createApp({}, false);
    runTest(app, testData.complex.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (no middleware, complex data):', err.message);
        deferred.resolve();
      });
  },
});

// 1. Benchmark with default options
suite.add('Default options - Simple data', {
  defer: true,
  fn: function (deferred) {
    const app = createApp();
    runTest(app, testData.simple.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (simple data):', err.message);
        deferred.resolve(); // Resolve anyway to continue the benchmark
      });
  },
});

// 2. Benchmark with default options - Medium complexity
suite.add('Default options - Medium data', {
  defer: true,
  fn: function (deferred) {
    const app = createApp();
    runTest(app, testData.medium.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (medium data):', err.message);
        deferred.resolve();
      });
  },
});

// 3. Benchmark with default options - Complex data
suite.add('Default options - Complex data', {
  defer: true,
  fn: function (deferred) {
    const app = createApp();
    runTest(app, testData.complex.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (complex data):', err.message);
        deferred.resolve();
      });
  },
});

// 4. Benchmark with empty fields
suite.add('Default options - Empty fields', {
  defer: true,
  fn: function (deferred) {
    const app = createApp();
    runTest(app, testData.emptyFields.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (empty fields):', err.message);
        deferred.resolve();
      });
  },
});

// 5. Benchmark with custom sanitizer
suite.add('Custom sanitizer - Complex data', {
  defer: true,
  fn: function (deferred) {
    const app = createApp({
      customSanitizer: (data) => {
        // Simple custom sanitizer
        const sanitized = {};
        for (const key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            if (key.startsWith('$') || key.includes('.')) continue;
            sanitized[key] = data[key];
          }
        }
        return sanitized;
      },
    });

    runTest(app, testData.complex.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (custom sanitizer):', err.message);
        deferred.resolve();
      });
  },
});

// 6. Benchmark with manual mode
suite.add('Manual mode - Complex data', {
  defer: true,
  fn: function (deferred) {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(expressMongoSanitize({ mode: 'manual', app }));

    app.post('/test', (req, res) => {
      req.sanitize();
      res.json(req.body);
    });

    runTest(app, testData.complex.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (manual mode):', err.message);
        deferred.resolve();
      });
  },
});

// 7. Benchmark with recursive option disabled
suite.add('Recursive disabled - Complex data', {
  defer: true,
  fn: function (deferred) {
    const app = createApp({ recursive: false });
    runTest(app, testData.complex.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (recursive disabled):', err.message);
        deferred.resolve();
      });
  },
});

// 8. Benchmark with string options
suite.add('String options - Complex data', {
  defer: true,
  fn: function (deferred) {
    const app = createApp({
      stringOptions: {
        trim: true,
        lowercase: true,
        maxLength: 50,
      },
    });

    runTest(app, testData.complex.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (string options):', err.message);
        deferred.resolve();
      });
  },
});

// 9. Benchmark with removeEmpty enabled
suite.add('RemoveEmpty enabled - Complex data', {
  defer: true,
  fn: function (deferred) {
    const app = createApp({ removeEmpty: true });
    runTest(app, testData.complex.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (removeEmpty):', err.message);
        deferred.resolve();
      });
  },
});

// 10. Benchmark with removeEmpty enabled - Empty fields
suite.add('RemoveEmpty enabled - Empty fields', {
  defer: true,
  fn: function (deferred) {
    const app = createApp({ removeEmpty: true });
    runTest(app, testData.emptyFields.body)
      .then(() => deferred.resolve())
      .catch((err) => {
        console.error('Error in test (removeEmpty empty):', err.message);
        deferred.resolve();
      });
  },
});

// Add listeners
suite
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {
    console.log('Benchmark completed');
    console.log('Fastest is ' + this.filter('fastest').map('name'));

    // Close any remaining servers in the pool
    serverPool.forEach((server) => {
      server.close();
    });

    // Run memory test after benchmark completes
    runMemoryTest();
  })
  .run({ async: true });

// Memory usage benchmark - Simplified for reliability
function runMemoryTest() {
  console.log('\nMemory Usage Tests:');

  const testCases = [
    { name: 'Simple data', data: testData.simple.body },
    { name: 'Medium data', data: testData.medium.body },
    { name: 'Complex data', data: testData.complex.body },
    { name: 'Empty fields', data: testData.emptyFields.body },
  ];

  const configurations = [
    { name: 'NO middleware', options: {}, useMiddleware: false },
    { name: 'Default options', options: {} },
    { name: 'RemoveEmpty enabled', options: { removeEmpty: true } },
    { name: 'Recursive disabled', options: { recursive: false } },
  ];

  for (const config of configurations) {
    console.log(`\nConfiguration: ${config.name}`);

    for (const testCase of testCases) {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const beforeMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      // Create a mock request object
      const req = {
        body: JSON.parse(JSON.stringify(testCase.data)),
        params: {},
        query: {},
      };

      // Apply the middleware logic directly (only if middleware is being used)
      if (config.useMiddleware !== false) {
        const { DEFAULT_OPTIONS, handleRequest } = require('./helpers');
        handleRequest(req, { ...DEFAULT_OPTIONS, ...config.options });
      }

      const afterMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      console.log(`  ${testCase.name}: ${(afterMemory - beforeMemory).toFixed(4)} MB`);
    }
  }

  // Run response tests after memory tests
  runResponseTest();
}

// Run a single iteration of each test to measure responses - Simplified
async function runResponseTest() {
  console.log('\nResponse Tests:');

  const noMiddlewareApp = createApp({}, false);
  const app = createApp();
  const appWithRemoveEmpty = createApp({ removeEmpty: true });

  // Create servers for all tests
  const noMiddlewareServer = http.createServer(noMiddlewareApp);
  const server = http.createServer(app);
  const serverWithRemoveEmpty = http.createServer(appWithRemoveEmpty);

  await new Promise((resolve) => noMiddlewareServer.listen(0, resolve));
  await new Promise((resolve) => server.listen(0, resolve));
  await new Promise((resolve) => serverWithRemoveEmpty.listen(0, resolve));

  for (const [name, data] of Object.entries(testData)) {
    console.log(`\nTest case: ${name}`);

    // Test with no middleware
    try {
      const noMiddlewareResponse = await request(noMiddlewareServer).post('/test').timeout(5000).send(data.body);
      console.log(`No middleware - Response size: ${JSON.stringify(noMiddlewareResponse.body).length} bytes`);

      // Count malicious fields in the no-middleware response
      // (keys that start with $ or contain .)
      const countMaliciousFields = (obj) => {
        let count = 0;
        const checkObj = (o) => {
          if (!o || typeof o !== 'object') return;

          Object.keys(o).forEach((key) => {
            if (key.startsWith('$') || key.includes('.')) {
              count++;
            }
            if (o[key] && typeof o[key] === 'object') {
              checkObj(o[key]);
            }
          });
        };

        checkObj(obj);
        return count;
      };

      const maliciousFieldCount = countMaliciousFields(noMiddlewareResponse.body);
      console.log(`No middleware - Potentially malicious fields: ${maliciousFieldCount}`);

      // Test with default middleware
      const response = await request(server).post('/test').timeout(5000).send(data.body);
      console.log(`Default middleware - Response size: ${JSON.stringify(response.body).length} bytes`);
      const sanitizedMaliciousFieldCount = countMaliciousFields(response.body);
      console.log(`Default middleware - Potentially malicious fields: ${sanitizedMaliciousFieldCount}`);

      // Test with removeEmpty option
      const responseWithRemoveEmpty = await request(serverWithRemoveEmpty).post('/test').timeout(5000).send(data.body);

      console.log(
        `RemoveEmpty middleware - Response size: ${JSON.stringify(responseWithRemoveEmpty.body).length} bytes`
      );

      // Check for empty fields in responses
      const hasEmptyFields = JSON.stringify(response.body).includes('"":{}}');
      console.log(`Default middleware - Contains empty fields: ${hasEmptyFields}`);

      const hasEmptyFieldsWithRemoveEmpty = JSON.stringify(responseWithRemoveEmpty.body).includes('"":{}}');
      console.log(`RemoveEmpty middleware - Contains empty fields: ${hasEmptyFieldsWithRemoveEmpty}`);

      // Small delay between tests
      await sleep(100);
    } catch (err) {
      console.error(`Error in response test for ${name}:`, err.message);
    }
  }

  // Always close servers
  noMiddlewareServer.close();
  server.close();
  serverWithRemoveEmpty.close();
  console.log('\nAll tests completed!');
}
