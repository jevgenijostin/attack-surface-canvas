import { it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  DEMO_SECRET,
  issueDemoLicense,
  verifyLicense,
  canAddNode,
  canSaveScenario,
  canLoadTemplate,
} from "../src/license.js";
it("accepts a valid independently signed HMAC key", async () => {
  const key =
    "asc-demo-pro-v1." +
    createHmac("sha256", DEMO_SECRET).update("asc-demo-pro-v1").digest("hex");
  expect(await verifyLicense(key)).toBe(true);
  expect(await issueDemoLicense()).toBe(key);
});
it.each([
  null,
  undefined,
  "",
  "abc",
  "asc-demo-pro-v1." + "0".repeat(64),
  "asc-demo-pro-v1." + "z".repeat(64),
  "asc-demo-pro-v2." + "0".repeat(64),
])("rejects malformed or invalid key %s", async (key) => {
  expect(await verifyLicense(key)).toBe(false);
});
it("enforces free caps before activation", async () => {
  const paid = await verifyLicense("invalid");
  expect(canAddNode(paid, 7)).toBe(true);
  expect(canAddNode(paid, 8)).toBe(false);
  expect(canSaveScenario(paid, 0)).toBe(true);
  expect(canSaveScenario(paid, 1)).toBe(false);
  expect(canSaveScenario(paid, 1, true)).toBe(true);
  expect(canLoadTemplate(paid)).toBe(false);
});
it("lifts caps and enables templates after valid activation", async () => {
  const paid = await verifyLicense(await issueDemoLicense());
  expect(canAddNode(paid, 10000)).toBe(true);
  expect(canSaveScenario(paid, 10000)).toBe(true);
  expect(canLoadTemplate(paid)).toBe(true);
});
