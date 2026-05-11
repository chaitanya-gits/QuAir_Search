import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createLocalDevServer } from "../scripts/local_dev_server.mjs";

let server;
let baseUrl;

before(async () => {
  server = createLocalDevServer();
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

test("serves the frontend without Docker", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<title>\[QuAir Search\]<\/title>/);
});

test("serves mock health and search APIs without Docker", async () => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  const health = await healthResponse.json();

  assert.equal(healthResponse.status, 200);
  assert.equal(health.status, "ok");
  assert.equal(health.services.docker, false);

  const searchResponse = await fetch(`${baseUrl}/api/search?q=quantum`);
  const search = await searchResponse.json();

  assert.equal(searchResponse.status, 200);
  assert.deepEqual(search.search_queries, ["quantum"]);
  assert.equal(search.index_status.mode, "local-test");
  assert.equal(search.quantum.algorithm, "grover");
  assert.equal(search.analytics.semantic_hits, 1);
  assert.equal(search.sources[0].sources[0], "semantic");
});
