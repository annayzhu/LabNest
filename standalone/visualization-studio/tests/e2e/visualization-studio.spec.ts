import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function expectStablePreviewScreenshot(page: Page, locator: Locator, name: string, options: { maxDiffPixels?: number } = {}) {
  await page.addStyleTag({ content: "[data-visualization-sticky-header]{position:static!important}" });
  await locator.scrollIntoViewIfNeeded();
  // Linux Chromium rasterizes the same portable font stack with slightly different
  // antialiasing from macOS. Keep macOS baselines exact while allowing only the
  // observed sub-1.5% edge-pixel variance in GitHub Actions.
  const maxDiffPixels = process.platform === "linux" ? Math.max(1200, options.maxDiffPixels ?? 0) : options.maxDiffPixels;
  await expect(locator).toHaveScreenshot(name, { animations: "disabled", ...options, ...(maxDiffPixels ? { maxDiffPixels } : {}) });
}

test.describe("Visualization Studio browser acceptance", () => {
  test("calculates auditable Bar statistics for raw, summary, paired, and qPCR examples", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop Bar-statistics acceptance");
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Example 2" }).click();
    await expect(page.getByRole("combobox", { name: "Analysis source / design" })).toHaveValue("raw-independent");
    await expect(page.getByRole("combobox", { name: "Reference category" })).toHaveValue("Control");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(page.getByText("Statistical results · 2 comparisons")).toBeVisible();
    await expect(page.locator("svg[aria-label='Bar scientific figure preview'] text[data-plot-label]").filter({ hasText: /\*/ })).toHaveCount(2);
    await page.getByText("Statistical results · 2 comparisons").click();
    await expect(page.getByText("Welch two-sample t-test", { exact: false }).first()).toBeVisible();
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "TSV" }).click();
    const download = await downloadEvent;
    const results = await readFile((await download.path())!, "utf8");
    expect(results).toContain("difference\tci95_lower\tci95_upper\tt\tdf\tp_raw\tp_adjusted");
    expect(results).toContain("Welch two-sample t-test");
    await page.getByRole("button", { name: "Example 3" }).click();
    await expect(page.getByRole("combobox", { name: "Analysis source / design" })).toHaveValue("summary-independent");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Biological sample size (n)" }).selectOption("");
    await expect(page.getByText(/explicit sample-size \(n\)/)).toBeVisible();
    await page.getByRole("button", { name: "Example 4" }).click();
    await expect(page.getByRole("combobox", { name: "Analysis source / design" })).toHaveValue("raw-paired");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Example 5" }).click();
    await expect(page.getByRole("combobox", { name: "Analysis source / design" })).toHaveValue("qpcr-delta-ct");
    await expect(page.getByRole("combobox", { name: "Analysis value (ΔCt)" })).toHaveValue("delta_ct");
    await expect(page.getByRole("combobox", { name: "Value *" })).toHaveValue("relative_expression");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await page.getByText("Statistical results · 2 comparisons").click();
    await expect(page.getByText(/Welch two-sample t-test · ΔCt/).first()).toBeVisible();
  });

  test("keeps rotated bar categories clear of the X-axis title", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop bar-axis geometry regression");
    await page.goto("/", { waitUntil: "networkidle" });

    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(`category\tvalue\tsd\tgroup
Mock\t1.32\t0.76\tMock
NC\t1.00\t0.42\tNC
siFBN2-1224\t0.04\t0.03\tFBN2
siFBN2-7173\t0.05\t0.03\tFBN2
siFBN2-9706\t0.07\t0.04\tFBN2`);
    await page.getByRole("button", { name: "Auto-map" }).click();
    await page.getByRole("textbox", { name: "X-axis label" }).fill("H596");
    const width = page.getByRole("textbox", { name: "Width value", exact: true });
    const height = page.getByRole("textbox", { name: "Height value", exact: true });
    await width.fill("480");
    await width.press("Enter");
    await height.fill("340");
    await height.press("Enter");

    const svg = page.locator("svg[aria-label='Bar scientific figure preview']");
    await expect(svg).toHaveAttribute("width", "480");
    await expect(svg.locator("[data-plot-element='bar-category-label']")).toHaveCount(5);
    await expect(svg.locator("[data-axis-label='x']")).toHaveText("H596");
    const geometry = await svg.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      const title = element.querySelector<SVGTextElement>("[data-axis-label='x']")!.getBoundingClientRect();
      const labels = [...element.querySelectorAll<SVGTextElement>("[data-plot-element='bar-category-label']")].map((label) => label.getBoundingClientRect());
      return {
        minimumGap: Math.min(...labels.map((label) => title.top - label.bottom)),
        escaped: [...labels, title].filter((box) => box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1).length,
      };
    });
    expect(geometry.minimumGap).toBeGreaterThanOrEqual(3.5);
    expect(geometry.escaped).toBe(0);

    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG" }).click();
    const download = await downloadEvent;
    const source = await readFile((await download.path())!, "utf8");
    expect(source).toContain('data-plot-element="bar-category-label"');
    expect(source).toContain('data-axis-label="x"');
    expect(source).toContain("H596");
  });

  test("uses actual time points and calculates adjusted line significance", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop line-statistics regression");
    await page.goto("/");
    await page.getByRole("button", { name: /^Line/ }).click();
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(`time\tvalue\tsd\tsem\tn\tseries
0\t0.2292416667\t0.0456901316\t0.0263792098\t3\tMock
1\t0.2277416667\t0.0061745614\t0.0035648847\t3\tMock
2\t0.6077083333\t0.0611888828\t0.0353274179\t3\tMock
3\t0.9141\t0.1925812994\t0.1111868650\t3\tMock
0\t0.2025666667\t0.0125768637\t0.0072612556\t3\tNC
1\t0.2676833333\t0.0132398074\t0.0076440064\t3\tNC
2\t0.6331333333\t0.0476931795\t0.0275356700\t3\tNC
3\t1.0819666667\t0.0700105810\t0.0404206278\t3\tNC
0\t0.196475\t0.0145138368\t0.0083795676\t3\tsiFBN2-1224
1\t0.217675\t0.0182540464\t0.0105389786\t3\tsiFBN2-1224
2\t0.43765\t0.0376459687\t0.0217349102\t3\tsiFBN2-1224
3\t0.6097083333\t0.0203331984\t0.0117393776\t3\tsiFBN2-1224
0\t0.1690416667\t0.0026113933\t0.0015076886\t3\tsiFBN2-9706
1\t0.2015083333\t0.0251189296\t0.0145024208\t3\tsiFBN2-9706
2\t0.420225\t0.0086766329\t0.0050094563\t3\tsiFBN2-9706
3\t0.7469583333\t0.0106625024\t0.0061559987\t3\tsiFBN2-9706`);
    await page.getByRole("button", { name: "Auto-map" }).click();
    await page.getByRole("combobox", { name: "Error representation" }).selectOption("sd");

    const svg = page.locator("svg[aria-label='Line scientific figure preview']");
    await expect(svg.locator("[data-axis-tick='x']")).toHaveText(["0", "1", "2", "3"]);
    await expect(svg.locator("[data-axis-label='x']")).toHaveCount(0);
    await expect(svg.locator("[data-axis-label='y']")).toHaveCount(0);

    await page.getByRole("checkbox", { name: "Calculate significance" }).check({ force: true });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Reference series" }).selectOption("Mock");
    const annotations = svg.locator("[data-plot-element='line-significance']");
    await expect(annotations).toHaveCount(12);
    const adjusted = await annotations.evaluateAll((elements) => elements.map((element) => Number(element.getAttribute("data-adjusted-p"))));
    expect(adjusted.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
  });

  test("selects, resets, remaps, adjusts, and exports a representative plot", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop interaction baseline");
    await page.goto("/");

    await page.getByRole("button", { name: /^Raincloud/ }).click();
    await expect(page.getByRole("heading", { name: "Raincloud preview" })).toBeVisible();
    const dataInput = page.getByRole("textbox", { name: "CSV or TSV data" });
    await dataInput.fill("broken\nrow");
    await expect(page.getByText("Check data", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Example 1" }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Value *" }).selectOption("group");
    await expect(page.getByText("Check data", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Auto-map" }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();

    const width = page.getByRole("textbox", { name: "Width value", exact: true });
    await width.fill("380");
    await width.press("Enter");
    await expect(page.locator("svg[aria-label='Raincloud scientific figure preview']")).toHaveAttribute("width", "380");

    const svgDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG" }).click();
    const downloadedSvg = await svgDownload;
    expect(downloadedSvg.suggestedFilename()).toMatch(/raincloud.*\.svg$/i);
    const svgPath = await downloadedSvg.path();
    expect(svgPath).not.toBeNull();
    const svgSource = await readFile(svgPath!, "utf8");
    expect(svgSource).toContain('width="380"');
    expect(svgSource).toContain('height="340"');
    expect(svgSource).toContain('font-family="Arial');
    expect(svgSource).toContain('fill="#FFFFFF"');
    expect(svgSource).toContain("Raincloud figure");
    expect(svgSource).toContain("Treatment A");
    expect(svgSource).toMatch(/#[0-9A-F]{6}/i);

    const pngDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "PNG" }).click();
    const downloadedPng = await pngDownload;
    expect(downloadedPng.suggestedFilename()).toMatch(/raincloud.*600dpi\.png$/i);
    const pngPath = await downloadedPng.path();
    expect(pngPath).not.toBeNull();
    const pngBytes = await readFile(pngPath!);
    expect(pngBytes.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(pngBytes.readUInt32BE(16)).toBe(Math.round(380 * 600 / 96));
    expect(pngBytes.readUInt32BE(20)).toBe(Math.round(340 * 600 / 96));
    const pngDataUrl = `data:image/png;base64,${pngBytes.toString("base64")}`;
    const rasterEvidence = await page.evaluate(async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set<string>();
      let nonWhite = 0;
      for (let index = 0; index < pixels.length; index += 1600) {
        const color = `${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`;
        colors.add(color);
        if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) nonWhite += 1;
      }
      return { uniqueColors: colors.size, nonWhite };
    }, pngDataUrl);
    expect(rasterEvidence.uniqueColors).toBeGreaterThan(10);
    expect(rasterEvidence.nonWhite).toBeGreaterThan(50);

    const previewCard = page.getByRole("heading", { name: "Raincloud preview" }).locator("xpath=ancestor::section");
    await expectStablePreviewScreenshot(page, previewCard, "raincloud-dense-desktop.png");

    const yMaximum = page.getByRole("textbox", { name: "Y maximum", exact: true });
    await yMaximum.fill("5");
    await yMaximum.press("Enter");
    await expect(page.getByText(/Manual axis limits clip \d+ mapped values/)).toBeVisible();
    const yMinimum = page.getByRole("textbox", { name: "Y minimum", exact: true });
    await yMinimum.fill("6");
    await yMinimum.press("Enter");
    await expect(yMinimum).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Y minimum must be smaller than Y maximum.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "PNG" })).toBeDisabled();
    await yMinimum.fill("");
    await yMinimum.press("Enter");
    await yMaximum.fill("");
    await yMaximum.press("Enter");

    await page.getByRole("button", { name: /^Scatter/ }).click();
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(`x\ty\tgroup\tlabel
1\t2\tBaseline reference cohort\tS1
2\t3\tEarly treatment responder\tS2
3\t2.5\tLate treatment responder\tS3
4\t4\tImmune enriched subgroup\tS4
5\t3.8\tStromal enriched subgroup\tS5
6\t5\tMolecular high-risk subgroup\tS6
7\t4.6\tMolecular low-risk subgroup\tS7
8\t5.5\tIndependent validation cohort\tS8`);
    await page.getByRole("button", { name: "Auto-map" }).click();
    const legendSvg = page.locator("svg[aria-label='Scatter scientific figure preview']");
    const clippedLegendText = await legendSvg.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("text")].filter((label) => { const box = label.getBoundingClientRect(); return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1; }).map((label) => label.textContent);
    });
    expect(clippedLegendText).toEqual([]);

    await page.getByRole("textbox", { name: "X minimum", exact: true }).fill("10");
    await page.getByRole("textbox", { name: "X minimum", exact: true }).press("Enter");
    await page.getByRole("textbox", { name: "X maximum", exact: true }).fill("1");
    await page.getByRole("textbox", { name: "X maximum", exact: true }).press("Enter");
    await expect(page.getByText("X minimum must be smaller than X maximum.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Box/ }).click();
    await expect(page.getByRole("textbox", { name: "X minimum", exact: true })).toHaveCount(0);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeEnabled();
  });

  test("keeps mobile plot and palette selectors compact", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Mobile layout baseline");
    await page.goto("/");

    const plotSelect = page.getByRole("combobox", { name: "Plot type" });
    await plotSelect.selectOption("correlation-heatmap");
    await expect(page.getByRole("heading", { name: "Correlation heatmap preview" })).toBeVisible();

    const paletteToggle = page.getByRole("button", { name: "柴染棕" }).first();
    await expect(paletteToggle).toHaveAttribute("aria-expanded", "false");
    await paletteToggle.click();
    await expect(paletteToggle).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "极简", exact: true }).click();
    await page.getByRole("button", { name: "松柏", exact: true }).click();
    const minimalPaletteToggle = page.getByRole("button", { name: "松柏", exact: true }).first();
    await minimalPaletteToggle.click();
    await expect(minimalPaletteToggle).toHaveAttribute("aria-expanded", "false");

    const heatmapSvg = page.locator("svg[aria-label='Correlation heatmap scientific figure preview']");
    await expect(heatmapSvg).toHaveAttribute("data-plot-renderer", "advanced");
    await expect(page.locator("[data-analysis-provenance]")).toHaveAttribute("data-analysis-provenance", "calculated-in-studio");
    await expect(page.getByText("Calculated in Studio", { exact: true })).toBeVisible();
    const escapedLabels = await heatmapSvg.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("text")].flatMap((label) => {
        const box = label.getBoundingClientRect();
        return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [label.textContent] : [];
      });
    });
    expect(escapedLabels).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
  });

  test("applies a restrained minimal palette to categorical marks", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop palette rendering");
    await page.goto("/");
    await page.getByRole("button", { name: "极简", exact: true }).click();
    await page.getByRole("button", { name: "墨蓝", exact: true }).click();
    const bars = page.locator("svg[aria-label='Bar scientific figure preview'] [data-plot-element='bar']");
    await expect(bars).toHaveCount(8);
    expect(await bars.evaluateAll((marks) => marks.slice(0, 4).map((mark) => mark.getAttribute("fill")))).toEqual(["#2878B5", "#5595C3", "#82B0D2", "#B7D5E8"]);
  });

  test("renders source-faithful traditional and journal colors", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop palette rendering");
    await page.goto("/");
    const bars = page.locator("svg[aria-label='Bar scientific figure preview'] [data-plot-element='bar']");
    expect(await bars.evaluateAll((marks) => marks.slice(0, 4).map((mark) => mark.getAttribute("fill")))).toEqual(["#957454", "#1D4C50", "#D4A278", "#3F605B"]);

    await page.getByRole("button", { name: "期刊配色", exact: true }).click();
    await page.getByRole("button", { name: "Nature", exact: true }).click();
    expect(await bars.evaluateAll((marks) => marks.slice(0, 4).map((mark) => mark.getAttribute("fill")))).toEqual(["#8FCFC9", "#FFBE7A", "#FA7F6F", "#82B0D2"]);
  });

  test("keeps the desktop workbench aligned and brings a distant selection fully into view", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop navigation and panel geometry");
    await page.goto("/");

    const panelTops = await page.locator("[data-visualization-panel]").evaluateAll((panels) => Object.fromEntries(
      panels.map((panel) => [panel.getAttribute("data-visualization-panel"), panel.getBoundingClientRect().top]),
    ));
    expect(Math.abs(panelTops.plots - panelTops.preview)).toBeLessThanOrEqual(1);
    expect(Math.abs(panelTops.parameters - panelTops.preview)).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: /^Word cloud/ }).click();
    const previewHeading = page.getByRole("heading", { name: "Word cloud preview" });
    await expect(previewHeading).toBeVisible();
    const preview = page.locator('[data-visualization-panel="preview"]');
    const stickyHeader = page.locator("[data-visualization-sticky-header]");
    await expect.poll(async () => {
      const [previewBox, headerBox] = await Promise.all([preview.boundingBox(), stickyHeader.boundingBox()]);
      if (!previewBox || !headerBox) return false;
      const visibleTop = Math.max(previewBox.y, headerBox.y + headerBox.height);
      return previewBox.y >= headerBox.y + headerBox.height - 2
        && visibleTop + Math.min(180, previewBox.height) <= (page.viewportSize()?.height ?? 0);
    }).toBe(true);

    const widthInput = page.getByRole("textbox", { name: "Width value", exact: true });
    await widthInput.fill("360");
    await widthInput.press("Enter");
    await expect(page.locator("svg[aria-label='Word cloud scientific figure preview']")).toHaveAttribute("width", "360");
    await expect(page.getByRole("button", { name: /apply/i })).toHaveCount(0);

    const guidance = page.locator('[data-plot-guidance="word-cloud"]');
    await expect(guidance).toContainText("基本定义");
    await expect(guidance).toContainText("适合的数据");
    await expect(guidance).toContainText("适合说明的问题");
    await guidance.locator("[data-plot-references='word-cloud'] summary").click();
    await expect(guidance.locator("[data-plot-references='word-cloud'] a")).not.toHaveCount(0);
  });

  test("exposes every module through the compact mobile selector", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Mobile registry completeness");
    await page.goto("/");
    const plotSelect = page.getByRole("combobox", { name: "Plot type" });
    await expect(plotSelect.locator("option")).toHaveCount(82);
    await expect(plotSelect).toHaveValue("bar");
    await expect(page.getByRole("button", { name: "柴染棕" }).first()).toHaveAttribute("aria-expanded", "false");
  });

  test("configures reproducible heatmap structure without clipping the compact export", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop heatmap controls");
    await page.goto("/");
    await page.getByRole("button", { name: /^Clustered heatmap/ }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const svg = page.locator("svg[aria-label='Clustered heatmap scientific figure preview']");
    await expect(svg).toHaveAttribute("data-plot-renderer", "advanced");
    await expect(svg.locator("[data-plot-element='dendrogram']")).not.toHaveCount(0);
    await expect(svg.locator("[data-cluster-cut='row']")).not.toHaveCount(0);

    await page.getByRole("textbox", { name: "Column annotations (TSV)" }).fill("id\tgroup\nControl_1\tControl\nTreatment_1\tTreatment\nExtra\tUnknown");
    await expect(page.getByText(/column IDs are missing from the annotation table/)).toBeVisible();
    await expect(page.getByText(/annotation ID does not match the matrix/)).toBeVisible();
    await expect(svg.locator("[data-annotation-target='column']")).toHaveCount(12);

    await page.getByRole("textbox", { name: "Width value", exact: true }).fill("520");
    await page.getByRole("textbox", { name: "Height value", exact: true }).fill("420");
    await page.getByRole("combobox", { name: "Layout" }).selectOption("circular");
    await expect(svg.locator("[data-plot-family='circular-heatmap']")).toBeVisible();
    const escapedCircularText = await svg.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("[data-plot-family='circular-heatmap'] text")].flatMap((label) => {
        const box = label.getBoundingClientRect();
        return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [label.textContent] : [];
      });
    });
    expect(escapedCircularText).toEqual([]);

    const manyRows = ["gene\tA\tB\tC", ...Array.from({ length: 20 }, (_, index) => `G${index}\t${index + 1}\t${index + 2}\t${index + 3}`)].join("\n");
    await page.getByRole("textbox", { name: "Column annotations (TSV)" }).fill("");
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(manyRows);
    await page.getByRole("textbox", { name: "Width value", exact: true }).fill("340");
    await page.getByRole("textbox", { name: "Height value", exact: true }).fill("340");
    await page.getByRole("textbox", { name: "Legend size value", exact: true }).fill("16");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const escapedLargeLegendText = await svg.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("[data-plot-family='circular-heatmap'] text")].flatMap((label) => {
        const box = label.getBoundingClientRect();
        return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [label.textContent] : [];
      });
    });
    expect(escapedLargeLegendText).toEqual([]);

    await page.getByRole("textbox", { name: "Width value", exact: true }).fill("520");
    await page.getByRole("textbox", { name: "Height value", exact: true }).fill("420");
    await page.getByRole("combobox", { name: "Layout" }).selectOption("rectangular");
    await page.getByText("Coordinated raw-value row summary", { exact: true }).click();
    await expect(svg.locator("[data-plot-element='heatmap-side-plot']")).toBeVisible();

    const escapedGeometry = await svg.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("[data-plot-element='heatmap-cell'], [data-plot-element='dendrogram'], [data-annotation-target]")].flatMap((mark) => {
        const box = mark.getBoundingClientRect();
        return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [mark.getAttribute("data-plot-element") ?? mark.getAttribute("data-annotation-target")] : [];
      });
    });
    expect(escapedGeometry).toEqual([]);
  });

  test("searches the plot catalog and recommends plots by scientific question", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop plot discovery controls");
    await page.goto("/");
    const plotPanel = page.locator("[data-visualization-panel='plots']");
    const search = plotPanel.getByRole("searchbox", { name: "Search plot types" });
    await search.fill("volcano");
    await expect(plotPanel.getByRole("button", { name: /^Volcano/ })).toBeVisible();
    await expect(plotPanel.getByRole("button", { name: /^Kaplan/ })).toHaveCount(0);
    await plotPanel.getByRole("button", { name: /^Volcano/ }).click();
    await expect(page.getByRole("heading", { name: "Volcano preview" })).toBeVisible();

    await search.clear();
    await plotPanel.getByRole("button", { name: "Choose" }).click();
    await plotPanel.getByRole("combobox", { name: "What do you want to show?" }).selectOption("ordination");
    await expect(plotPanel.getByText("Display reduced coordinates or sample-level dissimilarity.", { exact: true })).toBeVisible();
    await plotPanel.getByRole("button", { name: "PCoA", exact: true }).click();
    await expect(page.getByRole("heading", { name: "PCoA preview" })).toBeVisible();

    await search.fill("微生物");
    await expect(plotPanel.getByRole("button", { name: "PCoA Dimension reduction", exact: true })).toBeVisible();
  });

  test("distinguishes supplied PCA coordinates from a reproducible in-browser matrix calculation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop ordination controls");
    await page.goto("/");
    await page.getByRole("button", { name: /^PCA/ }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Supplied coordinates" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("textbox", { name: "PCA coordinates" })).toHaveValue(/sample\tPC1\tPC2\tPC3/);
    await expect(page.getByRole("textbox", { name: "PCA observation metadata" })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Feature loading arrows" })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "View" }).locator("option[value='scree']")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Shape" })).toHaveValue("batch");
    const pcaSvg = page.locator("svg[aria-label='PCA scientific figure preview']");
    await expect(pcaSvg.locator("[data-plot-family='ordination-scores'] [data-plot-element='ordination-point']")).toHaveCount(12);

    await page.getByRole("button", { name: "Example 2" }).click();
    await expect(page.getByText("Calculated in Studio", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "PCA observation metadata" })).toHaveValue(/Control_1\tControl\tBatch 1\tC1/);
    await expect(page.getByRole("combobox", { name: "Shape" })).toHaveValue("batch");
    await expect(pcaSvg).toHaveAttribute("data-plot-renderer", "advanced");
    await expect(pcaSvg.locator("[data-plot-element='ordination-shape-legend']")).toBeVisible();
    await page.getByRole("checkbox", { name: "Group covariance ellipses" }).check({ force: true });
    await page.getByRole("checkbox", { name: "Group centroids" }).check({ force: true });
    await page.getByRole("checkbox", { name: "Feature loading arrows" }).check({ force: true });
    await page.getByRole("checkbox", { name: "Point labels" }).check({ force: true });
    await expect(pcaSvg.locator("[data-plot-element='ordination-ellipse']")).toHaveCount(2);
    await expect(pcaSvg.locator("[data-plot-element='ordination-centroid']")).toHaveCount(2);
    await expect(pcaSvg.locator("[data-plot-element='ordination-loading']").first()).toBeVisible();
    await expect(pcaSvg).toContainText(/PC1 \([\d.]+%\)/);
    const clippedPcaLabels = await pcaSvg.evaluate((element) => {
      const svg = element as SVGSVGElement;
      const canvas = svg.getBoundingClientRect();
      const clip = svg.querySelector("clipPath rect")!;
      const scaleX = canvas.width / svg.viewBox.baseVal.width;
      const scaleY = canvas.height / svg.viewBox.baseVal.height;
      const plot = { left: canvas.left + Number(clip.getAttribute("x")) * scaleX, top: canvas.top + Number(clip.getAttribute("y")) * scaleY, right: canvas.left + (Number(clip.getAttribute("x")) + Number(clip.getAttribute("width"))) * scaleX, bottom: canvas.top + (Number(clip.getAttribute("y")) + Number(clip.getAttribute("height"))) * scaleY };
      return [...element.querySelectorAll("[data-plot-label]")].flatMap((label) => {
        const box = label.getBoundingClientRect();
        return box.left < plot.left - 1 || box.top < plot.top - 1 || box.right > plot.right + 1 || box.bottom > plot.bottom + 1 ? [label.textContent] : [];
      });
    });
    expect(clippedPcaLabels).toEqual([]);
    await page.getByRole("textbox", { name: "Method note", exact: true }).fill("Euclidean distance; group tested with cohort strata and restricted permutations");
    for (const [label, value] of [["R²", "0.21"], ["P value", "0.012"], ["Permutations", "999"]] as const) {
      await page.getByRole("textbox", { name: label, exact: true }).fill(value);
      await page.getByRole("textbox", { name: label, exact: true }).press("Enter");
    }
    await expect(pcaSvg).toContainText("PERMANOVA (supplied)");
    await page.getByRole("textbox", { name: "Y minimum", exact: true }).fill("-0.001");
    await page.getByRole("textbox", { name: "Y minimum", exact: true }).press("Enter");
    await expect(page.getByText(/loading arrows require manual domains/)).toBeVisible();
    await page.getByRole("textbox", { name: "Y minimum", exact: true }).fill("");
    await page.getByRole("textbox", { name: "Y minimum", exact: true }).press("Enter");
    for (const [label, value] of [["X minimum", "-0.1"], ["X maximum", "10"]] as const) {
      await page.getByRole("textbox", { name: label, exact: true }).fill(value);
      await page.getByRole("textbox", { name: label, exact: true }).press("Enter");
    }
    await expect(page.getByText(/loading arrows require manual domains/)).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();
    for (const [label, value] of [["X minimum", "-4"], ["X maximum", "6"]] as const) {
      await page.getByRole("textbox", { name: label, exact: true }).fill(value);
      await page.getByRole("textbox", { name: label, exact: true }).press("Enter");
    }
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const unsafeLoadings = await pcaSvg.evaluate((element) => {
      const svg = element as SVGSVGElement;
      const canvas = svg.getBoundingClientRect();
      const clip = svg.querySelector("clipPath rect")!;
      const scaleX = canvas.width / svg.viewBox.baseVal.width;
      const scaleY = canvas.height / svg.viewBox.baseVal.height;
      const plot = { left: canvas.left + Number(clip.getAttribute("x")) * scaleX, top: canvas.top + Number(clip.getAttribute("y")) * scaleY, right: canvas.left + (Number(clip.getAttribute("x")) + Number(clip.getAttribute("width"))) * scaleX, bottom: canvas.top + (Number(clip.getAttribute("y")) + Number(clip.getAttribute("height"))) * scaleY };
      return [...svg.querySelectorAll("[data-plot-element='ordination-loading']")].flatMap((loading) => {
        const label = loading.querySelector("text")?.getBoundingClientRect();
        const line = loading.querySelector("line");
        const length = line ? Math.hypot(Number(line.getAttribute("x2")) - Number(line.getAttribute("x1")), Number(line.getAttribute("y2")) - Number(line.getAttribute("y1"))) : 0;
        const labelInside = label && label.left >= plot.left - 1 && label.top >= plot.top - 1 && label.right <= plot.right + 1 && label.bottom <= plot.bottom + 1;
        return length >= 2 && labelInside ? [] : [{ label: loading.textContent, length, scale: loading.getAttribute("data-loading-scale") }];
      });
    });
    expect(unsafeLoadings).toEqual([]);

    await page.getByRole("combobox", { name: "View" }).selectOption("scree");
    await expect(page.getByText("Supplied PERMANOVA", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Group covariance ellipses" })).toHaveCount(0);
    await expect(pcaSvg.locator("[data-plot-family='ordination-scree']")).toBeVisible();
    await expect(pcaSvg.locator("[data-plot-element='scree-bar']").first()).toBeVisible();
    await expect(pcaSvg).toContainText("Principal component");
    await expect(pcaSvg).toContainText("Explained variance (%)");
    await page.getByRole("combobox", { name: "View" }).selectOption("3d");
    await expect(page.getByRole("combobox", { name: "Z component" })).toHaveValue("PC3");
    await expect(pcaSvg.locator("[data-plot-family='ordination-3d']")).toBeVisible();
    await expect(pcaSvg.locator("[data-plot-element='ordination-shape-legend']")).toBeVisible();

    await page.getByRole("button", { name: /^PCoA/ }).click();
    await page.getByRole("button", { name: "Example 2" }).click();
    await page.getByRole("combobox", { name: "View" }).selectOption("3d");
    for (const [label, value] of [["PCoA 1 variance (%)", "41.2"], ["PCoA 2 variance (%)", "22.4"], ["PCoA 3 variance (%)", "11.3"], ["R²", "0.183"], ["P value", "0.004"], ["Permutations", "999"]] as const) {
      await page.getByRole("textbox", { name: label, exact: true }).fill(value);
      await page.getByRole("textbox", { name: label, exact: true }).press("Enter");
    }
    await page.getByRole("textbox", { name: "Method note" }).fill("Bray-Curtis; blocked permutations by cohort");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const pcoaSvg = page.locator("svg[aria-label='PCoA scientific figure preview']");
    await expect(pcoaSvg).toContainText("PERMANOVA (supplied)");
    await expect(pcoaSvg).toContainText("PCoA 3 (11.3%)");
    const escapedText = await pcoaSvg.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("text")].flatMap((label) => {
        const box = label.getBoundingClientRect();
        return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [label.textContent] : [];
      });
    });
    expect(escapedText).toEqual([]);

    for (const name of ["t-SNE", "NMDS"]) {
      await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
      await expect(page.getByText("Ready", { exact: true })).toBeVisible();
      await expect(page.locator(`svg[aria-label='${name} scientific figure preview'] [data-plot-family='ordination-scores']`)).toBeVisible();
    }
  });

  test("reports analysis provenance across supplied and in-browser workflows", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop provenance contract");
    await page.goto("/");
    const provenance = page.locator("[data-analysis-provenance]");

    await page.getByRole("button", { name: /^PCoA/ }).click();
    await expect(provenance).toHaveAttribute("data-analysis-provenance", "supplied");
    await expect(provenance.getByText("Supplied", { exact: true })).toBeVisible();
    await expect(provenance).toHaveAttribute("data-provenance-detail", /without recomputing PCoA/);

    await page.getByRole("button", { name: /^ROC/ }).click();
    await expect(provenance).toHaveAttribute("data-analysis-provenance", "calculated-in-studio");
    await expect(provenance.getByText("Calculated in Studio", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Example 2" }).click();
    await expect(provenance).toHaveAttribute("data-analysis-provenance", "supplied");
    const configDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Config" }).click();
    const configPath = await (await configDownload).path();
    const config = JSON.parse(await readFile(configPath!, "utf8"));
    expect(config.analysisProvenance).toMatchObject({ source: "supplied", label: "Supplied" });
    expect(config.analysisProvenance.detail).toMatch(/Time-dependent ROC/);

    await page.getByRole("button", { name: /^Kaplan/ }).click();
    await expect(provenance).toHaveAttribute("data-analysis-provenance", "calculated-in-studio");
    await expect(provenance).toHaveAttribute("data-provenance-detail", /Kaplan–Meier estimates/);

    await page.getByRole("button", { name: /^Clustered heatmap/ }).click();
    await expect(provenance).toHaveAttribute("data-analysis-provenance", "calculated-in-studio");
    await page.getByRole("checkbox", { name: "Cluster rows" }).uncheck({ force: true });
    await page.getByRole("checkbox", { name: "Cluster columns" }).uncheck({ force: true });
    await expect(provenance).toHaveAttribute("data-analysis-provenance", "supplied");
    await expect(provenance).toHaveAttribute("data-provenance-detail", /Clustering is disabled/);

    await page.getByRole("button", { name: /^Correlation heatmap/ }).click();
    await expect(provenance).toHaveAttribute("data-analysis-provenance", "calculated-in-studio");
    await expect(provenance).toHaveAttribute("data-provenance-detail", /correlation matrix/);

    await page.getByRole("button", { name: /^Venn/ }).click();
    await expect(provenance).toHaveAttribute("data-analysis-provenance", "calculated-in-studio");
    await expect(provenance).toHaveAttribute("data-provenance-detail", /Exact set intersections/);
    await page.getByRole("button", { name: /^UpSet/ }).click();
    await expect(provenance).toHaveAttribute("data-analysis-provenance", "calculated-in-studio");
  });

  test("blocks crowded combined ordination legends until the export canvas can contain them", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop ordination legend boundary");
    await page.goto("/");
    await page.getByRole("button", { name: /^PCoA/ }).click();
    const crowdedRows = Array.from({ length: 12 }, (_, index) => `${index}\t${index % 3}\tExtremelyWideGroupName${index + 1}\tShape${index % 4 + 1}\tS${index + 1}`);
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(`dim1\tdim2\tgroup\tshape\tsample\n${crowdedRows.join("\n")}`);
    await expect(page.getByRole("combobox", { name: "Group" })).toHaveValue("group");
    await expect(page.getByRole("combobox", { name: "Shape" })).toHaveValue("shape");
    await page.getByRole("textbox", { name: "Method note" }).fill("Long upstream annotation describing distance transformation normalization and reproducible coordinate generation");
    await expect(page.getByText(/combined ordination color and shape legends/)).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();
    await page.getByRole("textbox", { name: "Height value" }).fill("640");
    await page.getByRole("textbox", { name: "Height value" }).press("Enter");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const pcoaSvg = page.locator("svg[aria-label='PCoA scientific figure preview']");
    const escapedLegendText = await pcoaSvg.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("[data-plot-element='plot-legend'] text, [data-plot-element='ordination-shape-legend'] text")].flatMap((label) => {
        const box = label.getBoundingClientRect();
        return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [label.textContent] : [];
      });
    });
    expect(escapedLegendText).toEqual([]);
    await expect(pcoaSvg.locator("[data-plot-element='plot-legend'] text[data-full-label^='ExtremelyWideGroupName']").first()).toContainText("…");
  });

  test("switches categorical variants and computes long-form uncertainty", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop categorical-family baseline");
    await page.goto("/");
    const variant = page.getByRole("combobox", { name: "Variant" });
    const svg = page.locator("svg[aria-label='Bar scientific figure preview']");
    for (const value of ["stacked", "percentage", "horizontal", "bidirectional", "faceted", "polar", "bullet", "pyramid", "axis-break", "dual-axis", "overlay"]) {
      await variant.selectOption(value);
      await expect(page.getByText("Ready", { exact: true })).toBeVisible();
      await expect(svg.locator("[data-plot-element='bar']").first()).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Secondary value" })).toHaveCount(["dual-axis", "overlay"].includes(value) ? 1 : 0);
      await expect(page.getByRole("combobox", { name: "Target value" })).toHaveCount(value === "bullet" ? 1 : 0);
      await expect(page.getByRole("combobox", { name: "Facet" })).toHaveCount(value === "faceted" ? 1 : 0);
      await expect(page.getByRole("combobox", { name: "Error representation" })).toHaveCount(["stacked", "percentage", "polar"].includes(value) ? 0 : 1);
    }

    await variant.selectOption("grouped");
    await page.getByRole("button", { name: "Example 2" }).click();
    await expect(page.getByRole("combobox", { name: "Input structure" })).toHaveValue("long");
    await page.getByRole("combobox", { name: "Error representation" }).selectOption("sem");
    await expect(svg.locator("[data-plot-element='error-bar']")).toHaveCount(4);

    await page.getByRole("button", { name: "Example 1" }).click();
    await variant.selectOption("dual-axis");
    await expect(page.getByRole("textbox", { name: "Secondary axis label" })).toHaveValue("Secondary value");
    const previewCard = page.getByRole("heading", { name: "Bar preview" }).locator("xpath=ancestor::section");
    await expectStablePreviewScreenshot(page, previewCard, "bar-dual-axis-desktop.png");

    await variant.selectOption("bidirectional");
    await page.getByRole("combobox", { name: "Error representation" }).selectOption("none");
    for (const values of [[2, 5, 8], [-2, -5, -8], [-4, 1, 7]]) {
      await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(`category\tvalue\tgroup\nA\t${values[0]}\tG1\nB\t${values[1]}\tG2\nC\t${values[2]}\tG3`);
      await page.getByRole("button", { name: "Auto-map" }).click();
      await expect(page.getByText("Ready", { exact: true })).toBeVisible();
      const downloadEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: "SVG" }).click();
      const download = await downloadEvent; const path = await download.path();
      expect(path).not.toBeNull();
      const source = await readFile(path!, "utf8");
      expect(source.match(/data-plot-element="bar"/g)).toHaveLength(3);
      if (values.some((value) => value < 0)) expect(source).toMatch(/data-value="-/);
      expect(source).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    }
  });

  test("renders composition and profile families responsively and exports finite SVG", async ({ page }, testInfo) => {
    await page.goto("/");
    const plotSelect = page.getByRole("combobox", { name: "Plot type" });
    const newPlots = ["pie", "donut", "rose", "waffle", "treemap", "sunburst", "radar", "polar-profile", "population-pyramid"];

    if (testInfo.project.name === "desktop-chromium") {
      for (const plotType of newPlots) {
        await page.getByRole("button", { name: new RegExp(`^${plotType === "polar-profile" ? "Polar profile" : plotType === "population-pyramid" ? "Population pyramid" : plotType[0].toUpperCase() + plotType.slice(1)}`) }).click();
        await expect(page.getByText("Ready", { exact: true })).toBeVisible();
        const svg = page.locator(`svg[data-plot-renderer='advanced'][aria-label$='scientific figure preview']`);
        await expect(svg.locator("[data-plot-data]")).toHaveCount(1);
        const clippedLabels = await svg.evaluate((element) => {
          const canvas = element.getBoundingClientRect();
          return [...element.querySelectorAll("text")].flatMap((label) => {
            const box = label.getBoundingClientRect();
            const inside = box.left >= canvas.left - 1 && box.top >= canvas.top - 1 && box.right <= canvas.right + 1 && box.bottom <= canvas.bottom + 1;
            return inside ? [] : [{ text: label.textContent, left: box.left - canvas.left, top: box.top - canvas.top, right: box.right - canvas.left, bottom: box.bottom - canvas.top }];
          });
        });
        expect(clippedLabels, `${plotType} labels should remain inside the export canvas`).toEqual([]);
      }
      await expect(page.getByRole("combobox", { name: "Display values" })).toBeVisible();
      await page.getByRole("combobox", { name: "Display values" }).selectOption("percent");
      await expect(page.locator("svg[aria-label='Population pyramid scientific figure preview']")).toContainText("%");

      await page.getByRole("button", { name: /^Rose/ }).click();
      await page.getByRole("button", { name: "Reset" }).click();
      const roseConfigEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: "Config" }).click();
      const roseConfigPath = await (await roseConfigEvent).path();
      expect(roseConfigPath).not.toBeNull();
      const roseConfig = JSON.parse(await readFile(roseConfigPath!, "utf8"));
      expect(roseConfig.settings.compositionLabelMode).toBe("value");

      await page.getByRole("button", { name: /^Pie/ }).click();
      await expect(page.getByRole("textbox", { name: "X-axis label" })).toHaveCount(0);
      await expect(page.getByRole("combobox", { name: "Grid" })).toHaveCount(0);
      const compositionInput = page.getByRole("textbox", { name: "CSV or TSV data" });
      await compositionInput.fill(`category\tvalue\n${Array.from({ length: 13 }, (_, index) => `Part ${index + 1}\t${index + 1}`).join("\n")}`);
      await page.getByRole("button", { name: "Auto-map" }).click();
      await expect(page.getByText(/limited to 12 categories/)).toBeVisible();
      await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();
      await compositionInput.fill(`category\tvalue\n${Array.from({ length: 12 }, (_, index) => `Part ${index + 1}\t${index + 1}`).join("\n")}`);
      await page.getByRole("button", { name: "Auto-map" }).click();
      await expect(page.getByText("Ready", { exact: true })).toBeVisible();
      await page.getByRole("combobox", { name: "Legend" }).selectOption("bottom");
      const pieSvg = page.locator("svg[aria-label='Pie scientific figure preview']");
      const clippedPieLabels = await pieSvg.evaluate((element) => {
        const canvas = element.getBoundingClientRect();
        return [...element.querySelectorAll("text")].filter((label) => {
          const box = label.getBoundingClientRect();
          return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1;
        }).map((label) => label.textContent);
      });
      expect(clippedPieLabels).toEqual([]);

      await page.getByRole("button", { name: /^Sunburst/ }).click();
      await page.getByRole("combobox", { name: "Legend" }).selectOption("right");
      const previewCard = page.getByRole("heading", { name: "Sunburst preview" }).locator("xpath=ancestor::section");
      await expectStablePreviewScreenshot(page, previewCard, "sunburst-hierarchy-desktop.png", { maxDiffPixels: 100 });
    } else {
      await plotSelect.selectOption("radar");
      await expect(page.getByRole("heading", { name: "Radar preview" })).toBeVisible();
      const svgBox = await page.locator("svg[aria-label='Radar scientific figure preview']").boundingBox();
      expect(svgBox).not.toBeNull();
      expect(svgBox!.width).toBeLessThanOrEqual(340);
      const previewCard = page.getByRole("heading", { name: "Radar preview" }).locator("xpath=ancestor::section");
      await expectStablePreviewScreenshot(page, previewCard, "radar-profile-mobile.png");
      await plotSelect.selectOption("sunburst");
    }

    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG" }).click();
    const download = await downloadEvent;
    const path = await download.path();
    expect(path).not.toBeNull();
    const source = await readFile(path!, "utf8");
    expect(source).toContain('data-plot-renderer="advanced"');
    expect(source).toContain('data-plot-family="sunburst"');
    expect(source).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
  });

  test("composes distribution layers, paired facets, and orientation responsively", async ({ page }, testInfo) => {
    await page.goto("/");
    if (testInfo.project.name === "desktop-chromium") {
      await page.getByRole("button", { name: /^Histogram/ }).click();
      await expect(page.getByRole("checkbox", { name: "Histogram" })).toBeChecked();
      await expect(page.getByRole("checkbox", { name: "Density" })).not.toBeChecked();
      await page.getByRole("button", { name: "Example 2" }).click();
      await page.getByRole("checkbox", { name: "Density" }).check({ force: true });
      await page.getByRole("checkbox", { name: "Box & whiskers" }).check({ force: true });
      await page.getByRole("checkbox", { name: "Paired lines" }).check({ force: true });
      await page.getByRole("checkbox", { name: "Supplied P-value labels" }).check({ force: true });
      await page.getByRole("combobox", { name: "Center summary" }).selectOption("mean");
      await page.getByRole("combobox", { name: "Uncertainty" }).selectOption("ci95");
      await expect(page.getByText("Ready", { exact: true })).toBeVisible();
      const svg = page.locator("svg[aria-label='Histogram scientific figure preview']");
      for (const element of ["density", "histogram-bin", "box-layer", "center-summary", "uncertainty", "paired-line", "facet-label"]) expect(await svg.locator(`[data-plot-element='${element}']`).count(), element).toBeGreaterThan(0);
      await expect(svg).toContainText("Discovery");
      await expect(svg).toContainText("p=0.03");
      const distributionPreview = page.getByRole("heading", { name: "Histogram preview" }).locator("xpath=ancestor::section");
      await expectStablePreviewScreenshot(page, distributionPreview, "distribution-layers-desktop.png");
      await page.getByRole("combobox", { name: "Orientation" }).selectOption("horizontal");
      await expect(page.getByRole("textbox", { name: "X minimum", exact: true })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Y minimum", exact: true })).toHaveCount(0);

      const downloadEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: "SVG" }).click();
      const path = await (await downloadEvent).path();
      expect(path).not.toBeNull();
      const source = await readFile(path!, "utf8");
      expect(source).toContain('data-plot-family="distribution"');
      expect(source).toContain('data-plot-element="paired-line"');
      expect(source).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);

      await page.getByRole("button", { name: /^Ridge/ }).click();
      await expect(page.getByRole("combobox", { name: "Orientation" })).toHaveValue("horizontal");
      await expect(page.getByRole("checkbox", { name: "Density" })).toBeChecked();
      await expect(page.getByRole("checkbox", { name: "Histogram" })).not.toBeChecked();
    } else {
      await page.getByRole("combobox", { name: "Plot type" }).selectOption("ridge");
      await expect(page.getByRole("heading", { name: "Ridge preview" })).toBeVisible();
      const svgBox = await page.locator("svg[aria-label='Ridge scientific figure preview']").boundingBox();
      expect(svgBox).not.toBeNull();
      expect(svgBox!.width).toBeLessThanOrEqual(340);
    }
  });

  test("configures line uncertainty and advanced association views", async ({ page }, testInfo) => {
    await page.goto("/");
    if (testInfo.project.name === "desktop-chromium") {
      await page.getByRole("button", { name: /^Line/ }).click();
      await page.getByRole("combobox", { name: "Error representation" }).selectOption("ci95");
      await page.getByRole("combobox", { name: "Display style" }).selectOption("band");
      await expect(page.getByText("Ready", { exact: true })).toBeVisible();
      await expect(page.locator("svg[aria-label='Line scientific figure preview'] [data-plot-element='line-uncertainty-band']")).toHaveCount(2);

      await page.getByRole("button", { name: /^Scatter/ }).click();
      await page.getByRole("button", { name: "Example 2" }).click();
      await page.getByRole("checkbox", { name: "Swap axes" }).check({ force: true });
      await page.getByRole("combobox", { name: "Variant" }).selectOption("ternary");
      await expect(page.getByRole("checkbox", { name: "Swap axes" })).toHaveCount(0);
      await expect(page.getByRole("combobox", { name: "Correlation method" })).toHaveCount(0);
      await expect(page.getByText(/Ternary rows are normalized to proportions/)).toBeVisible();
      await expect(page.locator("svg[aria-label='Scatter scientific figure preview'] [data-plot-element='ternary-point']")).toHaveCount(9);
      const configDownload = page.waitForEvent("download");
      await page.getByRole("button", { name: "Config" }).click();
      const configPath = await (await configDownload).path();
      expect(configPath).not.toBeNull();
      const exportedConfig = JSON.parse(await readFile(configPath!, "utf8")) as { settings: { swapAxes: boolean } };
      expect(exportedConfig.settings.swapAxes).toBe(false);

      await page.getByRole("combobox", { name: "Variant" }).selectOption("points");
      await page.getByRole("combobox", { name: "Fit" }).selectOption("linear");
      await page.getByRole("checkbox", { name: "Mean 95% confidence band" }).check({ force: true });
      await page.getByRole("checkbox", { name: "Show correlation P value" }).check({ force: true });
      await page.getByRole("combobox", { name: "Group behavior" }).selectOption("combined");
      const scatterSvg = page.locator("svg[aria-label='Scatter scientific figure preview']");
      await expect(scatterSvg.locator("[data-plot-element='association-fit']")).toHaveCount(1);
      await expect(scatterSvg.locator("[data-plot-element='fit-confidence-band']")).toHaveCount(1);
      await expect(scatterSvg.locator("[data-plot-element='association-summary']")).toContainText("Pearson r");
      await expect(scatterSvg.locator("[data-plot-element='association-summary']")).toContainText("two-sided t p");
      await expect(scatterSvg.locator("[data-plot-element='association-statistic']")).toContainText("n=9");
      const clippedAssociationText = await scatterSvg.evaluate((element) => {
        const canvas = element.getBoundingClientRect();
        return [...element.querySelectorAll("[data-plot-element='association-summary'] text")].filter((label) => { const box = label.getBoundingClientRect(); return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1; }).map((label) => label.textContent);
      });
      expect(clippedAssociationText).toEqual([]);
      await page.getByRole("combobox", { name: "Variant" }).selectOption("density");
      await expect(page.getByRole("combobox", { name: "Legend" })).toHaveCount(0);
    } else {
      await page.getByRole("combobox", { name: "Plot type" }).selectOption("scatter");
      await page.getByRole("button", { name: "Example 2" }).click();
      await page.getByRole("combobox", { name: "Variant" }).selectOption("3d");
      const svg = page.locator("svg[aria-label='Scatter scientific figure preview']");
      await expect(svg.locator("[data-plot-element='scatter-3d-point']")).toHaveCount(9);
      const box = await svg.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(340);
      expect(await svg.innerHTML()).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    }
  });

  test("renders genomic association, cancer alterations, and motif logos with bounded geometry", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop genomic-family acceptance");
    await page.goto("/");

    await page.getByRole("button", { name: /^Manhattan/ }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const manhattan = page.locator("svg[aria-label='Manhattan scientific figure preview']");
    await expect(manhattan.locator("[data-plot-element='manhattan-point']")).toHaveCount(216);
    await expect(manhattan.locator("[data-plot-element='genome-wide-threshold']")).toHaveCount(1);
    await page.getByRole("checkbox", { name: "Label strongest loci" }).check({ force: true });
    await expect(manhattan.locator("[data-plot-label]").first()).toBeVisible();
    const escapedManhattanMarks = await manhattan.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("[data-plot-element='manhattan-point'], [data-plot-label]")].flatMap((mark) => {
        const box = mark.getBoundingClientRect();
        return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [mark.getAttribute("data-plot-element") ?? mark.textContent] : [];
      });
    });
    expect(escapedManhattanMarks).toEqual([]);

    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("chromosome\tposition\tp_value\tvariant\nchr 1\t1.5\t0\trsBad");
    await expect(page.getByText(/invalid label/)).toBeVisible();
    await expect(page.getByText(/positive safe integers/)).toBeVisible();
    await expect(page.getByText(/must lie in \(0, 1\]/)).toBeVisible();
    await page.getByRole("button", { name: "Example 1" }).click();

    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill([
      "chromosome\tposition\tp_value\tvariant",
      "VeryLongReferenceContigIdentifier_000001\t100\t0.01\trsLong1",
      "VeryLongReferenceContigIdentifier_000002\t120\t0.02\trsLong2",
      "chr23\t80\t0.03\trs23",
      "chrX\t90\t0.04\trsX",
    ].join("\n"));
    await page.getByRole("button", { name: "Auto-map" }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(manhattan.locator("[data-plot-element='genome-axis-label'][data-full-label='VERYLONGREFERENCECONTIGIDENTIFIER_000001']")).toHaveCount(1);
    const escapedManhattanAxisLabels = await manhattan.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("[data-plot-element='genome-axis-label']")].flatMap((label) => { const box = label.getBoundingClientRect(); return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [label.textContent] : []; });
    });
    expect(escapedManhattanAxisLabels).toEqual([]);

    await page.getByRole("button", { name: /^Chromosome ideogram/ }).click();
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("chromosome\tstart\tend\tstain\tband\nVeryLongReferenceContigIdentifier_000001\t0\t100\tgneg\tp1\nchr23\t0\t80\tgpos50\tq1");
    await page.getByRole("button", { name: "Auto-map" }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const ideogram = page.locator("svg[aria-label='Chromosome ideogram scientific figure preview']");
    await expect(ideogram.locator("text[data-full-label='VERYLONGREFERENCECONTIGIDENTIFIER_000001']")).toHaveCount(1);
    const escapedIdeogramText = await ideogram.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("text")].flatMap((label) => { const box = label.getBoundingClientRect(); return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [label.textContent] : []; });
    });
    expect(escapedIdeogramText).toEqual([]);

    await page.getByRole("button", { name: /^Genome tracks/ }).click();
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill([
      "chromosome\tstart\tend\tvalue\ttrack\tfeature",
      "VeryLongReferenceContigIdentifier_000001\t0\t100\t1.25\tAccessibility\tPeak_A",
      "VeryLongReferenceContigIdentifier_000002\t0\t120\t3.75\tAccessibility\tPeak_B",
      "chr23\t0\t80\t2.50\tAccessibility\tPeak_C",
    ].join("\n"));
    await page.getByRole("button", { name: "Auto-map" }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const tracks = page.locator("svg[aria-label='Genome tracks scientific figure preview']");
    await expect(tracks.locator("[data-plot-element='genome-track-color-legend']")).toHaveCount(1);
    await expect(tracks.locator("[data-plot-element='genome-axis-label'][data-full-label='VERYLONGREFERENCECONTIGIDENTIFIER_000001']")).toHaveCount(1);
    const escapedTrackAxisLabels = await tracks.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("[data-plot-element='genome-axis-label']")].flatMap((label) => { const box = label.getBoundingClientRect(); return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [label.textContent] : []; });
    });
    expect(escapedTrackAxisLabels).toEqual([]);

    await page.getByRole("button", { name: /^Mutation waterfall/ }).click();
    const longSampleRows = Array.from({ length: 8 }, (_, index) => `ExtremelyLongTumorSampleIdentifier_${index + 1}\tTP53\t${index % 2 ? "Missense" : "Nonsense"}`);
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(`sample\tgene\talteration\n${longSampleRows.join("\n")}`);
    await page.getByRole("button", { name: "Auto-map" }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const waterfall = page.locator("svg[aria-label='Mutation waterfall scientific figure preview']");
    await expect(waterfall.locator("[data-plot-element='waterfall-sample-label'][data-full-label^='ExtremelyLong']").first()).toContainText("…");
    const escapedWaterfallLabels = await waterfall.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("[data-plot-element='waterfall-sample-label']")].flatMap((label) => { const box = label.getBoundingClientRect(); return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [label.textContent] : []; });
    });
    expect(escapedWaterfallLabels).toEqual([]);

    await page.getByRole("button", { name: /^Oncoplot/ }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const oncoplot = page.locator("svg[aria-label='Oncoplot scientific figure preview']");
    expect(await oncoplot.locator("[data-plot-element='oncoplot-cell']").count()).toBeGreaterThan(30);
    expect(await oncoplot.locator("[data-plot-element='oncoplot-burden']").count()).toBeGreaterThanOrEqual(20);
    expect(await oncoplot.locator("[data-plot-element='oncoplot-frequency']").count()).toBeGreaterThanOrEqual(8);
    await page.getByRole("checkbox", { name: "Show burden and frequency margins" }).uncheck({ force: true });
    await expect(oncoplot.locator("[data-plot-element='oncoplot-burden']")).toHaveCount(0);
    await expect(oncoplot.locator("[data-plot-element='oncoplot-frequency']")).toHaveCount(0);

    await page.getByRole("button", { name: /^Motif logo/ }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const motif = page.locator("svg[aria-label='Motif logo scientific figure preview']");
    expect(await motif.locator("[data-plot-element='motif-letter']").count()).toBeGreaterThan(20);
    await expect(motif).toContainText("Information (bits)");
    const informationHeight = await motif.locator("[data-plot-element='motif-letter']").first().getAttribute("data-letter-height");
    await page.getByRole("combobox", { name: "Letter height" }).selectOption("probability");
    await expect(motif).toContainText("Probability");
    const probabilityHeight = await motif.locator("[data-plot-element='motif-letter']").first().getAttribute("data-letter-height");
    expect(probabilityHeight).not.toBe(informationHeight);

    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG" }).click();
    const path = await (await downloadEvent).path();
    expect(path).not.toBeNull();
    const source = await readFile(path!, "utf8");
    expect(source).toContain('data-plot-family="motif-logo"');
    expect(source).toContain('data-letter-height=');
    expect(source).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
  });

  test("renders typed reproducible networks and hierarchy-specific trees safely", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop relationship-family acceptance");
    await page.goto("/");

    await page.getByRole("button", { name: /^PPI network/ }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const ppi = page.locator("svg[aria-label='PPI network scientific figure preview']");
    await expect(ppi.locator("[data-plot-element='network-node']")).toHaveCount(8);
    await expect(ppi.locator("[data-plot-element='network-edge']")).toHaveCount(6);
    await expect(ppi.locator("[data-plot-element='network-edge'][data-direction='undirected']")).toHaveCount(6);
    await expect(ppi.locator("[data-node-id='Isolated_candidate'][data-explicit-node='true']")).toHaveCount(1);
    await page.getByRole("checkbox", { name: "Keep explicit isolated nodes" }).uncheck({ force: true });
    await expect(ppi.locator("[data-node-id='Isolated_candidate']")).toHaveCount(0);

    const firstNodeBefore = await ppi.locator("[data-plot-element='network-node'] circle").first().getAttribute("cx");
    await page.getByRole("combobox", { name: "Layout" }).selectOption("layered");
    const firstNodeAfter = await ppi.locator("[data-plot-element='network-node'] circle").first().getAttribute("cx");
    expect(firstNodeAfter).not.toBe(firstNodeBefore);
    const widthInput = page.getByRole("textbox", { name: "Width value", exact: true });
    await widthInput.fill("300");
    await widthInput.press("Enter");
    const clippedNodes = await ppi.evaluate((element) => {
      const clip = element.querySelector("clipPath rect")!;
      const left = Number(clip.getAttribute("x")); const top = Number(clip.getAttribute("y")); const right = left + Number(clip.getAttribute("width")); const bottom = top + Number(clip.getAttribute("height"));
      return [...element.querySelectorAll("[data-plot-element='network-node'] circle")].filter((circle) => { const cx = Number(circle.getAttribute("cx")); const cy = Number(circle.getAttribute("cy")); const r = Number(circle.getAttribute("r")); return cx - r < left || cx + r > right || cy - r < top || cy + r > bottom; }).length;
    });
    expect(clippedNodes).toBe(0);
    await widthInput.fill("340");
    await widthInput.press("Enter");
    await page.getByRole("checkbox", { name: "Show node labels" }).check({ force: true });
    const escapedNetworkLabels = await ppi.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("[data-plot-label]")].flatMap((label) => { const box = label.getBoundingClientRect(); return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [label.textContent] : []; });
    });
    expect(escapedNetworkLabels).toEqual([]);

    await page.getByRole("button", { name: "Tree Hierarchy", exact: true }).click();
    await page.getByRole("checkbox", { name: "Show leaf labels" }).check({ force: true });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const tree = page.locator("svg[aria-label='Tree scientific figure preview']");
    await expect(tree.locator("[data-plot-element='tree-branch']")).toHaveCount(6);
    await expect(tree.locator("[data-plot-element='tree-label']")).toHaveCount(4);
    const escapedTreeLabels = await tree.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll("[data-plot-element='tree-label']")].flatMap((label) => { const box = label.getBoundingClientRect(); return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1 ? [label.textContent] : []; });
    });
    expect(escapedTreeLabels).toEqual([]);
    const clippedTreeNodes = await tree.evaluate((element) => {
      const clip = element.querySelector("clipPath rect")!;
      const left = Number(clip.getAttribute("x")); const top = Number(clip.getAttribute("y")); const right = left + Number(clip.getAttribute("width")); const bottom = top + Number(clip.getAttribute("height"));
      return [...element.querySelectorAll("[data-plot-element='tree-node'] circle")].filter((circle) => { const cx = Number(circle.getAttribute("cx")); const cy = Number(circle.getAttribute("cy")); const r = Number(circle.getAttribute("r")) + Number(circle.getAttribute("stroke-width") ?? 0) / 2; return cx - r < left || cx + r > right || cy - r < top || cy + r > bottom; }).length;
    });
    expect(clippedTreeNodes).toBe(0);

    await page.getByRole("button", { name: "Dendrogram Hierarchical clustering", exact: true }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const dendrogram = page.locator("svg[aria-label='Dendrogram scientific figure preview']");
    await expect(dendrogram.locator("[data-plot-element='dendrogram-branch']")).toHaveCount(8);
    await expect(dendrogram).toContainText("Merge height: 1");
    await page.getByRole("combobox", { name: "Orientation" }).selectOption("horizontal");
    await expect(dendrogram.locator("[data-plot-element='dendrogram-branch']")).toHaveCount(8);
    const clippedHorizontalDendrogramNodes = await dendrogram.evaluate((element) => {
      const clip = element.querySelector("clipPath rect")!;
      const left = Number(clip.getAttribute("x")); const top = Number(clip.getAttribute("y")); const right = left + Number(clip.getAttribute("width")); const bottom = top + Number(clip.getAttribute("height"));
      return [...element.querySelectorAll("[data-plot-element='dendrogram-node'] circle")].filter((circle) => { const cx = Number(circle.getAttribute("cx")); const cy = Number(circle.getAttribute("cy")); const r = Number(circle.getAttribute("r")) + Number(circle.getAttribute("stroke-width") ?? 0) / 2; return cx - r < left || cx + r > right || cy - r < top || cy + r > bottom; }).length;
    });
    expect(clippedHorizontalDendrogramNodes).toBe(0);
    expect(await dendrogram.innerHTML()).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);

    await page.getByRole("button", { name: /^Network Relationships/ }).click();
    const curvedRows = [
      "record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value",
      "node\tA\t\t\t\t\t\t\tG\tCell\t1",
      "node\tB\t\t\t\t\t\t\tG\tCell\t2",
      "edge\t\tA\tA\t0.5\tundirected\tpositive\tself\tEvidence_A\t\t",
      "edge\t\tA\tB\t0.7\tdirected\tpositive\tpathway\tEvidence_B\t\t",
      "edge\t\tB\tA\t0.9\tbidirectional\tnegative\tphysical\tEvidence_C\t\t",
    ].join("\n");
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(curvedRows);
    const dataLineInput = page.getByRole("textbox", { name: "Data line value", exact: true });
    await dataLineInput.fill("5");
    await dataLineInput.press("Enter");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const network = page.locator("svg[aria-label='Network scientific figure preview']");
    const curvedBounds = await network.evaluate((element) => {
      const clip = element.querySelector("clipPath rect")!;
      const left = Number(clip.getAttribute("x")); const top = Number(clip.getAttribute("y")); const right = left + Number(clip.getAttribute("width")); const bottom = top + Number(clip.getAttribute("height"));
      const paths = [...element.querySelectorAll<SVGGraphicsElement>("[data-plot-element='network-edge'] path")];
      return { uniquePaths: new Set(paths.map((path) => path.getAttribute("d"))).size, outside: paths.filter((path) => { const box = path.getBBox(); const direction = path.parentElement?.getAttribute("data-direction"); const margin = Math.max(Number(path.getAttribute("stroke-width")) / 2, direction === "undirected" ? 0 : 4); return box.x - margin < left - 0.5 || box.y - margin < top - 0.5 || box.x + box.width + margin > right + 0.5 || box.y + box.height + margin > bottom + 0.5; }).length };
    });
    expect(curvedBounds).toEqual({ uniquePaths: 3, outside: 0 });
    const denseRows = ["record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value"];
    for (let index = 0; index < 120; index += 1) denseRows.push(`node\tN${index}\t\t\t\t\t\t\tOne layer\tCell\t1`);
    for (let index = 1; index < 120; index += 1) denseRows.push(`edge\t\tN0\tN${index}\t1\tundirected\tneutral\trelationship\tEvidence\t\t`);
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(denseRows.join("\n"));
    await expect(page.getByText(/current layered layout is not pixel-safe/i)).toBeVisible();
    await expect(page.getByText("Ready", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();
  });

  test("renders conserved flows and a shared-coordinate multi-track Circos", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop flow and circular acceptance");
    await page.goto("/");

    await page.getByRole("button", { name: "Sankey Flow" }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const sankey = page.locator("svg[aria-label='Sankey scientific figure preview']");
    expect(await sankey.locator("[data-plot-element='flow-ribbon']").count()).toBeGreaterThan(3);
    await expect(sankey).toContainText("input rows");
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("source\ttarget\tvalue\tgroup\nExtremely long sender population label\tExtremely long receiver population label\t5\tLong evidence group one\nExtremely long sender population label\tSecond extremely long receiver label\t3\tLong evidence group two");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(sankey.locator("[data-full-label='Extremely long sender population label']")).toContainText("…");
    const escapedSankeyText = await sankey.evaluate((element) => { const canvas = element.getBoundingClientRect(); return [...element.querySelectorAll("text")].filter((label) => { const box = label.getBoundingClientRect(); return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1; }).length; });
    expect(escapedSankeyText).toBe(0);

    await page.getByRole("button", { name: /^Alluvial/ }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const alluvial = page.locator("svg[aria-label='Alluvial scientific figure preview']");
    expect(await alluvial.locator("[data-plot-element='alluvial-ribbon']").count()).toBeGreaterThan(5);
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("flow_id\taxis\tstratum\tvalue\tgroup\nP1\tT0\tA\t5\tG\nP1\tT1\tB\t4\tG");
    await expect(page.getByText(/changes weight across axes/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();
    const crowdedAlluvial = ["flow_id\taxis\tstratum\tvalue\tgroup", ...Array.from({ length: 8 }, (_, axis) => `P1\tExtremely long alluvial axis ${axis + 1}\tExtremely long stratum alpha ${axis + 1}\t5\tCohort alpha`), ...Array.from({ length: 8 }, (_, axis) => `P2\tExtremely long alluvial axis ${axis + 1}\tExtremely long stratum beta ${axis + 1}\t3\tCohort beta`)].join("\n");
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(crowdedAlluvial);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const alluvialLabelSafety = await alluvial.evaluate((element) => {
      const canvas = element.getBoundingClientRect(); const labels = [...element.querySelectorAll<SVGGraphicsElement>("[data-plot-element='alluvial-axis-label'], [data-plot-element='alluvial-stratum-label']")]; const boxes = labels.map((label) => label.getBoundingClientRect());
      let collisions = 0; for (let first = 0; first < boxes.length; first += 1) for (let second = first + 1; second < boxes.length; second += 1) { const a = boxes[first]; const b = boxes[second]; if (a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5) collisions += 1; }
      return { collisions, outside: boxes.filter((box) => box.left < canvas.left - 1 || box.right > canvas.right + 1 || box.top < canvas.top - 1 || box.bottom > canvas.bottom + 1).length };
    });
    expect(alluvialLabelSafety).toEqual({ collisions: 0, outside: 0 });

    await page.getByRole("button", { name: /^Chord/ }).click();
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("source\ttarget\tvalue\nDominant A\tDominant B\t1000\nTiny C\tTiny D\t0.001");
    await expect(page.getByText(/minimum category arc/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();

    await page.getByRole("button", { name: /^Ligand–receptor/ }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const ligandReceptor = page.locator("svg[aria-label='Ligand–receptor scientific figure preview']");
    expect(await ligandReceptor.locator("[data-plot-element='ligand-receptor-edge']").count()).toBeGreaterThan(12);
    await expect(ligandReceptor).toContainText("Ligand");
    await expect(ligandReceptor).toContainText("Receptor");

    await page.getByRole("button", { name: /^Circos/ }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const circos = page.locator("svg[aria-label='Circos scientific figure preview']");
    await expect(circos.locator("[data-coordinate-system='shared-genomic']")).toHaveCount(1);
    for (const element of ["circos-bar", "circos-heatmap", "circos-scatter", "circos-fusion", "circos-correlation", "circos-link", "circos-scale-legend"]) await expect(circos.locator(`[data-plot-element='${element}']`).first()).toBeVisible();
    await expect(circos.locator("[data-full-label='GENE1']")).toBeVisible();
    const footerClipStyles = await circos.locator("[data-plot-element='circos-scale-legend'] rect[data-no-clip]").evaluateAll((marks) => marks.map((mark) => getComputedStyle(mark).clipPath));
    expect(footerClipStyles.length).toBeGreaterThan(2);
    expect(footerClipStyles.every((clipPath) => clipPath === "none")).toBe(true);
    const escaped = await circos.evaluate((element) => {
      const canvas = element.getBoundingClientRect();
      return [...element.querySelectorAll<SVGGraphicsElement>("[data-plot-element], text")].filter((mark) => { const box = mark.getBoundingClientRect(); return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1; }).length;
    });
    expect(escaped).toBe(0);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG" }).click();
    const downloaded = await download;
    const path = await downloaded.path();
    expect(path).not.toBeNull();
    const source = await readFile(path!, "utf8");
    expect(source).toContain('data-coordinate-system="shared-genomic"');
    expect(source).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);

    const denseTracks = ["record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length", ...Array.from({ length: 8 }, (_, index) => `bar\tchr1\t${index * 10}\t${index * 10 + 5}\t1000\t${index + 1}\tF${index + 1}\tTrack ${index + 1}\t\t\t\t`)].join("\n");
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(denseTracks);
    const trackGap = page.getByRole("textbox", { name: "Track gap value", exact: true });
    await trackGap.fill("12");
    await trackGap.press("Enter");
    await expect(page.getByText(/track spacing/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();
    const denseScatterTracks = ["record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length", ...Array.from({ length: 8 }, (_, index) => `scatter\tchr1\t${index * 10}\t${index * 10 + 5}\t1000\t${index + 1}\tS${index + 1}\tScatter ${index + 1}\t\t\t\t`)].join("\n");
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(denseScatterTracks);
    await trackGap.fill("0");
    await trackGap.press("Enter");
    const pointSize = page.getByRole("textbox", { name: "Point size value", exact: true });
    await pointSize.fill("12");
    await pointSize.press("Enter");
    await expect(page.getByText(/scatter diameter within its track band/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();
  });

  test("counts, lays out, and downloads exact Venn and UpSet intersections", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop set-intersection acceptance");
    await page.goto("/");

    await page.getByRole("button", { name: /^Venn/ }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const venn = page.locator("svg[aria-label='Venn scientific figure preview']");
    await expect(venn.locator("[data-plot-family='venn-classic']")).toHaveCount(1);
    await expect(venn.locator("[data-plot-element='set-region-label']")).toHaveCount(7);
    await expect(venn.locator("[data-intersection-signature='RNA-seq\u0001Proteomics\u0001CRISPR']")).toContainText("1");

    await page.getByRole("button", { name: /Example 2.*Peak overlap/ }).click();
    await expect(page.getByRole("combobox", { name: "Input structure" })).toHaveValue("peak-overlap");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(venn.locator("[data-plot-family='venn-radial'][data-input-mode='peak-overlap']")).toHaveCount(1);

    const sevenSetRows = ["item\tset", ...Array.from({ length: 7 }, (_, index) => `only${index + 1}\tSet ${index + 1}`), ...Array.from({ length: 7 }, (_, index) => `shared\tSet ${index + 1}`)].join("\n");
    await page.getByRole("combobox", { name: "Input structure" }).selectOption("membership");
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(sevenSetRows);
    await page.getByRole("button", { name: "Auto-map" }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(venn.locator("[data-layout='radial-exact-intersections'] [data-plot-element='radial-intersection-region']")).toHaveCount(8);
    const radialSafety = await venn.evaluate((element) => {
      const clip = element.querySelector("clipPath rect")!;
      const left = Number(clip.getAttribute("x")); const top = Number(clip.getAttribute("y")); const right = left + Number(clip.getAttribute("width")); const bottom = top + Number(clip.getAttribute("height"));
      const labels = [...element.querySelectorAll<SVGGraphicsElement>("[data-plot-element='set-region-label']")];
      const boxes = labels.map((label) => label.getBBox());
      let collisions = 0;
      for (let first = 0; first < boxes.length; first += 1) for (let second = first + 1; second < boxes.length; second += 1) { const a = boxes[first]; const b = boxes[second]; if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) collisions += 1; }
      return { collisions, outside: boxes.filter((box) => box.x < left || box.x + box.width > right || box.y < top || box.y + box.height > bottom).length };
    });
    expect(radialSafety).toEqual({ collisions: 0, outside: 0 });

    await page.getByRole("button", { name: /^UpSet/ }).click();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const upset = page.locator("svg[aria-label='UpSet scientific figure preview']");
    await expect(upset.locator("[data-plot-element='upset-set-summary']")).toHaveCount(3);
    const visibleSetSummary = await upset.evaluate((element) => {
      const marks = [...element.querySelectorAll<SVGGraphicsElement>("[data-plot-element='upset-set-summary'] rect, [data-plot-element='upset-set-summary'] text")];
      return { clipped: marks.filter((mark) => getComputedStyle(mark).clipPath !== "none").length, empty: marks.filter((mark) => { const box = mark.getBoundingClientRect(); return box.width <= 0 || box.height <= 0; }).length };
    });
    expect(visibleSetSummary).toEqual({ clipped: 0, empty: 0 });
    const bottomGap = await upset.evaluate((element) => {
      const clip = element.querySelector("clipPath rect")!;
      const bottom = Number(clip.getAttribute("y")) + Number(clip.getAttribute("height"));
      const circles = [...element.querySelectorAll<SVGCircleElement>("[data-plot-element='upset-intersection'] circle")];
      return bottom - Math.max(...circles.map((circle) => Number(circle.getAttribute("cy"))));
    });
    expect(bottomGap).toBeLessThanOrEqual(14);
    expect(bottomGap).toBeGreaterThanOrEqual(10);

    await page.getByRole("combobox", { name: "Exact intersection to download" }).selectOption({ label: "RNA-seq ∩ Proteomics ∩ CRISPR · n=1" });
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download selected members" }).click();
    const downloaded = await download;
    expect(downloaded.suggestedFilename()).toMatch(/upset-rna-seq-and-proteomics-and-crispr-exact-members\.tsv/);
    const path = await downloaded.path();
    expect(path).not.toBeNull();
    expect(await readFile(path!, "utf8")).toBe("item\texact_intersection\nTP53\tRNA-seq & Proteomics & CRISPR");

    const longSetRows = "item\tset\na\tExtremely long transcriptomic discovery cohort\nb\tExtremely long proteomic validation cohort\nc\tExtremely long CRISPR perturbation cohort\nd\tExtremely long transcriptomic discovery cohort\nd\tExtremely long proteomic validation cohort";
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(longSetRows);
    const tickSize = page.getByRole("textbox", { name: "Tick size value", exact: true });
    await tickSize.fill("16");
    await tickSize.press("Enter");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const summaryCollisions = await upset.evaluate((element) => [...element.querySelectorAll<SVGGElement>("[data-plot-element='upset-set-summary']")].filter((summary) => {
      const label = summary.querySelector<SVGTextElement>("[data-plot-element='upset-set-label']")!.getBoundingClientRect();
      const bar = summary.querySelector<SVGRectElement>("[data-plot-element='upset-set-bar']")!.getBoundingClientRect();
      return label.right > bar.left - 1;
    }).length);
    expect(summaryCollisions).toBe(0);
  });

  test("renders clinical evaluation modules with explicit assumptions and uncertainty", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop clinical-evaluation acceptance");
    await page.goto("/");

    const cases = [
      { button: /^Funnel/, type: "Funnel", element: "funnel-study", minimum: 7 },
      { button: /^Precision–recall/, type: "Precision–recall", element: "pr-curve", minimum: 2 },
      { button: /^Calibration/, type: "Calibration", element: "calibration-series", minimum: 2 },
      { button: /^Decision curve/, type: "Decision curve", element: "decision-curve", minimum: 2 },
      { button: /^Nomogram/, type: "Nomogram", element: "nomogram-point", minimum: 8 },
      { button: /^LASSO path/, type: "LASSO path", element: "lasso-path", minimum: 3 },
      { button: /^Cutoff KM/, type: "Cutoff KM", element: "cutoff-km", minimum: 2 },
      { button: /^Risk-score panel/, type: "Risk-score panel", element: "risk-subject", minimum: 10 },
    ];
    for (const entry of cases) {
      await page.getByRole("button", { name: entry.button }).click();
      await expect(page.getByText("Ready", { exact: true })).toBeVisible();
      const svg = page.locator(`svg[aria-label='${entry.type} scientific figure preview']`);
      expect(await svg.locator(`[data-plot-element='${entry.element}']`).count()).toBeGreaterThanOrEqual(entry.minimum);
      expect(await svg.innerHTML()).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
      const outside = await svg.evaluate((element) => { const canvas = element.getBoundingClientRect(); return [...element.querySelectorAll<SVGGraphicsElement>("text, [data-plot-element]")].filter((mark) => { const box = mark.getBoundingClientRect(); return box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1; }).length; });
      expect(outside, entry.type).toBe(0);
    }

    await page.getByRole("button", { name: /^Cutoff KM/ }).click();
    const cutoffKm = page.locator("svg[aria-label='Cutoff KM scientific figure preview']");
    await expect(cutoffKm.locator("[data-step-curve='right-continuous']")).toHaveCount(2);
    expect(await cutoffKm.locator("[data-step-curve='right-continuous']").first().getAttribute("d")).toMatch(/^M [\d.]+ [\d.]+(?: H [\d.]+ V [\d.]+)+$/);
    expect(await cutoffKm.locator("[data-plot-element='cutoff-km-censor']").count()).toBeGreaterThan(0);
    await expect(cutoffKm.locator("[data-plot-element='cutoff-km-censor'] title").first()).toContainText(/censored at time/);

    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("sample\tscore\ttime\tevent\tcutoff\nL0\t0.1\t0\t0\t0.5\nL1\t0.2\t8\t0\t0.5\nL2\t0.3\t4\t1\t0.5\nH0\t0.7\t0\t0\t0.5\nH1\t0.8\t8\t0\t0.5\nH2\t0.9\t5\t1\t0.5");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const censorBounds = await cutoffKm.evaluate((element) => {
      const svg = element as SVGSVGElement; const canvas = svg.getBoundingClientRect();
      return [...svg.querySelectorAll<SVGGElement>("[data-plot-element='cutoff-km-censor']")].map((mark) => { const box = mark.getBoundingClientRect(); const horizontal = mark.querySelector<SVGLineElement>("line")!; return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, canvasLeft: canvas.left, canvasRight: canvas.right, canvasTop: canvas.top, canvasBottom: canvas.bottom, clip: getComputedStyle(horizontal).clipPath, anchorX: Number(mark.dataset.censorTimeX), lineCenterX: (Number(horizontal.getAttribute("x1")) + Number(horizontal.getAttribute("x2"))) / 2 }; });
    });
    expect(censorBounds.length).toBeGreaterThanOrEqual(4);
    expect(censorBounds.every((box) => box.left >= box.canvasLeft - 0.5 && box.right <= box.canvasRight + 0.5 && box.top >= box.canvasTop - 0.5 && box.bottom <= box.canvasBottom + 0.5 && box.clip === "none" && Math.abs(box.anchorX - box.lineCenterX) < 1e-6), JSON.stringify(censorBounds)).toBe(true);

    await page.getByRole("button", { name: /^Precision–recall/ }).click();
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("sample\ttruth\tscore\tmodel\nS1\t1\t0.9\tExtremely long externally validated integrated clinical molecular model\nS2\t0\t0.2\tExtremely long externally validated integrated clinical molecular model\nS3\t1\t0.8\tSecond exceptionally long independent prediction model identity\nS4\t0\t0.1\tSecond exceptionally long independent prediction model identity");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const precisionRecall = page.locator("svg[aria-label='Precision–recall scientific figure preview']");
    await expect(precisionRecall.locator("text[data-full-label]").first()).toContainText("…");
    const escapedModelLabels = await precisionRecall.evaluate((element) => { const canvas = element.getBoundingClientRect(); return [...element.querySelectorAll<SVGTextElement>("text[data-full-label]")].filter((label) => { const box = label.getBoundingClientRect(); return box.left < canvas.left - 1 || box.right > canvas.right + 1; }).length; });
    expect(escapedModelLabels).toBe(0);

    await page.getByRole("button", { name: /^LASSO path/ }).click();
    const lassoRows = ["lambda\tcoefficient\tfeature", ...Array.from({ length: 12 }, (_, feature) => [1, 0.1].map((lambda, point) => `${lambda}\t${(feature + 1) * (point + 1) / 20}\t宽字符临床分子特征名称 ${String(feature + 1).padStart(2, "0")} extraordinarily long suffix`).join("\n"))].join("\n");
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(lassoRows);
    const legendSize = page.getByRole("textbox", { name: "Legend size value" });
    await legendSize.fill("16"); await legendSize.press("Enter");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const lasso = page.locator("svg[aria-label='LASSO path scientific figure preview']");
    const lassoLayout = await lasso.evaluate((element) => { const canvas = element.getBoundingClientRect(); const labels = [...element.querySelectorAll<SVGTextElement>("text[data-full-label]")].map((label) => label.getBoundingClientRect()).sort((a, b) => a.top - b.top); return { collisions: labels.filter((label, index) => index > 0 && label.top < labels[index - 1].bottom - 0.5).length, escaped: labels.filter((label) => label.left < canvas.left - 0.5 || label.right > canvas.right + 0.5).length }; });
    expect(lassoLayout).toEqual({ collisions: 0, escaped: 0 });

    await page.getByRole("button", { name: /^Nomogram/ }).click();
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("predictor\tlevel\tpoints\nStage\tNearly identical level alpha\t10\nStage\tNearly identical level beta\t10.1");
    await expect(page.getByText(/overlap within predictor/)).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("predictor\tlevel\tpoints\nStage\tVery long zero-point boundary label\t0\nStage\tMiddle\t50\nBiomarker\tVery long maximum boundary label\t100\nBiomarker\tQuarter\t25");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const nomogram = page.locator("svg[aria-label='Nomogram scientific figure preview']");
    const nomogramEscapes = await nomogram.evaluate((element) => { const svg = element as SVGSVGElement; const clip = svg.querySelector<SVGRectElement>("clipPath rect")!; const left = Number(clip.getAttribute("x")); const right = left + Number(clip.getAttribute("width")); return [...svg.querySelectorAll<SVGTextElement>("text[data-full-label]")].filter((label) => { if (["Stage", "Biomarker"].includes(label.dataset.fullLabel ?? "")) return false; const box = label.getBBox(); return box.x < left - 0.5 || box.x + box.width > right + 0.5; }).length; });
    expect(nomogramEscapes).toBe(0);

    await page.getByRole("button", { name: /^ROC/ }).click();
    await page.getByRole("button", { name: /Example 2.*Time-dependent/ }).click();
    await expect(page.getByRole("combobox", { name: "Input structure" })).toHaveValue("precomputed-time");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const roc = page.locator("svg[aria-label='ROC scientific figure preview']");
    await expect(roc.locator("[data-plot-element='time-dependent-roc']")).toHaveCount(4);
    await expect(roc.locator("[data-auc-interval]")).toHaveCount(4);
    await expect(roc.locator("[data-auc-interval]").first()).toContainText(/AUC.*\[.*–.*\]/);

    await page.getByRole("button", { name: /^Decision curve/ }).click();
    await page.getByRole("textbox", { name: "Minimum threshold value" }).fill("0.01");
    await page.getByRole("textbox", { name: "Minimum threshold value" }).press("Enter");
    await page.getByRole("textbox", { name: "Grid resolution value" }).fill("0.01");
    await page.getByRole("textbox", { name: "Grid resolution value" }).press("Enter");
    const decisionSvg = page.locator("svg[aria-label='Decision curve scientific figure preview']");
    await expect(decisionSvg.locator("[data-plot-element='decision-threshold-grid']")).toContainText("Grid 0.010–0.800 · Δ 0.010");
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("truth\tscore\tmodel\n1\t1.2\tModel\n0\t0.2\tModel");
    await expect(page.getByText(/Predicted probability contains 1 value outside \[0, 1\]/)).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();
  });

  test("renders enrichment and specialized scientific views with explicit quantitative limits", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop enrichment-specialized acceptance");
    await page.goto("/");
    const cases = [
      { button: /^GO circle/, type: "GO circle", element: "enrichment-circle-term", minimum: 8 },
      { button: /^KEGG circle/, type: "KEGG circle", element: "enrichment-circle-term", minimum: 6 },
      { button: /^GO chord/, type: "GO chord", element: "go-chord-link", minimum: 10 },
      { button: /^Pathway impact/, type: "Pathway impact", element: "pathway-impact", minimum: 6 },
      { button: /^NES \/ FDR summary/, type: "NES / FDR summary", element: "nes-fdr", minimum: 7 },
      { button: /^Multi-GSEA/, type: "Multi-GSEA", element: "multi-gsea-series", minimum: 3 },
      { button: /^Enrichment ridge/, type: "Enrichment ridge", element: "enrichment-ridge", minimum: 5 },
      { button: /^Relationship ribbon–bubble/, type: "Relationship ribbon–bubble", element: "sankey-bubble-term", minimum: 7 },
      { button: /^Geographic point map/, type: "Geographic point map", element: "geographic-site", minimum: 8 },
      { button: /^Petal/, type: "Petal", element: "petal", minimum: 8 },
      { button: /^Word cloud/, type: "Word cloud", element: "word-cloud-term", minimum: 12 },
    ];
    for (const entry of cases) {
      await page.getByRole("button", { name: entry.button }).click();
      await expect(page.getByText("Ready", { exact: true })).toBeVisible();
      const svg = page.locator(`svg[aria-label='${entry.type} scientific figure preview']`);
      expect(await svg.locator(`[data-plot-element='${entry.element}']`).count(), entry.type).toBeGreaterThanOrEqual(entry.minimum);
      expect(await svg.innerHTML()).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
      const escaped = await svg.evaluate((element) => { const canvas = element.getBoundingClientRect(); return [...element.querySelectorAll<SVGGraphicsElement>("text, [data-plot-element]")].filter((mark) => { const box = mark.getBoundingClientRect(); return box.width > 0 && box.height > 0 && (box.left < canvas.left - 1 || box.top < canvas.top - 1 || box.right > canvas.right + 1 || box.bottom > canvas.bottom + 1); }).length; });
      expect(escaped, entry.type).toBe(0);
      await expect(page.getByRole("button", { name: "SVG" })).toBeEnabled();
    }
    await page.getByRole("button", { name: /^Multi-GSEA/ }).click();
    const gsea = page.locator("svg[aria-label='Multi-GSEA scientific figure preview']");
    expect(await gsea.locator("[data-plot-element='multi-gsea-hit']").count()).toBeGreaterThanOrEqual(27);
    await expect(gsea.locator("text[data-full-label]").first()).toContainText(/NES.*FDR/);
    for (const footerCase of [{ name: /^Multi-GSEA/, type: "Multi-GSEA" }, { name: /^Enrichment ridge/, type: "Enrichment ridge" }]) {
      await page.getByRole("button", { name: footerCase.name }).click();
      await page.getByRole("textbox", { name: "Tick size value", exact: true }).fill("16");
      await page.getByRole("textbox", { name: "Tick size value", exact: true }).press("Enter");
      if (footerCase.type === "Multi-GSEA") {
        await page.getByRole("textbox", { name: "Legend size value", exact: true }).fill("16");
        await page.getByRole("textbox", { name: "Legend size value", exact: true }).press("Enter");
      }
      await expect(page.getByText("Ready", { exact: true })).toBeVisible();
      const footerDoesNotOverlap = await page.locator(`svg[aria-label='${footerCase.type} scientific figure preview']`).evaluate((element) => {
        const note = element.querySelector<SVGGraphicsElement>("[data-plot-element='method-note']");
        const xLabel = element.querySelector<SVGGraphicsElement>("[data-specialized-x-label]");
        if (!note || !xLabel) return false;
        const noteBox = note.getBBox(); const labelBox = xLabel.getBBox();
        return noteBox.y + noteBox.height + 2 <= labelBox.y;
      });
      expect(footerDoesNotOverlap).toBe(true);
    }

    await page.getByRole("button", { name: /^GO circle/ }).click();
    await expect(page.getByLabel("1 · BP")).toBeVisible();
    await expect(page.getByLabel("2 · CC")).toBeVisible();
    await expect(page.getByLabel("3 · MF")).toBeVisible();
    await expect(page.getByLabel("Sequential low")).toBeVisible();
    await expect(page.locator("[data-plot-element='enrichment-group-sector']")).toHaveCount(3);
    await expect(page.locator("[data-plot-element='fdr-scale']")).toBeVisible();
    const fdrOutsidePlot = await page.locator("svg[aria-label='GO circle scientific figure preview']").evaluate((element) => {
      const clip = element.querySelector<SVGRectElement>("clipPath rect"); const legend = element.querySelector<SVGGraphicsElement>("[data-plot-element='fdr-scale']");
      if (!clip || !legend) return false;
      const plotBottom = Number(clip.getAttribute("y")) + Number(clip.getAttribute("height"));
      return legend.getBBox().y >= plotBottom + 1;
    });
    expect(fdrOutsidePlot).toBe(true);
    const circleFooterSafe = await page.locator("svg[aria-label='GO circle scientific figure preview']").evaluate((element) => {
      const selectors = ["[data-plot-element='enrichment-group-legend']", "[data-plot-element='fdr-scale']", "[data-plot-element='size-scale']", "[data-plot-element='method-note']"];
      const boxes = selectors.map((selector) => element.querySelector<SVGGraphicsElement>(selector)?.getBBox()).filter((box): box is DOMRect => Boolean(box));
      const canvas = (element as SVGSVGElement).viewBox.baseVal;
      const inside = boxes.every((box) => box.x >= -0.5 && box.y >= -0.5 && box.x + box.width <= canvas.width + 0.5 && box.y + box.height <= canvas.height + 0.5);
      const separate = boxes.every((box, index) => boxes.slice(index + 1).every((other) => box.x + box.width <= other.x + 0.5 || other.x + other.width <= box.x + 0.5 || box.y + box.height <= other.y + 0.5 || other.y + other.height <= box.y + 0.5));
      return boxes.length === selectors.length && inside && separate;
    });
    expect(circleFooterSafe).toBe(true);

    await page.getByRole("button", { name: /^Pathway impact/ }).click();
    await page.getByRole("textbox", { name: "Point size value", exact: true }).fill("12");
    await page.getByRole("textbox", { name: "Point size value", exact: true }).press("Enter");
    await page.getByRole("textbox", { name: "Tick size value", exact: true }).fill("16");
    await page.getByRole("textbox", { name: "Tick size value", exact: true }).press("Enter");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const pathwayFooterSafe = await page.locator("svg[aria-label='Pathway impact scientific figure preview']").evaluate((element) => {
      const size = element.querySelector<SVGGraphicsElement>("[data-plot-element='size-scale']")?.getBBox();
      const fdr = element.querySelector<SVGGraphicsElement>("[data-plot-element='fdr-scale']")?.getBBox();
      const clip = element.querySelector<SVGRectElement>("clipPath rect");
      if (!size || !fdr || !clip) return false;
      const plotBottom = Number(clip.getAttribute("y")) + Number(clip.getAttribute("height"));
      const boxes = [...element.querySelectorAll<SVGGraphicsElement>("text")].map((text) => ({ text: text.textContent, box: text.getBBox() })).filter(({ box }) => box.y >= plotBottom - 0.5 && box.width > 0 && box.height > 0);
      const textsSeparate = boxes.every(({ box }, index) => boxes.slice(index + 1).every(({ box: other }) => box.x + box.width <= other.x + 0.5 || other.x + other.width <= box.x + 0.5 || box.y + box.height <= other.y + 0.5 || other.y + other.height <= box.y + 0.5));
      const scalesSeparate = size.x + size.width <= fdr.x - 1 || fdr.x + fdr.width <= size.x - 1 || size.y + size.height <= fdr.y - 1 || fdr.y + fdr.height <= size.y - 1;
      return textsSeparate && scalesSeparate && Boolean(element.querySelector("[data-plot-element='category-footer-legend']"));
    });
    expect(pathwayFooterSafe).toBe(true);

    await page.getByRole("button", { name: /^GO chord/ }).click();
    const chordFooterSafe = await page.locator("svg[aria-label='GO chord scientific figure preview']").evaluate((element) => {
      const selectors = ["[data-plot-element='go-chord-effect-legend']", "[data-plot-element='category-footer-legend']", "[data-plot-element='method-note']"];
      const boxes = selectors.map((selector) => element.querySelector<SVGGraphicsElement>(selector)?.getBBox()).filter((box): box is DOMRect => Boolean(box));
      return boxes.length === selectors.length && boxes.every((box, index) => boxes.slice(index + 1).every((other) => box.x + box.width <= other.x + 0.5 || other.x + other.width <= box.x + 0.5 || box.y + box.height <= other.y + 0.5 || other.y + other.height <= box.y + 0.5));
    });
    expect(chordFooterSafe).toBe(true);

    await page.getByRole("button", { name: /^Geographic point map/ }).click();
    await page.getByRole("textbox", { name: "Tick size value", exact: true }).fill("11");
    await page.getByRole("textbox", { name: "Tick size value", exact: true }).press("Enter");
    await page.getByRole("checkbox", { name: "Labels" }).check({ force: true });
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("site\tlatitude\tlongitude\tvalue\tgroup\nNorthEastEdge\t90\t180\t10\tA\nSouthWestEdge\t-90\t-180\t8\tB\nNorthWestEdge\t90\t-180\t6\tA\nSouthEastEdge\t-90\t180\t4\tB");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const map = page.locator("svg[aria-label='Geographic point map scientific figure preview']");
    const mapBoundsSafe = await map.evaluate((element) => {
      const plot = element.querySelector<SVGRectElement>("[data-plot-family='geographic-map'] > rect");
      if (!plot) return false;
      const left = Number(plot.getAttribute("x")); const top = Number(plot.getAttribute("y"));
      const right = left + Number(plot.getAttribute("width")); const bottom = top + Number(plot.getAttribute("height"));
      const marksSafe = [...element.querySelectorAll<SVGCircleElement>("[data-plot-element='geographic-site'] circle")].every((circle) => {
        const cx = Number(circle.getAttribute("cx")); const cy = Number(circle.getAttribute("cy")); const radius = Number(circle.getAttribute("r"));
        return cx - radius >= left && cx + radius <= right && cy - radius >= top && cy + radius <= bottom;
      });
      const labelsSafe = [...element.querySelectorAll<SVGGraphicsElement>("[data-plot-element='geographic-site'] text")].every((label) => { const box = label.getBBox(); return box.x >= left - 0.5 && box.x + box.width <= right + 0.5 && box.y >= top - 0.5 && box.y + box.height <= bottom + 0.5; });
      return marksSafe && labelsSafe;
    });
    expect(mapBoundsSafe).toBe(true);
    const mapFooterSafe = await map.evaluate((element) => {
      const selectors = ["[data-plot-element='category-footer-legend']", "[data-plot-element='size-scale']", "[data-plot-element='method-note']"];
      const boxes = selectors.map((selector) => element.querySelector<SVGGraphicsElement>(selector)?.getBBox()).filter((box): box is DOMRect => Boolean(box));
      const canvas = (element as SVGSVGElement).viewBox.baseVal;
      const inside = boxes.every((box) => box.x >= -0.5 && box.y >= -0.5 && box.x + box.width <= canvas.width + 0.5 && box.y + box.height <= canvas.height + 0.5);
      const separate = boxes.every((box, index) => boxes.slice(index + 1).every((other) => box.x + box.width <= other.x + 0.5 || other.x + other.width <= box.x + 0.5 || box.y + box.height <= other.y + 0.5 || other.y + other.height <= box.y + 0.5));
      return boxes.length === selectors.length && inside && separate;
    });
    expect(mapFooterSafe).toBe(true);

    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("site\tlatitude\tlongitude\tvalue\tgroup\nSite one\t30\t120\t10\tA\nSite two\t30\t120\t9\tB\nSite three\t30\t120\t8\tA\nSite four\t30\t120\t7\tB\nSite five\t30\t120\t6\tA");
    await expect(page.getByText(/overlapping point pair/)).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();
    const manyGroups = Array.from({ length: 13 }, (_, index) => `Site${index}\t${-60 + index * 10}\t${-150 + index * 24}\t${index + 1}\tGroup${index}`).join("\n");
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill(`site\tlatitude\tlongitude\tvalue\tgroup\n${manyGroups}`);
    await expect(page.getByText(/group legend needs .* footer rows/)).toBeVisible();
    await expect(page.getByRole("button", { name: "SVG" })).toBeDisabled();

    await page.getByRole("button", { name: /^Petal/ }).click();
    await page.getByRole("checkbox", { name: "Labels" }).check({ force: true });
    await page.getByRole("textbox", { name: "CSV or TSV data" }).fill("category\tvalue\nA very long category on the right\t8\nA long category at the bottom\t7\nA very long category on the left\t6\nA long category at the top\t5");
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    const petalLabelsInside = await page.locator("svg[aria-label='Petal scientific figure preview']").evaluate((element) => {
      const clip = element.querySelector<SVGRectElement>("clipPath rect"); if (!clip) return false;
      const left = Number(clip.getAttribute("x")); const top = Number(clip.getAttribute("y")); const right = left + Number(clip.getAttribute("width")); const bottom = top + Number(clip.getAttribute("height"));
      return [...element.querySelectorAll<SVGGraphicsElement>("[data-plot-element='petal'] text")].every((label) => { const box = label.getBBox(); return box.x >= left - 0.5 && box.x + box.width <= right + 0.5 && box.y >= top - 0.5 && box.y + box.height <= bottom + 0.5; });
    });
    expect(petalLabelsInside).toBe(true);
  });
});
