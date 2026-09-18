import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const release = JSON.parse(readFileSync("releases/latest.sxlist.json", "utf8"));

test("reviewed fictional release imports with a valid signature", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("签名已验证 · v1")).toBeVisible();
  await page
    .getByTestId("file-import")
    .setInputFiles("releases/latest.sxlist.json");
  await expect(
    page.getByText(`签名已验证 · v${release.body.sequence}`),
  ).toBeVisible();
  await expect(
    page.getByText("共建链路测试品牌（虚构）", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".brand-row")).toHaveCount(9);
  await page.reload();
  await expect(
    page.getByText(`签名已验证 · v${release.body.sequence}`),
  ).toBeVisible();
});

for (const mode of ["manual", "startup"] as const) {
  test(`live GitHub release updates through ${mode}`, async ({ page }) => {
    test.skip(
      process.env.LIVE_GITHUB !== "1",
      "Opt in to real network reads with LIVE_GITHUB=1",
    );
    await page.goto("/");
    await expect(page.getByText("签名已验证 · v1")).toBeVisible();
    await page
      .getByTestId("file-import")
      .setInputFiles("tests/fixtures/demo-v2.sxlist.json");
    await expect(page.getByText("签名已验证 · v2")).toBeVisible();
    if (mode === "manual") {
      await page.getByRole("button", { name: "检查更新", exact: true }).click();
    } else {
      await page.evaluate(() =>
        localStorage.setItem("rest-evidence:auto-update", "true"),
      );
      await page.reload();
      await expect(page.getByLabel("自动更新名单")).toBeChecked();
    }
    await expect(
      page.getByText(`签名已验证 · v${release.body.sequence}`),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      page.getByText("共建链路测试品牌（虚构）", { exact: true }),
    ).toBeVisible();
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("rest-evidence:v1")!),
    );
    expect(JSON.parse(stored.raw).signature).toBe(release.signature);
    expect(stored.history[0].source).toBe("GitHub 更新");
  });
}
