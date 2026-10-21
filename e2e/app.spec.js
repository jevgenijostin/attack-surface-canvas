import { test, expect } from "@playwright/test";
import { issueDemoLicense } from "../src/license.js";
async function add(page, type = "Server", x = 200, y = 180) {
  await page
    .getByRole("button", { name: new RegExp(type + "$") })
    .first()
    .click();
  const box = await page.locator("#canvas").boundingBox();
  await page.mouse.click(
    box.x + (x / 1000) * box.width,
    box.y + (y / 650) * box.height,
  );
  await page.keyboard.press("Escape");
}
async function activate(page) {
  await page.getByText("Demo license settings").click();
  await page
    .getByLabel("License key", { exact: true })
    .fill(await issueDemoLicense());
  await page.getByRole("button", { name: "Activate demo license" }).click();
  await expect(page.locator("#tier")).toHaveText("Demo Pro");
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("add two assets, drag connection, compromise and highlight downstream", async ({
  page,
}) => {
  await add(page);
  await add(page, "Firewall", 600, 300);
  const nodes = page.locator(".node");
  await nodes.first().locator(".port").dragTo(nodes.nth(1).locator(".card"));
  await expect(page.locator("#counts")).toHaveText("2 assets · 1 trust links");
  await nodes.first().click();
  await page.getByRole("button", { name: "Compromise", exact: true }).click();
  await expect(nodes.nth(1)).toHaveAttribute("data-depth", "1");
  await expect(nodes.first()).toHaveAttribute("data-depth", "0");
  await expect(page.locator(".total")).toHaveText("2");
});
test("blocks the ninth free asset with a clear cap message", async ({
  page,
}) => {
  for (let i = 0; i < 8; i++)
    await add(
      page,
      "Server",
      120 + (i % 4) * 220,
      100 + Math.floor(i / 4) * 300,
    );
  await page
    .getByRole("button", { name: /Server$/ })
    .first()
    .click();
  const box = await page.locator("#canvas").boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.85);
  await expect(page.locator(".node")).toHaveCount(8);
  await expect(page.getByRole("status")).toContainText(
    "Free tier allows 8 nodes",
  );
});
test("save, reload and load a persistent scenario", async ({ page }) => {
  await add(page);
  await page.getByLabel("Scenario name").fill("Perimeter");
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Load Perimeter", exact: true })
    .click();
  await expect(page.locator(".node")).toHaveCount(1);
  await expect(page.locator("#title")).toHaveText("Perimeter");
});
test("valid demo license unlocks template and survives reload", async ({
  page,
}) => {
  const template = page.getByRole("button", {
    name: "Ransomware via VPN gateway",
    exact: true,
  });
  await expect(template).toBeDisabled();
  await activate(page);
  await expect(template).toBeEnabled();
  await template.click();
  await expect(page.locator(".node")).toHaveCount(4);
  await page.reload();
  await expect(page.locator("#tier")).toHaveText("Demo Pro");
  await expect(template).toBeEnabled();
});
test("deletes a saved scenario persistently", async ({ page }) => {
  await page.getByLabel("Scenario name").fill("Disposable");
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Load Disposable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Load Disposable" }),
  ).toHaveCount(0);
});
test("paid tier allows more than eight nodes and multiple scenarios", async ({
  page,
}) => {
  await activate(page);
  for (let i = 0; i < 9; i++)
    await add(
      page,
      "Server",
      120 + (i % 3) * 300,
      100 + Math.floor(i / 3) * 200,
    );
  await expect(page.locator(".node")).toHaveCount(9);
  await page.getByLabel("Scenario name").fill("One");
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await page.getByLabel("Scenario name").fill("Two");
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await expect(page.locator("#saved .saved-row")).toHaveCount(2);
});
test("move, rename and remove an asset and its relationships", async ({
  page,
}) => {
  await add(page);
  await add(page, "Firewall", 600, 300);
  await page.locator(".node").first().click();
  await page.getByRole("button", { name: "Connect selected → target" }).click();
  const before = await page.locator(".node").first().getAttribute("transform");
  const card = await page.locator(".node").first().boundingBox();
  await page.mouse.move(card.x + 40, card.y + 25);
  await page.mouse.down();
  await page.mouse.move(card.x + 80, card.y + 75, { steps: 5 });
  await page.mouse.up();
  expect(
    await page.locator(".node").first().getAttribute("transform"),
  ).not.toBe(before);
  await page.locator(".node").first().click();
  await page.getByLabel("Asset label").fill("Renamed server");
  await page.getByLabel("Asset label").press("Tab");
  await expect(page.locator(".node").first()).toHaveAttribute(
    "aria-label",
    "Renamed server, Server",
  );
  await page.getByRole("button", { name: "Remove asset", exact: true }).click();
  await expect(page.locator(".node")).toHaveCount(1);
  await expect(page.locator("#counts")).toHaveText("1 assets · 0 trust links");
});
test("free scenario cap and invalid license show actionable messages", async ({
  page,
}) => {
  await page.getByLabel("Scenario name").fill("One");
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await page.getByLabel("Scenario name").fill("Two");
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("1 saved scenario");
  await page.getByText("Demo license settings").click();
  await page.getByLabel("License key", { exact: true }).fill("fake");
  await page.getByRole("button", { name: "Activate demo license" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Invalid demo license key.",
  );
});
