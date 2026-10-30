"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

for (const route of ["analyze", "agent-analyze", "model-analysis"]) {
  test(`${route}: retired API stays disabled without reading input or calling a provider`, async () => {
    const originalFetch = globalThis.fetch;
    let networkCalls = 0;
    globalThis.fetch = () => { networkCalls++; throw Error("Unexpected provider call"); };
    try {
      const {default: api} = await import(`../api/${route}.js`);
      const status = await api.fetch(new Request(`https://example.test/api/${route}`));
      assert.equal(status.status, 200);
      const body = await status.json();
      assert.equal(body.enabled, false);
      assert.equal(body.reason, "AI_FEATURE_REMOVED");
      const request = {method: "POST", get body() {throw Error("Retired API read input");}, json() {throw Error("Retired API parsed input");}, text() {throw Error("Retired API parsed input");}};
      const response = await api.fetch(request);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal((await response.json()).error, route === "agent-analyze" ? "AGENT_DISABLED" : "SERVICE_DISABLED");
      assert.equal((await api.fetch({method: "DELETE"})).status, 405);
      assert.equal(networkCalls, 0);
    } finally { globalThis.fetch = originalFetch; }
  });
}
