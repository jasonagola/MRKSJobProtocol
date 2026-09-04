import assert from "node:assert/strict";
import test from "node:test";
import {JobProtocolClient, JobProtocolError} from "../dist/index.js";

test("client sends the idempotency key", async () => {
  let observed;
  const client = new JobProtocolClient({
    baseUrl: "https://example.test",
    fetch: async (url, init) => {
      observed = {url, init};
      return new Response(JSON.stringify({job_id: "job", idempotent_replay: false}), {status: 202, headers: {"content-type": "application/json"}});
    },
  });
  await client.submit({type: "runtime.execution", priority: "normal", correlation: {}, input: {}}, "domain-job-1");
  assert.equal(observed.init.headers["idempotency-key"], "domain-job-1");
});

test("client exposes typed protocol errors", async () => {
  const client = new JobProtocolClient({
    baseUrl: "https://example.test",
    fetch: async () => new Response(JSON.stringify({error: {code: "idempotency_conflict", message: "changed", retryable: false}}), {status: 409}),
  });
  await assert.rejects(() => client.get("job"), (error) => error instanceof JobProtocolError && error.code === "idempotency_conflict");
});
