import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const baseline = readFileSync("public/demo.sxlist.json", "utf8");
const updated = readFileSync("tests/fixtures/demo-v2.sxlist.json", "utf8");
const fixture = (text: string) => ({
  name: "list.sxlist.json",
  mimeType: "application/json",
  buffer: Buffer.from(text),
});
async function openDirectory(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByText("签名已验证 · v1")).toBeVisible();
}
async function configureGithub(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "数据与更新", exact: true }).click();
  await page.getByLabel("GitHub 所有者").fill("example");
  await page.getByLabel("GitHub 数据仓库").fill("weekend-data");
  await page.getByRole("button", { name: "保存仓库", exact: true }).click();
}

test("directory search, filters, multiple factories, channel links and saved brands", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openDirectory(page);
  await expect(page.locator(".brand-row")).toHaveCount(8);
  await page.getByLabel("搜索品牌、企业或城市").fill("演示品牌 01");
  await expect(page.locator(".brand-row")).toHaveCount(1);
  await expect(page.getByText("地点 / 岗位有差异")).toBeVisible();
  await page
    .getByRole("button", { name: "收藏 演示品牌 01", exact: true })
    .click();
  await page.getByRole("button", { name: /演示品牌 01.*日用家居/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("协作二号工厂（演示）", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("劳务派遣", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "购买渠道" }).click();
  await expect(page.getByRole("link", { name: "前往京东" })).toHaveAttribute(
    "href",
    /^https:\/\/search\.jd\.com/,
  );
  await page.getByRole("tab", { name: "实体门店" }).click();
  await expect(page.getByText(/示例商业街/)).toBeVisible();
  await page.getByRole("button", { name: "关闭企业档案" }).click();
  await page
    .getByRole("button", { name: /我的收藏/, exact: false })
    .first()
    .click();
  await expect(page.locator(".brand-row")).toHaveCount(1);
  await page.reload();
  await expect(page.getByText("签名已验证 · v1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "取消收藏 演示品牌 01", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("valid file import, tampering rejection, rollback rejection and persistence", async ({
  page,
}) => {
  await openDirectory(page);
  await page.getByTestId("file-import").setInputFiles(fixture(updated));
  await expect(page.getByText("签名已验证 · v2")).toBeVisible();
  const tampered = JSON.parse(updated);
  tampered.body.brands[0].name = "被篡改的名称";
  await page
    .getByTestId("file-import")
    .setInputFiles(fixture(JSON.stringify(tampered)));
  await expect(page.getByRole("alert")).toContainText("签名验证失败");
  await expect(page.getByText("签名已验证 · v2")).toBeVisible();
  await expect(page.getByText("被篡改的名称")).toHaveCount(0);
  await page.getByTestId("file-import").setInputFiles(fixture(baseline));
  await expect(page.getByRole("alert")).toContainText("拒绝旧版本");
  await page.reload();
  await expect(page.getByText("签名已验证 · v2")).toBeVisible();
});

test("GitHub success and failure both preserve the trust boundary", async ({
  page,
}) => {
  await openDirectory(page);
  await configureGithub(page);
  await page.route(
    "https://raw.githubusercontent.com/example/weekend-data/main/releases/latest.sxlist.json",
    (route) =>
      route.fulfill({
        status: 200,
        body: updated,
        contentType: "application/json",
      }),
  );
  await page
    .getByRole("button", { name: "检查更新", exact: true })
    .last()
    .click();
  await expect(page.getByText("签名已验证 · v2")).toBeVisible();
  await page.unrouteAll();
  await page.route("https://raw.githubusercontent.com/**", (route) =>
    route.abort("failed"),
  );
  await page
    .getByRole("button", { name: "检查更新", exact: true })
    .last()
    .click();
  await expect(page.getByRole("alert")).toContainText("暂时无法连接 GitHub");
  await expect(page.getByText("签名已验证 · v2")).toBeVisible();
});

test("scoped feedback opens a prefilled issue and never posts automatically", async ({
  page,
  context,
}) => {
  await openDirectory(page);
  await configureGithub(page);
  await page.getByRole("button", { name: "参与共建", exact: true }).click();
  await page.getByLabel("品牌名称", { exact: true }).fill("示例品牌");
  await page.getByLabel("经营主体", { exact: true }).fill("示例经营主体");
  await page.getByLabel("地点类型", { exact: true }).selectOption("factory");
  await page.getByLabel("城市", { exact: true }).fill("杭州市");
  await page
    .getByLabel("具体办公室 / 厂区 / 门店", { exact: true })
    .fill("一号工厂");
  await page.getByLabel("部门或岗位", { exact: true }).fill("操作工");
  await page.getByLabel("作息安排", { exact: true }).selectOption("single");
  await page.getByLabel("观察开始日期").fill("2026-01-01");
  await page.getByLabel("观察结束日期").fill("2026-02-01");
  await page
    .getByLabel("公开来源链接")
    .fill("https://example.org/public-source");
  await page.getByRole("checkbox").check();
  let opened = "";
  let method = "";
  await context.route("https://github.com/**", (route) => {
    opened = route.request().url();
    method = route.request().method();
    return route.fulfill({
      status: 200,
      body: "<h1>GitHub issue form (test)</h1>",
      contentType: "text/html",
    });
  });
  const popup = context.waitForEvent("page");
  await page.getByRole("button", { name: "前往 GitHub 确认发布" }).click();
  const next = await popup;
  await next.waitForLoadState();
  expect(method).toBe("GET");
  const body = new URL(opened).searchParams.get("body")!;
  expect(body).toContain("地点类型：工厂");
  expect(body).toContain("每周休一日");
  expect(body).toContain("操作工");
  await next.close();
});

test("clear keeps high water and export retains the original signature", async ({
  page,
}) => {
  await openDirectory(page);
  await page.getByTestId("file-import").setInputFiles(fixture(updated));
  await page.getByRole("button", { name: "数据与更新", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出原签名文件" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(JSON.parse(readFileSync(path!, "utf8")).signature).toBe(
    JSON.parse(updated).signature,
  );
  await page.getByRole("button", { name: "清除当前名单" }).click();
  await page.reload();
  await expect(page.getByText("暂无企业资料", { exact: true })).toBeVisible();
  await page.getByTestId("file-import").setInputFiles(fixture(baseline));
  await expect(page.getByRole("alert")).toContainText("拒绝旧版本");
});

test("responsive views have no horizontal overflow or broken images", async ({
  page,
}) => {
  await openDirectory(page);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".brand-image img")
        .evaluateAll((images) =>
          images.every(
            (img) =>
              (img as HTMLImageElement).complete &&
              (img as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    ).toBe(true);
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: `test-results/directory-${width}.png`,
        fullPage: true,
      });
  }
  await page.getByRole("button", { name: "打开导航" }).click();
  await page.getByRole("button", { name: "数据与更新", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/data-mobile.png",
    fullPage: true,
  });
});
