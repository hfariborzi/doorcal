import { test } from "node:test";
import assert from "node:assert/strict";
import { routingFor } from "./client.ts";

test("OpenRouter requests are pinned to no-data-collection providers and the model's own vendor", () => {
  delete process.env.AI_ROUTE_PROVIDERS;
  assert.deepEqual(routingFor("https://openrouter.ai/api/v1", "openai/gpt-6-luna-pro"), {
    provider: { data_collection: "deny", only: ["openai", "azure"] },
  });
});

test("AI_ROUTE_PROVIDERS overrides the vendor list", () => {
  process.env.AI_ROUTE_PROVIDERS = "openai, azure";
  assert.deepEqual(routingFor("https://openrouter.ai/api/v1", "openai/gpt-6-luna-pro").provider, { data_collection: "deny", only: ["openai", "azure"] });
  delete process.env.AI_ROUTE_PROVIDERS;
});

test("other endpoints get no extra fields (they reject unknown ones)", () => {
  assert.deepEqual(routingFor("https://api.openai.com/v1", "gpt-5-nano"), {});
  assert.deepEqual(routingFor("not a url", "x"), {});
});
