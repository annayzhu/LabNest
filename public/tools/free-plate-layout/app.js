(function startPlateLayoutStudio() {
  "use strict";

  const Core = window.PlateCore;
  if (!Core) throw new Error("PlateCore failed to load.");
  const Color = window.ColorCore;
  if (!Color) throw new Error("ColorCore failed to load.");
  const Liquid = window.LiquidCore;
  if (!Liquid) throw new Error("LiquidCore failed to load.");
  const LiquidPlan = window.LiquidPlanCore;
  if (!LiquidPlan) throw new Error("LiquidPlanCore failed to load.");
  const Workspace = window.WorkspaceCore;
  if (!Workspace) throw new Error("WorkspaceCore failed to load.");
  const Xlsx = window.XlsxCore;
  if (!Xlsx) throw new Error("XlsxCore failed to load.");

  const STORAGE_KEY = "plate-layout-studio:project:v1";
  const WORKSPACE_STORAGE_KEY = "plate-layout-studio:workspace:v2";
  const WORKSPACE_DB_NAME = "plate-layout-studio";
  const WORKSPACE_DB_STORE = "workspaces";
  const LANGUAGE_KEY = "plate-layout-studio:language";
  const RECIPE_LIBRARY_KEY = "plate-layout-studio:liquid-recipes:v1";
  const BUILTIN_LIQUID_RECIPES = Object.freeze([
    { id: "builtin-rnai", builtIn: true, module: "transfection", name: "RNAiMAX + siRNA", input: { preset: "rnai", direction: "forward", stockConcentration: "10", stockUnit: "µM", targetValue: "10", targetUnit: "nM", overagePercent: "10" } },
    { id: "builtin-lipo3000", builtIn: true, module: "transfection", name: "Lipofectamine 3000 + plasmid", input: { preset: "lipo3000", direction: "forward", stockConcentration: "500", stockUnit: "ng/µL", targetValue: "2500", targetUnit: "ng", p3000PerUg: "2", overagePercent: "10" } },
    { id: "builtin-c1v1", builtIn: true, module: "basic", name: "C1V1 stock dilution", input: { calculationType: "dilution", kind: "molar", volumeMode: "total", overagePercent: "10" } },
  ]);
  const I18N = {
    zh: {
      heroTitle: "自由板布局", heroBody: "点选、框选或 Shift 连选孔位，叠加参数维度并批量计算；数据仅保存在本机。",
      selectionHelp: "单击单选，Ctrl/⌘ 单击逐个增减，拖动框选，Shift 单击连选；单击空白处取消选择。", selectAll: "全选", invert: "反选", deselect: "取消选择", clearWells: "清空所选孔",
      colorBy: "按参数着色", backup: "备份项目", excelTemplate: "当前板 CSV 模板", import: "导入孔板表格", confirmImport: "确认导入", confirmDelete: "确认删除", print: "打印 / PDF", dimensionsTitle: "参数维度", dimensionsBody: "定义实验标签，再应用到当前选择。",
      newDimension: "新维度名称", newDimensionPlaceholder: "例如：细胞系、药物、批次", type: "类型", add: "＋ 添加", assignTitle: "为所选孔赋值",
      assignBody: "可输入单个值，也可直接粘贴 Excel 多个值；只应用已勾选项。", applySelected: "应用到所选孔", clearChecked: "清除勾选参数",
      calculationTitle: "条件批量计算", calculationBody: "按孔位标签筛选，对数值参数统一运算。", runCalculation: "运行批量计算",
      liquidTitle: "配液计算", liquidBody: "从当前孔板取孔数，完成常规配液、转染、梯度稀释和药物排板。",
      footerLocal: "所有编辑与计算均在当前浏览器完成。", footerReview: "研究工具 · 请在实验前复核最终板图和参数。",
      localOnly: "仅保存在本机", autosaved: "已自动保存", selectedCount: "已选 {n} 孔", wellsCount: "{n} 孔", emptyWell: "空孔",
      expand: "展开", collapse: "收起", text: "文本", number: "数值", unit: "单位", noColor: "不着色", noFilter: "不筛选", noNumeric: "没有数值维度",
      defaultProject: "未命名孔板", plate: "孔", confirmClear: "再次点击确认 ({n} 孔)", undoDone: "已撤销上一步修改", redoDone: "已恢复修改",
      summarySelect: "选择一个孔位后，这里会展示该孔当前已经设置的全部参数。", currentWell: "当前孔位 {id}", assignedInfo: "已赋值信息",
      selectedWells: "已选择 {n} 个孔", overview: "共同值与差异概览", multipleValues: "多个值", noParameters: "当前孔还没有设置任何参数。", items: "{n} 项",
      editorEmpty: "先在左侧点选或框选圆孔，再为它们批量设置参数。", inputValue: "输入单值或粘贴多值", overwriteValues: "输入单值覆盖，或粘贴多值", pasteValuesHint: "可输入单个值，或直接粘贴 Excel 的多行/多列值",
      legendNone: "当前未按参数着色", legendEmpty: "为孔位设置参数后，这里会出现颜色图例",
      note384: "384 孔模式仅在孔内显示孔号；点选任意孔可查看全部已赋值信息。", note96: "孔内按参数维度顺序显示前 3 条已赋值信息；点选孔位可查看全部。", noteDefault: "孔内按参数维度顺序显示前 3 条已赋值信息；点选孔位可查看全部。",
      defaultNames: { sample: "样本", treatment: "处理", dose: "剂量", timepoint: "时间点", replicate: "重复", value: "原始值" },
    },
    en: {
      heroTitle: "Free Plate Layout", heroBody: "Select wells, add parameter dimensions, and run batch calculations. All data stays in this browser.",
      selectionHelp: "Click for a single well, Ctrl/⌘-click to add or remove wells, drag to box-select, or Shift-click for a range. Click empty space to deselect.", selectAll: "All", invert: "Invert", deselect: "Deselect", clearWells: "Clear wells",
      colorBy: "Color by parameter", backup: "Back up project", excelTemplate: "Current plate CSV template", import: "Import plate tables", confirmImport: "Confirm import", confirmDelete: "Confirm delete", print: "Print / PDF", dimensionsTitle: "Parameters", dimensionsBody: "Define experimental labels and apply them to selected wells.",
      newDimension: "New parameter", newDimensionPlaceholder: "e.g. Cell line, drug, batch", type: "Type", add: "+ Add", assignTitle: "Assign selected wells",
      assignBody: "Enter one value or paste multiple values from Excel. Only checked parameters are applied.", applySelected: "Apply to wells", clearChecked: "Clear checked",
      calculationTitle: "Batch calculation", calculationBody: "Filter wells by labels and calculate numeric parameters.", runCalculation: "Run calculation",
      liquidTitle: "Liquid preparation", liquidBody: "Use the current plate scope for routine solutions, transfection mixes, serial dilutions, and drug layouts.",
      footerLocal: "All edits and calculations run in this browser.", footerReview: "Research tool · Review the final plate and parameters before use.",
      localOnly: "Stored locally", autosaved: "Autosaved", selectedCount: "{n} selected", wellsCount: "{n} wells", emptyWell: "Empty well",
      expand: "Expand", collapse: "Collapse", text: "Text", number: "Number", unit: "Unit", noColor: "No color", noFilter: "No filter", noNumeric: "No numeric parameters",
      defaultProject: "Untitled plate", plate: "well", confirmClear: "Click again to clear ({n})", undoDone: "Last edit undone", redoDone: "Edit restored",
      summarySelect: "Select a well to view all parameters currently assigned to it.", currentWell: "Current well {id}", assignedInfo: "Assigned parameters",
      selectedWells: "{n} wells selected", overview: "Shared and mixed values", multipleValues: "Mixed values", noParameters: "This well has no assigned parameters.", items: "{n} items",
      editorEmpty: "Select or box-select wells on the left, then assign parameters in bulk.", inputValue: "Enter one or paste multiple", overwriteValues: "Type one to overwrite, or paste multiple", pasteValuesHint: "Enter one value, or paste multiple rows/columns directly from Excel",
      legendNone: "No color parameter selected", legendEmpty: "Color categories appear here after parameters are assigned.",
      note384: "384-well mode shows well IDs only. Select a well to view all assigned parameters.", note96: "Wells show the first three assigned values in parameter order. Select a well for full details.", noteDefault: "Wells show the first three assigned values in parameter order. Select a well for full details.",
      defaultNames: { sample: "Sample", treatment: "Treatment", dose: "Dose", timepoint: "Time point", replicate: "Replicate", value: "Raw value" },
    },
  };
  let language = localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "zh";
  function t(key, variables = {}) {
    const value = I18N[language][key] ?? I18N.zh[key] ?? key;
    return typeof value === "string" ? value.replace(/\{(\w+)\}/g, (_, name) => variables[name] ?? "") : value;
  }
  const bilingual = (zh, en) => language === "en" ? en : zh;
  const MAX_HISTORY = 50;
  const DEFAULT_DIMENSIONS = [
    { id: "sample", name: "样本", type: "text" },
    { id: "treatment", name: "处理", type: "text" },
    { id: "dose", name: "剂量", type: "number" },
    { id: "timepoint", name: "时间点", type: "text" },
    { id: "replicate", name: "重复", type: "number" },
    { id: "value", name: "原始值", type: "number" },
  ];
  const elements = Object.fromEntries(
    [
      "projectName", "saveStatus", "undoButton", "redoButton", "selectionCount",
      "selectAllButton", "invertSelectionButton", "clearSelectionButton", "clearWellsButton",
      "colorDimension", "plateCanvas", "plateGrid", "selectionBox", "plateLegend", "wellDisplayNote",
      "dimensionCount", "addDimensionForm", "newDimensionName", "newDimensionType", "dimensionList",
      "selectedWellSummary", "editorSelectionCount", "selectionEditor", "applyParametersButton", "clearParametersButton",
      "calcScope", "calcConditionDimension", "calcConditionValue", "conditionValueSuggestions",
      "calcSource", "calcOperation", "operandMode", "constantOperandWrap", "constantOperand",
      "parameterOperandWrap", "parameterOperand", "calcOutputName", "calcPrecision",
      "calculationGuide", "runCalculationButton", "calculationResult", "calculationOutputCount", "calculationOutputList", "exportCsvButton", "exportSvgButton",
      "exportJsonButton", "exportXlsxButton", "xlsxOrderSelect", "excelTemplateButton", "projectTemplateButton", "openProjectImportButton", "openBackupRestoreButton", "importJsonLabel", "importJsonInput", "importModeSelect", "confirmImportButton", "importPreview", "restoreJsonLabel", "restoreJsonInput", "restorePreview", "confirmRestoreButton", "projectFileDialog", "projectFileDialogTitle", "projectFileDialogHelp", "projectImportPanel", "projectRestorePanel", "closeProjectFileDialogButton", "printButton",
      "workspaceName", "workspaceNameLabel", "plateTabs", "addPlateButton", "duplicatePlateButton", "copyStructureButton", "movePlateLeftButton", "movePlateRightButton", "deletePlateButton", "overviewToggleButton", "plateOverview", "plateOverviewTitle", "plateOverviewDescription", "overviewColorLabel", "overviewColorDimension", "plateOverviewGrid", "exportXlsxButton",
      "liquidScopeBadge", "openLiquidCalculatorButton", "projectLiquidScope", "projectLiquidOverage", "projectLiquidContainerCapacity", "projectLiquidSummaryButton", "projectLiquidPlatePicker", "projectLiquidSummary", "liquidDrawer", "closeLiquidDrawerButton", "liquidDrawerScope", "liquidModuleTabs", "liquidDrawerContent", "toast",
      "savedLiquidPlansTitle", "savedLiquidPlansHelp", "savedLiquidPlanCount", "savedLiquidPlanList", "summaryDrawer", "summaryDrawerTitle", "summaryDrawerMeta", "summaryDrawerActions", "summaryDrawerContent", "closeSummaryDrawerButton",
    ].map((id) => [id, document.getElementById(id)]),
  );

  let workspace = loadWorkspace();
  let project = Workspace.activePlate(workspace);
  let selection = new Set();
  let selectionAnchor = null;
  const plateHistories = new Map();
  let workspaceUndoStack = [];
  let workspaceRedoStack = [];
  let pointerSession = null;
  let toastTimer = null;
  let colorRegistryCache = new Map();
  let editingLiquidPlanId = null;
  let pendingLiquidPlanDeleteId = null;
  let liquidPlanDeleteTimer = null;
  let clearConfirmationTimer = null;
  let dimensionDeleteTimer = null;
  let pendingDimensionDeleteId = null;
  let importConfirmationTimer = null;
  let pendingImportedProject = null;
  let pendingRestoredWorkspace = null;
  let pendingBatchPaste = null;
  let calculationDeleteTimer = null;
  let pendingCalculationDeleteId = null;
  let plateDeleteTimer = null;
  let overviewOpen = false;
  let overviewColorName = "";
  let indexedSaveTimer = null;
  let activeLiquidModule = "basic";
  let lastLiquidResult = null;
  let pendingDrugLayout = null;
  let pendingSerialLayout = null;
  const liquidDrafts = Object.create(null);

  function applyLanguage() {
    const wasAutosaved = elements.saveStatus.textContent === I18N.zh.autosaved || elements.saveStatus.textContent === I18N.en.autosaved;
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    document.title = language === "en" ? "Plate Layout Planner" : "Plate Layout Planner · 孔板布局规划工具";
    document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
    document.querySelectorAll(".language-option").forEach((button) => button.classList.toggle("active", button.dataset.language === language));
    document.querySelector(".brand small").textContent = language === "en" ? "Plate planning workspace" : "孔板布局规划工具";
    elements.saveStatus.textContent = t(wasAutosaved ? "autosaved" : "localOnly");
    elements.projectName.placeholder = t("defaultProject");
    elements.confirmImportButton.textContent = t("confirmImport");
    elements.excelTemplateButton.title = bilingual("下载当前板 CSV 模板", "Download a CSV template for the current plate");
    elements.projectTemplateButton.title = bilingual("下载包含说明和全部当前孔板的 XLSX 模板", "Download an XLSX template with instructions and all current plates");
    elements.exportXlsxButton.textContent = bilingual("导出项目 XLSX", "Export project XLSX");
    elements.openProjectImportButton.textContent = bilingual("导入孔板表格", "Import plate tables");
    elements.exportJsonButton.textContent = bilingual("备份项目", "Back up project");
    elements.openBackupRestoreButton.textContent = bilingual("恢复项目备份", "Restore project backup");
    document.querySelector(".workspace-export-label").textContent = bilingual("项目文件", "Project files");
    elements.projectTemplateButton.textContent = bilingual("当前项目 Excel 模板", "Current project Excel template");
    elements.excelTemplateButton.textContent = bilingual("当前板 CSV 模板", "Current plate CSV template");
    elements.importJsonLabel.querySelector("span").textContent = bilingual("选择 XLSX / CSV / TSV", "Choose XLSX / CSV / TSV");
    elements.restoreJsonLabel.querySelector("span").textContent = bilingual("选择项目备份 JSON", "Choose project backup JSON");
    elements.confirmRestoreButton.textContent = bilingual("确认替换当前项目", "Confirm project replacement");
    elements.undoButton.title = language === "en" ? "Undo (Ctrl/⌘ Z)" : "撤销（Ctrl/⌘ Z）";
    elements.redoButton.title = language === "en" ? "Redo (Ctrl/⌘ Shift Z)" : "重做（Ctrl/⌘ Shift Z）";
    document.querySelectorAll(".plate-option").forEach((button) => { button.textContent = `${button.dataset.size} ${t("plate")}`; });
    document.querySelectorAll(".collapse-toggle").forEach((toggle) => {
      toggle.dataset.openLabel = t("collapse");
      toggle.dataset.closedLabel = t("expand");
    });
    const staticLabels = language === "en"
      ? ["Which wells to calculate", "Only calculate this category (optional)", "Label value must equal", "Value to calculate", "Calculation", "What number to use", "Enter this number", "Choose another numeric parameter", "Save result as", "Result decimal places"]
      : ["要计算哪些孔", "只计算哪一类孔（可选）", "标签值必须等于", "要计算的数值", "计算方式", "用什么数参与计算", "输入这个数", "选择另一个数值参数", "结果保存为", "结果保留小数位"];
    [elements.calcScope, elements.calcConditionDimension, elements.calcConditionValue, elements.calcSource, elements.calcOperation, elements.operandMode, elements.constantOperand, elements.parameterOperand, elements.calcOutputName, elements.calcPrecision]
      .forEach((control, index) => { control.closest("label").querySelector(":scope > span").textContent = staticLabels[index]; });
    elements.calcScope.options[0].textContent = language === "en" ? "Currently selected wells" : "当前选中的孔";
    elements.calcScope.options[1].textContent = language === "en" ? "All wells on this plate" : "当前板所有孔";
    const operationLabels = language === "en" ? ["× Multiply", "÷ Divide", "+ Add", "- Subtract"] : ["× 乘以", "÷ 除以", "＋ 加上", "－ 减去"];
    [...elements.calcOperation.options].forEach((option, index) => { option.textContent = operationLabels[index]; });
    elements.operandMode.options[0].textContent = language === "en" ? "Enter one fixed number" : "输入一个固定数";
    elements.operandMode.options[1].textContent = language === "en" ? "Use another value from each well" : "使用孔内另一个参数";
    elements.newDimensionType.options[0].textContent = t("text");
    elements.newDimensionType.options[1].textContent = t("number");
    elements.calcConditionValue.placeholder = language === "en" ? "e.g. Drug A; leave unused when no filter is selected" : "例如 Drug A；不筛选时无需填写";
    if (["计算结果", "Calculation result"].includes(elements.calcOutputName.value)) elements.calcOutputName.value = language === "en" ? "Calculation result" : "计算结果";
    document.querySelector(".panel-note").textContent = language === "en"
      ? "How it works: choose the wells, choose a numeric value, set the calculation, then name where the result should be saved. Existing values are not overwritten."
      : "使用方式：先确定要计算哪些孔，再选择要计算的数值和运算方式，最后设置结果名称。不会覆盖原参数。";
    document.getElementById("calculationOutputTitle").textContent = language === "en" ? "Generated calculation results" : "已生成的计算结果";
    document.querySelector(".calculation-output-heading p").textContent = language === "en"
      ? "This order is also the result-column order in exported tables."
      : "以下顺序就是导出表中的结果列顺序。";
    const liquidCardLabels = language === "en"
      ? [
          ["Routine solution", "C1V1 and target concentration"],
          ["Transfection mix", "siRNA, plasmid, and premix tubes"],
          ["Serial dilution", "Direct or stepwise dilution"],
          ["Drug concentration gradient", "Preparation, preview, and layout"],
        ]
      : [
          ["基础常规配液", "C1V1 与目标浓度配液"],
          ["转染体系配液", "siRNA、质粒与多管 Mix"],
          ["连续梯度稀释", "直接或逐级稀释"],
          ["药物浓度梯度", "配液、预览与排板"],
        ];
    document.querySelectorAll(".liquid-module-launch").forEach((button, index) => {
      button.querySelector("strong").textContent = liquidCardLabels[index][0];
      button.querySelector("small").textContent = liquidCardLabels[index][1];
    });
    elements.openLiquidCalculatorButton.textContent = bilingual("打开配液计算", "Open liquid preparation");
    document.querySelector(".liquid-card-note").textContent = bilingual("默认余量 10% · 最小可靠移液体积 1 µL · 结果仅保存在当前浏览器", "10% default overage · 1 µL minimum reliable pipetting volume · browser-local results");
  }

  function defaultProject() {
    return {
      version: 1,
      name: "未命名孔板",
      plateSize: 24,
      dimensions: DEFAULT_DIMENSIONS.map((dimension) => ({ ...dimension })),
      plates: { 6: {}, 12: {}, 24: {}, 96: {}, 384: {} },
      colorDimension: "treatment",
      calculationLog: [],
      calculationOutputs: [],
      liquidPlans: [],
      updatedAt: new Date().toISOString(),
    };
  }

  function normalizeProject(raw) {
    if (!raw || typeof raw !== "object") throw new Error("项目文件格式无效。");
    const normalized = defaultProject();
    normalized.name = typeof raw.name === "string" ? raw.name.slice(0, 80) : normalized.name;
    normalized.plateSize = [6, 12, 24, 96, 384].includes(Number(raw.plateSize)) ? Number(raw.plateSize) : 24;

    if (Array.isArray(raw.dimensions)) {
      const seen = new Set();
      normalized.dimensions = raw.dimensions
        .filter((dimension) => dimension && typeof dimension.id === "string" && typeof dimension.name === "string")
        .map((dimension) => ({
          id: dimension.id.slice(0, 80),
          name: dimension.name.trim().slice(0, 30),
          type: dimension.type === "number" ? "number" : "text",
          unit: dimension.type === "number" && typeof dimension.unit === "string" ? dimension.unit.trim().slice(0, 16) : "",
        }))
        .filter((dimension) => dimension.name && !seen.has(dimension.id) && seen.add(dimension.id));
    }

    normalized.plates = { 6: {}, 12: {}, 24: {}, 96: {}, 384: {} };
    for (const size of [6, 12, 24, 96, 384]) {
      const validIds = new Set(Core.makeWellIds(size));
      const source = raw.plates && raw.plates[size];
      if (!source || typeof source !== "object") continue;
      for (const [wellId, well] of Object.entries(source)) {
        if (!validIds.has(wellId) || !well || typeof well.params !== "object" || Array.isArray(well.params)) continue;
        normalized.plates[size][wellId] = { params: { ...well.params } };
      }
    }

    normalized.colorDimension = normalized.dimensions.some((dimension) => dimension.id === raw.colorDimension)
      ? raw.colorDimension
      : (normalized.dimensions[0]?.id || "");
    normalized.calculationLog = Array.isArray(raw.calculationLog) ? raw.calculationLog.slice(-50) : [];
    normalized.calculationOutputs = Array.isArray(raw.calculationOutputs)
      ? raw.calculationOutputs
        .filter((item) => item && typeof item.id === "string" && normalized.dimensions.some((dimension) => dimension.id === item.id))
        .map((item) => ({
          id: item.id,
          plateSize: [6, 12, 24, 96, 384].includes(Number(item.plateSize)) ? Number(item.plateSize) : normalized.plateSize,
          scope: item.scope === "selected" ? "selected" : "all",
          conditionId: typeof item.conditionId === "string" ? item.conditionId : "",
          conditionValue: String(item.conditionValue ?? ""),
          sourceId: typeof item.sourceId === "string" ? item.sourceId : "",
          operation: ["multiply", "divide", "add", "subtract"].includes(item.operation) ? item.operation : "multiply",
          operandMode: item.operandMode === "parameter" ? "parameter" : "constant",
          operandValue: String(item.operandValue ?? ""),
          operandId: typeof item.operandId === "string" ? item.operandId : "",
          updated: Math.max(0, Number(item.updated) || 0),
          skipped: Math.max(0, Number(item.skipped) || 0),
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
          legacy: item.legacy === true,
        }))
      : [];
    normalized.liquidPlans = Array.isArray(raw.liquidPlans)
      ? raw.liquidPlans.filter((item) => item && typeof item === "object").slice(-30).map((item) => ({ ...item, stale: item.stale === true }))
      : [];
    if (!normalized.calculationOutputs.length && normalized.calculationLog.length) {
      const migratedIds = new Set();
      for (const entry of normalized.calculationLog) {
        const dimension = normalized.dimensions.find((item) => item.name === entry.outputName);
        if (!dimension || migratedIds.has(dimension.id)) continue;
        migratedIds.add(dimension.id);
        normalized.calculationOutputs.push({
          id: dimension.id, plateSize: Number(entry.plateSize) || normalized.plateSize, scope: "all",
          conditionId: "", conditionValue: "", sourceId: "", operation: "multiply",
          operandMode: "constant", operandValue: "", operandId: "",
          updated: Math.max(0, Number(entry.updated) || 0), skipped: Math.max(0, Number(entry.skipped) || 0),
          createdAt: typeof entry.at === "string" ? entry.at : new Date().toISOString(), legacy: true,
        });
      }
    }
    normalized.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString();
    return normalized;
  }

  function loadWorkspace() {
    try {
      const storedWorkspace = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (storedWorkspace) return Workspace.normalizeWorkspace(JSON.parse(storedWorkspace));
      const storedLegacy = localStorage.getItem(STORAGE_KEY);
      return storedLegacy ? Workspace.normalizeWorkspace(JSON.parse(storedLegacy)) : Workspace.createWorkspace();
    } catch (error) {
      console.warn("Could not restore saved workspace:", error);
      return Workspace.createWorkspace();
    }
  }

  function openWorkspaceDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { resolve(null); return; }
      const request = indexedDB.open(WORKSPACE_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WORKSPACE_DB_STORE)) db.createObjectStore(WORKSPACE_DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function writeWorkspaceToIndexedDb() {
    try {
      const db = await openWorkspaceDb();
      if (!db) return;
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(WORKSPACE_DB_STORE, "readwrite");
        transaction.objectStore(WORKSPACE_DB_STORE).put(workspace, "active");
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    } catch (error) {
      console.error("IndexedDB save failed:", error);
      showToast(bilingual("自动保存失败，请立即导出 JSON 备份", "Autosave failed. Export a JSON backup now."));
    }
  }

  async function initializeIndexedStorage() {
    try {
      const db = await openWorkspaceDb();
      if (!db) return;
      const stored = await new Promise((resolve, reject) => {
        const request = db.transaction(WORKSPACE_DB_STORE, "readonly").objectStore(WORKSPACE_DB_STORE).get("active");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      if (stored && new Date(stored.updatedAt || 0) > new Date(workspace.updatedAt || 0)) {
        workspace = Workspace.normalizeWorkspace(stored);
        project = Workspace.activePlate(workspace);
        selection = new Set();
        selectionAnchor = null;
        renderAll();
      } else {
        writeWorkspaceToIndexedDb();
      }
    } catch (error) {
      console.warn("IndexedDB restore failed:", error);
    }
  }

  function saveProject() {
    project.updatedAt = new Date().toISOString();
    workspace.updatedAt = project.updatedAt;
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    } catch (error) {
      console.warn("Workspace mirror exceeded localStorage capacity:", error);
    }
    window.clearTimeout(indexedSaveTimer);
    indexedSaveTimer = window.setTimeout(writeWorkspaceToIndexedDb, 80);
    elements.saveStatus.textContent = t("autosaved");
  }

  function snapshot() {
    return JSON.stringify(project);
  }

  function historyFor(plateId = project.id) {
    if (!plateHistories.has(plateId)) plateHistories.set(plateId, { undo: [], redo: [] });
    return plateHistories.get(plateId);
  }

  function restoreActivePlate(raw) {
    const restored = Workspace.normalizeWorkspace({ version: 2, name: workspace.name, activePlateId: raw.id, plates: [raw] }).plates[0];
    const index = workspace.plates.findIndex((plate) => plate.id === project.id);
    workspace.plates[index] = restored;
    project = restored;
  }

  function commit(mutator, { invalidateLiquid = true } = {}) {
    const history = historyFor();
    history.undo.push(snapshot());
    if (history.undo.length > MAX_HISTORY) history.undo.shift();
    history.redo = [];
    mutator();
    if (invalidateLiquid) {
      project.liquidPlans = (project.liquidPlans || []).map((item) => ({ ...item, stale: true, status: "stale" }));
      workspace.latestLiquidSummary = null;
    }
    saveProject();
    renderAll();
  }

  function undo() {
    const history = historyFor();
    if (!history.undo.length) {
      if (!workspaceUndoStack.length) return;
      workspaceRedoStack.push(structureSnapshot());
      workspace = Workspace.normalizeWorkspace(JSON.parse(workspaceUndoStack.pop()));
      project = Workspace.activePlate(workspace);
      selection = new Set();
      selectionAnchor = null;
      saveProject();
      renderAll();
      showToast(t("undoDone"));
      return;
    }
    history.redo.push(snapshot());
    restoreActivePlate(JSON.parse(history.undo.pop()));
    selection = new Set();
    selectionAnchor = null;
    saveProject();
    renderAll();
    showToast(t("undoDone"));
  }

  function redo() {
    const history = historyFor();
    if (!history.redo.length) {
      if (!workspaceRedoStack.length) return;
      workspaceUndoStack.push(structureSnapshot());
      workspace = Workspace.normalizeWorkspace(JSON.parse(workspaceRedoStack.pop()));
      project = Workspace.activePlate(workspace);
      selection = new Set();
      selectionAnchor = null;
      saveProject();
      renderAll();
      showToast(t("redoDone"));
      return;
    }
    history.undo.push(snapshot());
    restoreActivePlate(JSON.parse(history.redo.pop()));
    selection = new Set();
    selectionAnchor = null;
    saveProject();
    renderAll();
    showToast(t("redoDone"));
  }

  function structureSnapshot() { return JSON.stringify(workspace); }

  function commitWorkspace(mutator) {
    workspaceUndoStack.push(structureSnapshot());
    if (workspaceUndoStack.length > MAX_HISTORY) workspaceUndoStack.shift();
    workspaceRedoStack = [];
    plateHistories.clear();
    mutator();
    workspace = Workspace.normalizeWorkspace(workspace);
    project = Workspace.activePlate(workspace);
    selection = new Set();
    selectionAnchor = null;
    saveProject();
    renderAll();
  }

  function currentWells() {
    return project.plates[project.plateSize];
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
    })[character]);
  }

  function escapeXml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
    })[character]);
  }

  function colorDimensionName() {
    return project.dimensions.find((dimension) => dimension.id === project.colorDimension)?.name || "";
  }

  function colorRegistryFor(dimensionName = colorDimensionName()) {
    const key = String(dimensionName || "").trim().toLocaleLowerCase();
    if (colorRegistryCache.has(key)) return colorRegistryCache.get(key);
    const values = [];
    for (const plate of workspace.plates) {
      const dimension = plate.dimensions.find((item) => item.name.trim().toLocaleLowerCase() === key);
      if (!dimension) continue;
      for (const well of Object.values(plate.plates[plate.plateSize] || {})) values.push(well?.params?.[dimension.id]);
    }
    const registry = Color.createCategoryRegistry(values);
    colorRegistryCache.set(key, registry);
    return registry;
  }

  function colorFor(value, dimensionName) {
    return colorRegistryFor(dimensionName).colorFor(value);
  }

  function getDisplayEntries(params) {
    return project.dimensions
      .filter((dimension) => params[dimension.id] !== undefined && params[dimension.id] !== "")
      .map((dimension) => [dimension, params[dimension.id]]);
  }

  function dimensionLabel(dimension) {
    const defaultDimension = DEFAULT_DIMENSIONS.find((item) => item.id === dimension.id);
    const knownDefaultNames = defaultDimension ? [defaultDimension.name, I18N.en.defaultNames[dimension.id]] : [];
    const name = defaultDimension && knownDefaultNames.includes(dimension.name) ? t("defaultNames")[dimension.id] : dimension.name;
    return dimension.type === "number" && dimension.unit ? `${name} (${dimension.unit})` : name;
  }

  function displayValue(dimension, value) {
    return dimension.type === "number" && dimension.unit && value !== "" && value !== undefined
      ? `${value} ${dimension.unit}`
      : value;
  }

  function renderPlate() {
    const spec = Core.getSpec(project.plateSize);
    const wells = currentWells();
    const colorDimension = project.colorDimension;
    elements.plateGrid.dataset.size = String(project.plateSize);
    elements.plateGrid.style.setProperty("--plate-columns", String(spec.columns));
    elements.wellDisplayNote.textContent = t(project.plateSize === 384 ? "note384" : project.plateSize === 96 ? "note96" : "noteDefault");

    const html = ['<span class="axis-label" aria-hidden="true"></span>'];
    for (let column = 1; column <= spec.columns; column += 1) {
      html.push(`<span class="axis-label">${column}</span>`);
    }
    for (const row of spec.rows) {
      html.push(`<span class="axis-label">${row}</span>`);
      for (let column = 1; column <= spec.columns; column += 1) {
        const wellId = `${row}${column}`;
        const params = wells[wellId]?.params || {};
        const entries = getDisplayEntries(params);
        const colorValue = colorDimension ? params[colorDimension] : undefined;
        const colors = colorValue !== undefined && colorValue !== "" ? colorFor(colorValue) : ["#f8f5f0", "#4f5550", "#c9c3bb"];
        const primary = entries[0] ? displayValue(entries[0][0], entries[0][1]) : "";
        const secondary = entries[1] ? displayValue(entries[1][0], entries[1][1]) : "";
        const tertiary = entries[2] ? displayValue(entries[2][0], entries[2][1]) : "";
        const details = entries.length
          ? entries.map(([dimension, value]) => `${dimensionLabel(dimension)}: ${displayValue(dimension, value)}`).join("；")
          : t("emptyWell");
        const classNames = ["well", entries.length ? "has-data" : "", selection.has(wellId) ? "selected" : ""].filter(Boolean).join(" ");
        html.push(
          `<button type="button" class="${classNames}" data-well="${wellId}" aria-pressed="${selection.has(wellId)}" aria-label="${escapeHtml(`${wellId}，${details}`)}" title="${escapeHtml(`${wellId}｜${details}`)}" style="--well-bg:${colors[0]};--well-ink:${colors[1]};--well-border:${colors[2]}">` +
            `<span><span class="well-id">${wellId}</span>` +
            (primary !== "" ? `<span class="well-primary">${escapeHtml(primary)}</span>` : "") +
            (secondary !== "" ? `<span class="well-secondary">${escapeHtml(secondary)}</span>` : "") +
            (tertiary !== "" ? `<span class="well-tertiary">${escapeHtml(tertiary)}</span>` : "") +
            `</span></button>`,
        );
      }
    }
    elements.plateGrid.innerHTML = html.join("");
    renderLegend();
  }

  function renderLegend() {
    if (!project.colorDimension) {
      elements.plateLegend.innerHTML = `<span class="legend-empty">${t("legendNone")}</span>`;
      return;
    }
    const values = [...new Set(
      Object.values(currentWells())
        .map((well) => well.params?.[project.colorDimension])
        .filter((value) => value !== undefined && value !== "")
        .map(String),
    )];
    if (!values.length) {
      elements.plateLegend.innerHTML = `<span class="legend-empty">${t("legendEmpty")}</span>`;
      return;
    }
    const colorDimension = project.dimensions.find((dimension) => dimension.id === project.colorDimension);
    elements.plateLegend.innerHTML = values
      .map((value) => `<span class="legend-item"><i class="legend-swatch" style="--swatch:${colorFor(value)[2]}"></i>${escapeHtml(colorDimension ? displayValue(colorDimension, value) : value)}</span>`)
      .join("");
  }

  function renderDimensions() {
    elements.dimensionCount.textContent = String(project.dimensions.length);
    elements.dimensionList.innerHTML = project.dimensions.length
      ? project.dimensions.map((dimension, index) => (
        `<div class="dimension-row" data-dimension="${escapeHtml(dimension.id)}">` +
          `<input class="dimension-name-input" type="text" value="${escapeHtml(dimension.name)}" maxlength="30" aria-label="维度名称" />` +
          `<select class="dimension-type-select" aria-label="${t("type")}"><option value="text"${dimension.type === "text" ? " selected" : ""}>${t("text")}</option><option value="number"${dimension.type === "number" ? " selected" : ""}>${t("number")}</option></select>` +
          `<input class="dimension-unit-input" type="text" value="${escapeHtml(dimension.unit || "")}" placeholder="${t("unit")}" maxlength="16" aria-label="${escapeHtml(dimension.name)} ${t("unit")}"${dimension.type === "number" ? "" : " hidden"} />` +
          `<span class="dimension-order-actions"><button class="dimension-order-button" data-action="up" type="button" aria-label="${bilingual("上移参数", "Move parameter up")}"${index === 0 ? " disabled" : ""}>↑</button><button class="dimension-order-button" data-action="down" type="button" aria-label="${bilingual("下移参数", "Move parameter down")}"${index === project.dimensions.length - 1 ? " disabled" : ""}>↓</button></span>` +
          `<button class="dimension-delete" type="button" title="删除该维度" aria-label="删除 ${escapeHtml(dimension.name)}">×</button>` +
        `</div>`
      )).join("")
      : `<div class="editor-empty">${language === "en" ? "No parameters yet. Add one above." : "还没有参数维度。先在上方添加一个。"}</div>`;
  }

  function renderSelectionEditor() {
    renderSelectedWellSummary();
    elements.editorSelectionCount.textContent = t("wellsCount", { n: selection.size });
    if (!selection.size) {
      elements.selectionEditor.innerHTML = `<div class="editor-empty">${t("editorEmpty")}</div>`;
      elements.applyParametersButton.disabled = true;
      elements.clearParametersButton.disabled = true;
      return;
    }
    elements.applyParametersButton.disabled = !project.dimensions.length;
    elements.clearParametersButton.disabled = !project.dimensions.length;
    const wells = currentWells();
    elements.selectionEditor.innerHTML = project.dimensions.map((dimension) => {
      const values = [...selection].map((wellId) => wells[wellId]?.params?.[dimension.id]);
      const first = values[0];
      const uniform = values.every((value) => value === first);
      const value = uniform && first !== undefined ? first : "";
      const placeholder = uniform ? t("inputValue") : t("overwriteValues");
      return (
        `<label class="parameter-input-row">` +
          `<input class="parameter-apply-checkbox" type="checkbox" aria-label="应用 ${escapeHtml(dimensionLabel(dimension))}" />` +
          `<span class="parameter-name" title="${escapeHtml(dimensionLabel(dimension))}">${escapeHtml(dimensionLabel(dimension))}</span>` +
          `<input class="parameter-value" data-dimension="${escapeHtml(dimension.id)}" type="${dimension.type === "number" ? "number" : "text"}" step="${dimension.type === "number" ? "any" : ""}" value="${escapeHtml(value)}" placeholder="${placeholder}" title="${escapeHtml(t("pasteValuesHint"))}" />` +
        `</label>`
      );
    }).join("");
    renderBatchPastePanel();
  }

  function orderedSelectedWells(order = "N") {
    const selectedIds = new Set(selection);
    const rowMajor = Core.makeWellIds(project.plateSize).filter((wellId) => selectedIds.has(wellId));
    if (order === "Z") return rowMajor;
    return rowMajor.sort((leftId, rightId) => {
      const left = Core.parseWell(project.plateSize, leftId);
      const right = Core.parseWell(project.plateSize, rightId);
      return left.column - right.column || left.row - right.row;
    });
  }

  function batchTargetWells(order = "N") {
    if (selection.size !== 1) return orderedSelectedWells(order);
    const startWell = [...selection][0];
    const allIds = Core.makeWellIds(project.plateSize);
    const ordered = order === "Z" ? allIds : [...allIds].sort((leftId, rightId) => {
      const left = Core.parseWell(project.plateSize, leftId);
      const right = Core.parseWell(project.plateSize, rightId);
      return left.column - right.column || left.row - right.row;
    });
    const startIndex = ordered.indexOf(startWell);
    return startIndex >= 0 ? ordered.slice(startIndex) : [];
  }

  function renderBatchPastePanel() {
    elements.selectionEditor.querySelector(".batch-paste-panel")?.remove();
    if (!pendingBatchPaste) return;
    elements.applyParametersButton.disabled = true;
    elements.clearParametersButton.disabled = true;
    const dimension = project.dimensions.find((item) => item.id === pendingBatchPaste.dimensionId);
    if (!dimension) return;
    const targetIds = batchTargetWells(pendingBatchPaste.order);
    const overflow = Math.max(0, pendingBatchPaste.values.length - targetIds.length);
    const previewPairs = pendingBatchPaste.values.slice(0, Math.min(3, targetIds.length)).map((value, index) => `${targetIds[index]} = ${value === "" ? "∅" : value}`);
    if (pendingBatchPaste.values.length > 3 && targetIds[pendingBatchPaste.values.length - 1]) {
      previewPairs.push(`… ${targetIds[pendingBatchPaste.values.length - 1]} = ${pendingBatchPaste.values.at(-1) || "∅"}`);
    }
    const status = overflow
      ? selection.size === 1
        ? bilingual(`从 ${[...selection][0]} 开始仅剩 ${targetIds.length} 个孔，但粘贴了 ${pendingBatchPaste.values.length} 个值，多出 ${overflow} 个。`, `Only ${targetIds.length} wells remain from ${[...selection][0]}, but ${pendingBatchPaste.values.length} values were pasted (${overflow} extra).`)
        : bilingual(`已选 ${targetIds.length} 个孔，但粘贴了 ${pendingBatchPaste.values.length} 个值，多出 ${overflow} 个。`, `${targetIds.length} wells are selected, but ${pendingBatchPaste.values.length} values were pasted (${overflow} extra).`)
      : selection.size === 1
        ? bilingual(`从 ${[...selection][0]} 开始，检测到 ${pendingBatchPaste.values.length} 个值，将写入“${dimensionLabel(dimension)}”。`, `Starting at ${[...selection][0]}, ${pendingBatchPaste.values.length} values detected for “${dimensionLabel(dimension)}”.`)
        : bilingual(`检测到 ${pendingBatchPaste.values.length} 个值，将写入“${dimensionLabel(dimension)}”。`, `${pendingBatchPaste.values.length} values detected for “${dimensionLabel(dimension)}”.`);
    const unfilledValues = overflow ? pendingBatchPaste.values.slice(targetIds.length) : [];
    const unfilledPreview = unfilledValues.slice(0, 5).map((value) => value === "" ? "∅" : value).join("、");
    const unfilledText = overflow
      ? bilingual(`未填入：${unfilledPreview}${unfilledValues.length > 5 ? `……（共 ${unfilledValues.length} 个）` : ""}`, `Not filled: ${unfilledPreview}${unfilledValues.length > 5 ? `… (${unfilledValues.length} total)` : ""}`)
      : "";
    elements.selectionEditor.insertAdjacentHTML("beforeend",
      `<div class="batch-paste-panel${overflow ? " has-error" : ""}" data-dimension="${escapeHtml(dimension.id)}">` +
        `<div class="batch-paste-head"><strong>${escapeHtml(status)}</strong><button class="batch-paste-cancel" type="button" aria-label="${bilingual("取消批量粘贴", "Cancel batch paste")}">×</button></div>` +
        `<div class="batch-paste-controls"><span>${bilingual("填充顺序", "Fill order")}</span><button class="batch-order${pendingBatchPaste.order === "N" ? " active" : ""}" data-order="N" type="button">N</button><button class="batch-order${pendingBatchPaste.order === "Z" ? " active" : ""}" data-order="Z" type="button">Z</button>${overflow ? `<button class="batch-paste-partial secondary-button" type="button">${bilingual(`仅填前 ${targetIds.length} 个`, `Fill first ${targetIds.length}`)}</button>` : `<button class="batch-paste-apply primary-button" type="button">${bilingual("应用", "Apply")}</button>`}</div>` +
        `<div class="batch-paste-preview">${escapeHtml(previewPairs.join("　"))}</div>` +
        `${overflow ? `<div class="batch-paste-overflow-values">${escapeHtml(unfilledText)}</div>` : ""}` +
      `</div>`,
    );
    elements.selectionEditor.scrollTop = elements.selectionEditor.scrollHeight;
  }

  function renderSelectedWellSummary() {
    if (!selection.size) {
      elements.selectedWellSummary.innerHTML = `<div class="well-summary-empty">${t("summarySelect")}</div>`;
      return;
    }

    const wells = currentWells();
    const selectedIds = [...selection];
    const singleWellId = selectedIds.length === 1 ? selectedIds[0] : null;
    let entries;
    let heading;
    let subheading;
    let summaryId;

    if (singleWellId) {
      entries = getDisplayEntries(wells[singleWellId]?.params || {}).map(([dimension, value]) => ({
        label: dimensionLabel(dimension),
        value: displayValue(dimension, value),
        mixed: false,
      }));
      heading = t("currentWell", { id: singleWellId });
      subheading = t("assignedInfo");
      summaryId = singleWellId;
    } else {
      entries = project.dimensions.flatMap((dimension) => {
        const values = selectedIds.map((wellId) => wells[wellId]?.params?.[dimension.id]);
        if (!values.some((value) => value !== undefined && value !== "")) return [];
        const uniform = values.every((value) => value === values[0]);
        return [{
          label: dimensionLabel(dimension),
          value: uniform ? displayValue(dimension, values[0]) : t("multipleValues"),
          mixed: !uniform,
        }];
      });
      heading = t("selectedWells", { n: selectedIds.length });
      subheading = t("overview");
      summaryId = String(selectedIds.length);
    }

    const parameterMarkup = entries.length
      ? `<div class="summary-parameter-grid">${entries.map((entry) => (
          `<div class="summary-parameter" title="${escapeHtml(`${entry.label}: ${entry.value}`)}">` +
            `<span class="summary-label">${escapeHtml(entry.label)}</span>` +
            `<span class="summary-value${entry.mixed ? " mixed" : ""}">${escapeHtml(entry.value)}</span>` +
          `</div>`
        )).join("")}</div>`
      : `<div class="summary-body-empty">${t("noParameters")}</div>`;

    elements.selectedWellSummary.innerHTML =
      `<div class="well-summary-shell">` +
        `<div class="well-summary-head">` +
          `<span class="well-summary-id">${escapeHtml(summaryId)}</span>` +
          `<span class="well-summary-title"><strong>${escapeHtml(heading)}</strong><small>${escapeHtml(subheading)}</small></span>` +
          `<span class="well-summary-state">${t("items", { n: entries.length })}</span>` +
        `</div>` +
        parameterMarkup +
      `</div>`;
  }

  function optionMarkup(options, selectedValue, emptyLabel) {
    const items = emptyLabel !== undefined ? [{ value: "", label: emptyLabel }, ...options] : options;
    return items.map((option) => `<option value="${escapeHtml(option.value)}"${String(option.value) === String(selectedValue) ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
  }

  function renderSelectOptions() {
    const prior = {
      color: elements.colorDimension.value,
      condition: elements.calcConditionDimension.value,
      source: elements.calcSource.value,
      operand: elements.parameterOperand.value,
    };
    const all = project.dimensions.map((dimension) => ({ value: dimension.id, label: `${dimensionLabel(dimension)} · ${dimension.type === "number" ? t("number") : t("text")}` }));
    const numeric = project.dimensions.filter((dimension) => dimension.type === "number").map((dimension) => ({ value: dimension.id, label: dimensionLabel(dimension) }));
    elements.colorDimension.innerHTML = optionMarkup(all, project.colorDimension || prior.color, t("noColor"));
    elements.calcConditionDimension.innerHTML = optionMarkup(all, prior.condition, t("noFilter"));
    elements.calcSource.innerHTML = optionMarkup(numeric, prior.source, numeric.length ? undefined : t("noNumeric"));
    elements.parameterOperand.innerHTML = optionMarkup(numeric, prior.operand, numeric.length ? undefined : t("noNumeric"));
    elements.runCalculationButton.disabled = !numeric.length;
    updateConditionSuggestions();
    updateCalculationGuide();
  }

  function updateConditionSuggestions() {
    const dimensionId = elements.calcConditionDimension.value;
    const values = dimensionId
      ? [...new Set(Object.values(currentWells()).map((well) => well.params?.[dimensionId]).filter((value) => value !== undefined && value !== "").map(String))]
      : [];
    elements.conditionValueSuggestions.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
  }

  function updateCalculationGuide() {
    const sourceDimension = project.dimensions.find((dimension) => dimension.id === elements.calcSource.value);
    const conditionDimension = project.dimensions.find((dimension) => dimension.id === elements.calcConditionDimension.value);
    const operandDimension = project.dimensions.find((dimension) => dimension.id === elements.parameterOperand.value);
    const operationSymbol = { multiply: "×", divide: "÷", add: "+", subtract: "−" }[elements.calcOperation.value] || "?";
    const scopeText = elements.calcScope.value === "selected"
      ? bilingual(`当前选中的 ${selection.size} 个孔`, `${selection.size} currently selected wells`)
      : bilingual(`当前板的全部 ${project.plateSize} 个孔`, `all ${project.plateSize} wells on this plate`);
    const filterText = conditionDimension
      ? bilingual(`，且“${dimensionLabel(conditionDimension)}”必须正好等于“${elements.calcConditionValue.value || "空值"}”`, ` where “${dimensionLabel(conditionDimension)}” exactly equals “${elements.calcConditionValue.value || "empty"}”`)
      : bilingual(`，不按标签筛选`, ` with no label filter`);
    const operandText = elements.operandMode.value === "parameter"
      ? (operandDimension ? dimensionLabel(operandDimension) : bilingual("请选择另一个数值参数", "choose another numeric parameter"))
      : (elements.constantOperand.value || "0");
    const sourceText = sourceDimension ? dimensionLabel(sourceDimension) : bilingual("请先选择数值参数", "choose a numeric parameter first");
    const requestedOutputName = elements.calcOutputName.value.trim();
    const outputText = requestedOutputName ? nextAvailableDimensionName(requestedOutputName) : bilingual("未命名结果", "unnamed result");
    elements.calculationGuide.innerHTML =
      `<strong>${bilingual("计算对象：", "Wells: ")}</strong>${escapeHtml(scopeText + filterText)}<br>` +
      `<strong>${bilingual("实际公式：", "Formula: ")}</strong>${escapeHtml(`${sourceText} ${operationSymbol} ${operandText} → ${outputText}`)}`;
  }

  function nextAvailableDimensionName(requestedName) {
    const baseName = requestedName.trim();
    const names = new Set(project.dimensions.map((dimension) => dimension.name.toLowerCase()));
    if (!names.has(baseName.toLowerCase())) return baseName;
    let suffix = 2;
    while (names.has(`${baseName} ${suffix}`.toLowerCase())) suffix += 1;
    return `${baseName} ${suffix}`;
  }

  function calculationOutputFormula(item) {
    if (item.legacy) return bilingual("历史计算（旧版未记录公式详情）", "Historical calculation (formula details were not recorded by the previous version)");
    const source = project.dimensions.find((dimension) => dimension.id === item.sourceId);
    const operand = project.dimensions.find((dimension) => dimension.id === item.operandId);
    const symbol = { multiply: "×", divide: "÷", add: "+", subtract: "−" }[item.operation] || "?";
    const sourceName = source ? dimensionLabel(source) : bilingual("已删除的参数", "Deleted parameter");
    const operandName = item.operandMode === "parameter"
      ? (operand ? dimensionLabel(operand) : bilingual("已删除的参数", "Deleted parameter"))
      : item.operandValue;
    return `${sourceName} ${symbol} ${operandName}`;
  }

  function renderCalculationOutputs() {
    const outputs = project.calculationOutputs || [];
    elements.calculationOutputCount.textContent = String(outputs.length);
    if (!outputs.length) {
      elements.calculationOutputList.innerHTML = `<div class="calculation-output-empty">${bilingual("运行计算后，结果条目会出现在这里。", "Calculation result entries will appear here after you run a calculation.")}</div>`;
      return;
    }
    elements.calculationOutputList.innerHTML = outputs.map((item, index) => {
      const dimension = project.dimensions.find((candidate) => candidate.id === item.id);
      if (!dimension) return "";
      const confirming = pendingCalculationDeleteId === item.id;
      return `<article class="calculation-output-item" data-output="${escapeHtml(item.id)}">` +
        `<button class="calculation-output-main" data-action="view" type="button"><strong>${escapeHtml(dimensionLabel(dimension))}</strong><small>${escapeHtml(calculationOutputFormula(item))} · ${escapeHtml(bilingual(`${item.plateSize} 孔板，写入 ${item.updated} 孔`, `${item.plateSize}-well plate, ${item.updated} wells written`))}</small><span>${bilingual("将作为一列导出", "Exported as a column")}</span></button>` +
        `<div class="calculation-output-actions"><button data-action="up" type="button" aria-label="${bilingual("上移", "Move up")}"${index === 0 ? " disabled" : ""}>↑</button><button data-action="down" type="button" aria-label="${bilingual("下移", "Move down")}"${index === outputs.length - 1 ? " disabled" : ""}>↓</button><button class="calculation-output-delete${confirming ? " confirming" : ""}" data-action="delete" type="button">${confirming ? bilingual("确认", "Confirm") : "×"}</button></div>` +
      `</article>`;
    }).join("");
  }

  function resetCalculationDeleteConfirmation() {
    window.clearTimeout(calculationDeleteTimer);
    calculationDeleteTimer = null;
    if (!pendingCalculationDeleteId) return;
    pendingCalculationDeleteId = null;
    renderCalculationOutputs();
  }

  function reorderCalculatedDimensions() {
    const outputIds = new Set(project.calculationOutputs.map((item) => item.id));
    const regularDimensions = project.dimensions.filter((dimension) => !outputIds.has(dimension.id));
    const outputDimensions = project.calculationOutputs
      .map((item) => project.dimensions.find((dimension) => dimension.id === item.id))
      .filter(Boolean);
    project.dimensions = [...regularDimensions, ...outputDimensions];
  }

  function viewCalculationOutput(outputId) {
    const item = project.calculationOutputs.find((candidate) => candidate.id === outputId);
    if (!item) return;
    if (project.plateSize !== item.plateSize || project.colorDimension !== outputId) {
      commit(() => {
        project.plateSize = item.plateSize;
        project.colorDimension = outputId;
      });
    }
    const firstResultWell = Core.makeWellIds(project.plateSize).find((wellId) => currentWells()[wellId]?.params?.[outputId] !== undefined);
    selection = firstResultWell ? new Set([firstResultWell]) : new Set();
    selectionAnchor = firstResultWell || null;
    updateSelectionVisuals();
    elements.plateGrid.querySelector(`[data-well="${firstResultWell}"]`)?.focus({ preventScroll: true });
    elements.plateCanvas.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function liquidTargetWellIds() {
    if (selection.size) return [...selection];
    const occupied = Core.makeWellIds(project.plateSize).filter((wellId) => {
      const params = currentWells()[wellId]?.params || {};
      return Object.values(params).some((value) => value !== "" && value !== undefined);
    });
    return occupied.length ? occupied : Core.makeWellIds(project.plateSize);
  }

  function renderLiquidScopeBadge() {
    const occupiedCount = Object.keys(currentWells()).length;
    const targetCount = liquidTargetWellIds().length;
    const scope = selection.size
      ? bilingual(`已选 ${selection.size} 孔`, `${selection.size} selected`)
      : occupiedCount
        ? bilingual(`非空孔 ${targetCount} 孔`, `${targetCount} non-empty wells`)
        : bilingual(`整板 ${project.plateSize} 孔`, `full ${project.plateSize}-well plate`);
    elements.liquidScopeBadge.textContent = scope;
    elements.liquidDrawerScope.textContent = bilingual(`当前范围：${scope}`, `Current scope: ${scope}`);
  }

  function liquidNumber(value, digits = 4) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return number.toLocaleString(language === "en" ? "en-US" : "zh-CN", { maximumFractionDigits: digits });
  }

  function liquidUnitOptions(units, selected) {
    return units.map((unit) => `<option value="${escapeHtml(unit)}"${unit === selected ? " selected" : ""}>${escapeHtml(unit)}</option>`).join("");
  }

  function readLiquidRecipeLibrary() {
    try {
      const stored = JSON.parse(localStorage.getItem(RECIPE_LIBRARY_KEY) || "[]");
      return Array.isArray(stored) ? stored.filter((item) => item && typeof item === "object" && item.id && item.module && item.input) : [];
    } catch (error) {
      return [];
    }
  }

  function writeLiquidRecipeLibrary(library) {
    localStorage.setItem(RECIPE_LIBRARY_KEY, JSON.stringify(library.filter((item) => !item.builtIn).slice(-50)));
  }

  function normalizeLiquidRecipeInput(recipe) {
    const input = { ...(recipe.input || {}) };
    if (recipe.module !== "basic") return input;
    // A working-solution confirmation is valid only for the currently rendered
    // result. Reopening or importing a recipe must require a fresh confirmation.
    input.workingSolutionConfirmed = "no";
    input.calculationType = input.calculationType || "dilution";
    if (input.calculationType === "solid") {
      input.solidKind ??= input.kind;
      input.solidTargetConcentration ??= input.targetConcentration;
      input.solidTargetUnit ??= input.targetUnit;
      input.solidTotalVolume ??= input.totalVolume;
      input.solidVolumeUnit ??= input.volumeUnit;
      input.solidOveragePercent ??= input.overagePercent;
    } else if (input.calculationType === "fixed") input.fixedOveragePercent ??= input.overagePercent;
    else input.dilutionOveragePercent ??= input.overagePercent;
    return input;
  }

  function liquidRecipeLibraryMarkup() {
    const recipes = [...BUILTIN_LIQUID_RECIPES, ...readLiquidRecipeLibrary()];
    return `<section class="liquid-recipe-library"><div><strong>${bilingual("可复用配方", "Reusable recipes")}</strong><small>${bilingual("内置配方只读；复制后可修改。", "Built-in recipes are read-only; copy one to customize it.")}</small></div>` +
      `<select data-liquid-library-select>${recipes.map((recipe) => `<option value="${escapeHtml(recipe.id)}">${recipe.builtIn ? "🔒 " : ""}${escapeHtml(recipe.name)}</option>`).join("")}</select>` +
      `<div class="liquid-library-actions"><button type="button" data-liquid-action="load-preset">${bilingual("加载", "Load")}</button><button type="button" data-liquid-action="copy-preset">${bilingual("复制并修改", "Copy & edit")}</button><button type="button" data-liquid-action="delete-preset">${bilingual("删除", "Delete")}</button><button type="button" data-liquid-action="export-presets">JSON</button><label class="secondary-button file-button">${bilingual("导入", "Import")}<input type="file" data-liquid-library-import accept="application/json,.json" hidden></label></div></section>`;
  }

  function liquidWorkspace(formTitle, formDescription, fields, resultDescription) {
    return liquidRecipeLibraryMarkup() + `<div class="liquid-workspace">` +
      `<section class="liquid-form-card"><h3>${escapeHtml(formTitle)}</h3><p>${escapeHtml(formDescription)}</p><form id="liquidActiveForm"><div class="liquid-form-grid">${fields}</div><div class="liquid-action-row"><button class="primary-button" type="submit">${bilingual("计算", "Calculate")}</button><button class="secondary-button" data-liquid-action="reset" type="button">${bilingual("恢复默认", "Reset")}</button></div></form></section>` +
      `<section class="liquid-result-card"><h3>${bilingual("计算结果", "Calculation result")}</h3><p>${escapeHtml(resultDescription)}</p><div id="liquidResultHost"><div class="liquid-result-empty">${bilingual("填写参数并点击“计算”。结果不会自动写入孔板。", "Enter parameters and calculate. Results are not written to the plate automatically.")}</div></div></section>` +
    `</div>`;
  }

  function basicLiquidMarkup() {
    const wells = liquidTargetWellIds().length;
    const defaultReagents = escapeHtml(JSON.stringify([{ name: "CCK-8", referenceVolume: "100", referenceUnit: "µL", reagentVolume: "10", reagentUnit: "µL" }]));
    return liquidWorkspace(
      bilingual("基础常规配液", "Routine solution preparation"),
      bilingual("先选择要完成的实验任务，只填写当前任务需要的信息。", "Choose the laboratory task first, then enter only the information needed for that task."),
      `<label class="wide"><span>${bilingual("我要做什么", "Preparation task")}</span><select name="calculationType"><option value="fixed">${bilingual("按固定比例加入试剂", "Add reagents at fixed ratios")}</option><option value="dilution">${bilingual("将浓缩母液稀释到工作浓度", "Dilute a stock to working concentration")}</option><option value="solid">${bilingual("从称量物配制溶液", "Prepare solution from weighed material")}</option></select></label>` +
      `<label data-basic-task="fixed"><span>${bilingual("比例表示什么", "Ratio meaning")}</span><select name="fixedMeaning"><option value="extra">${bilingual("按培养基体积额外加入", "Add relative to medium volume")}</option><option value="final">${bilingual("按最终体系体积稀释", "Dilute relative to final mixture")}</option></select></label>` +
      `<label data-basic-task="fixed"><span>${bilingual("我要按什么计算", "Calculation scope")}</span><select name="fixedVolumeMode"><option value="per-well">${bilingual("按当前孔板范围", "Current plate scope")}</option><option value="total">${bilingual("直接输入总量", "Enter a direct total")}</option></select></label>` +
      `<label data-basic-task="fixed"><span data-fixed-base-label>${bilingual("每孔培养基体积", "Medium volume per well")}</span><div class="liquid-inline-input"><input name="fixedBaseVolume" type="number" min="0" step="any" value="100"><select name="fixedBaseUnit">${liquidUnitOptions(["µL","mL"], "µL")}</select></div></label>` +
      `<label class="liquid-scope-field" data-basic-task="fixed" data-fixed-scope="per-well"><span>${bilingual("孔数（来自当前孔板范围）", "Well count (from current plate scope)")}</span><input name="wellCount" type="number" min="1" step="1" value="${wells}" readonly aria-readonly="true"><small class="liquid-scope-help">${bilingual("如需修改孔数，请关闭窗口后重新选择孔位。", "To change the well count, close this panel and reselect wells.")}</small></label>` +
      `<input name="fixedReagentsJson" type="hidden" value="${defaultReagents}"><div class="liquid-subsection wide" data-basic-task="fixed"><strong>${bilingual("需要加入的试剂", "Reagents to add")}</strong><small>${bilingual("示例仅用于说明输入方式，不代表通用实验推荐。", "The example only demonstrates the input format and is not a universal protocol recommendation.")}</small><div class="fixed-reagent-list" data-fixed-reagent-list></div><button class="secondary-button" data-liquid-action="add-fixed-reagent" type="button">＋ ${bilingual("添加试剂", "Add reagent")}</button></div>` +
      `<label data-basic-task="fixed"><span>${bilingual("最小可靠移液体积", "Minimum reliable pipetting volume")}</span><div class="liquid-inline-input"><input name="minimumPipetteVolume" type="number" min="0" step="any" value="1"><select disabled><option>µL</option></select></div></label>` +
      `<label data-basic-task="fixed"><span>${bilingual("小体积工作液", "Small-volume working solution")}</span><select name="workingSolutionMode"><option value="suggest">${bilingual("仅建议，不改变结果", "Suggest only")}</option><option value="apply">${bilingual("申请应用（需再次确认）", "Request application (second confirmation required)")}</option></select></label><input name="workingSolutionConfirmed" type="hidden" value="no">` +
      `<label data-basic-task="fixed"><span>${bilingual("额外多配百分比", "Extra volume percentage")}</span><div class="liquid-inline-input"><input name="fixedOveragePercent" type="number" min="0" step="any" value="10"><select disabled><option>%</option></select></div></label>` +
      `<label data-basic-task="dilution"><span>${bilingual("浓度类型", "Concentration type")}</span><select name="kind"><option value="molar">${bilingual("摩尔浓度（如 µM）", "Molar concentration (e.g. µM)")}</option><option value="mass">${bilingual("质量浓度（如 ng/µL）", "Mass concentration (e.g. ng/µL)")}</option><option data-percent-kind value="percent-vv">% v/v</option><option data-percent-kind value="percent-wv">% w/v</option></select></label>` +
      `<label data-basic-task="dilution"><span>${bilingual("我手里的母液浓度", "Stock concentration I have")}</span><div class="liquid-inline-input"><input name="stockConcentration" type="number" min="0" step="any" value="10"><select name="stockUnit">${liquidUnitOptions(["nM","µM","mM","M"], "mM")}</select></div></label>` +
      `<label data-basic-task="dilution"><span>${bilingual("我需要的工作液浓度", "Working concentration I need")}</span><div class="liquid-inline-input"><input name="targetConcentration" type="number" min="0" step="any" value="100"><select name="targetUnit">${liquidUnitOptions(["nM","µM","mM","M"], "µM")}</select></div></label>` +
      `<label data-basic-task="dilution"><span>${bilingual("我要按什么计算", "Calculation scope")}</span><select name="volumeMode"><option value="total">${bilingual("直接输入工作液总量", "Enter working-solution total")}</option><option value="per-well">${bilingual("按当前孔板范围", "Current plate scope")}</option></select></label>` +
      `<label data-basic-task="dilution" data-volume-mode="total"><span>${bilingual("工作液总量", "Working-solution total")}</span><div class="liquid-inline-input"><input name="totalVolume" type="number" min="0" step="any" value="10"><select name="volumeUnit">${liquidUnitOptions(["µL","mL","L"], "mL")}</select></div></label>` +
      `<label data-basic-task="dilution" data-volume-mode="per-well"><span>${bilingual("每孔需要多少工作液", "Working solution per well")}</span><div class="liquid-inline-input"><input name="perWellVolume" type="number" min="0" step="any" value="100"><select name="perWellUnit">${liquidUnitOptions(["nL","µL","mL"], "µL")}</select></div></label>` +
      `<label class="liquid-scope-field" data-basic-task="dilution" data-volume-mode="per-well"><span>${bilingual("孔数（来自当前孔板范围）", "Well count (from current plate scope)")}</span><input name="dilutionWellCount" type="number" min="1" step="1" value="${wells}" readonly aria-readonly="true"><small class="liquid-scope-help">${bilingual("如需修改孔数，请关闭窗口后重新选择孔位。", "To change the well count, close this panel and reselect wells.")}</small></label>` +
      `<label data-basic-task="dilution"><span>${bilingual("额外多配百分比", "Extra volume percentage")}</span><div class="liquid-inline-input"><input name="dilutionOveragePercent" type="number" min="0" step="any" value="10"><select disabled><option>%</option></select></div></label>` +
      `<label data-basic-task="solid"><span>${bilingual("浓度类型", "Concentration type")}</span><select name="solidKind"><option value="molar">${bilingual("摩尔浓度", "Molar concentration")}</option><option value="mass">${bilingual("质量浓度", "Mass concentration")}</option></select></label>` +
      `<label data-basic-task="solid"><span>${bilingual("目标浓度", "Target concentration")}</span><div class="liquid-inline-input"><input name="solidTargetConcentration" type="number" min="0" step="any" value="100"><select name="solidTargetUnit">${liquidUnitOptions(["nM","µM","mM","M"], "µM")}</select></div></label>` +
      `<label data-basic-task="solid"><span>${bilingual("目标体积", "Target volume")}</span><div class="liquid-inline-input"><input name="solidTotalVolume" type="number" min="0" step="any" value="10"><select name="solidVolumeUnit">${liquidUnitOptions(["µL","mL","L"], "mL")}</select></div></label>` +
      `<label data-basic-task="solid"><span>${bilingual("纯度/有效含量", "Purity/effective content")}</span><div class="liquid-inline-input"><input name="purityPercent" type="number" min="0" max="100" step="any" value="100"><select disabled><option>%</option></select></div></label>` +
      `<label data-basic-task="solid" data-molecular-weight><span>${bilingual("分子量", "Molecular weight")}</span><div class="liquid-inline-input"><input name="molecularWeight" type="number" min="0" step="any" placeholder="g/mol"><select disabled><option>g/mol</option></select></div></label>` +
      `<label data-basic-task="solid"><span>${bilingual("额外多配百分比", "Extra volume percentage")}</span><div class="liquid-inline-input"><input name="solidOveragePercent" type="number" min="0" step="any" value="10"><select disabled><option>%</option></select></div></label>`,
      bilingual("输出理论配方、包含余量的整批 Master Mix、警告和台面操作步骤。", "Returns the theoretical recipe, overage-adjusted batch master mix, warnings, and bench checklist."),
    );
  }

  function transfectionLiquidMarkup() {
    const wells = liquidTargetWellIds().length;
    const textDimensions = project.dimensions.filter((dimension) => dimension.type === "text");
    const plateDefault = {
      6: { finalVolume: 2000, complexVolume: 200, reagentPerWell: 6 },
      24: { finalVolume: 300, complexVolume: 30, reagentPerWell: 0.9 },
    }[project.plateSize] || { finalVolume: "", complexVolume: "", reagentPerWell: "" };
    let defaultProtocolSteps = "";
    if (plateDefault.finalVolume) {
      const preview = Liquid.calculateRnaiMaxTransfection({ wellCount: 1, overagePercent: 0, direction: "forward", finalVolume: plateDefault.finalVolume, complexVolume: plateDefault.complexVolume, stockConcentration: 10, stockUnit: "µM", targetValue: 10, targetUnit: "nM", reagentPerWell: plateDefault.reagentPerWell });
      defaultProtocolSteps = LiquidPlan.buildTransfectionProtocol({ language, preset: "rnai", direction: "forward", result: preview }).join("\n");
    }
    return liquidWorkspace(
      bilingual("转染体系配液", "Transfection mix preparation"),
      bilingual("按当前孔数计算双管预混体系。预设参数是起始值，实验前应按细胞与厂商说明书复核。", "Calculate two-tube premixes for the current well scope. Preset values are starting points and must be reviewed for the cell model."),
      `<label class="wide"><span>${bilingual("试剂预设", "Reagent preset")}</span><select name="preset"><option value="rnai">RNAiMAX + siRNA</option><option value="lipo3000">Lipofectamine 3000 + plasmid</option><option value="lipo3000-combo">Lipofectamine 3000 + plasmid + siRNA</option><option value="custom-one">${bilingual("自定义单管", "Custom one-tube")}</option><option value="custom-two">${bilingual("自定义双管/多管", "Custom two/multi-tube")}</option></select></label>` +
      `<label><span>${bilingual("切换板型后的处理", "After changing plate format")}</span><select name="platePresetAction"><option value="keep">${bilingual("保留当前配方", "Keep current recipe")}</option><option value="apply-default">${bilingual("应用该板型已知起始值", "Apply known format starting values")}</option><option value="recalculate">${bilingual("保留配方并按新孔数重算", "Keep recipe and recalculate for scope")}</option></select><small>${escapeHtml([6, 24].includes(project.plateSize) ? bilingual(`当前为 ${project.plateSize} 孔板，已有 RNAiMAX 起始值。`, `Known RNAiMAX starting values are available for ${project.plateSize}-well plates.`) : bilingual("该板型没有内置厂商起始值，不自动线性外推。", "No built-in manufacturer starting values exist for this format; values are not linearly extrapolated."))}</small></label>` +
      `<label class="liquid-scope-field"><span>${bilingual("孔数（来自当前孔板范围）", "Well count (from current plate scope)")}</span><input name="wellCount" type="number" min="1" step="1" value="${wells}" readonly aria-readonly="true"><small class="liquid-scope-help">${bilingual("如需修改孔数，请关闭窗口后重新选择孔位。", "To change the well count, close this panel and reselect wells.")}</small></label>` +
      `<label><span>${bilingual("分组维度（可选）", "Grouping dimension (optional)")}</span><select name="groupDimension"><option value="">${bilingual("不分组", "No grouping")}</option>${textDimensions.map((dimension) => `<option value="${escapeHtml(dimension.id)}">${escapeHtml(dimensionLabel(dimension))}</option>`).join("")}</select></label>` +
      `<label><span>${bilingual("转染方式", "Transfection direction")}</span><select name="direction"><option value="forward">${bilingual("正向转染", "Forward")}</option><option value="reverse">${bilingual("反向转染", "Reverse")}</option></select></label>` +
      `<label><span>${bilingual("合并公共 Master Mix", "Merge common master mix")}</span><select name="mergeCommonMix"><option value="off">${bilingual("不合并", "Keep separate")}</option><option value="on">${bilingual("条件一致时合并", "Merge identical components")}</option></select></label>` +
      `<label><span>${bilingual("孔内终体积", "Final well volume")}</span><div class="liquid-inline-input"><input name="finalVolume" type="number" min="0" step="any" value="${plateDefault.finalVolume}"><select disabled><option>µL</option></select></div></label>` +
      `<label><span>${bilingual("转染复合物体积", "Complex volume")}</span><div class="liquid-inline-input"><input name="complexVolume" type="number" min="0" step="any" value="${plateDefault.complexVolume}"><select disabled><option>µL</option></select></div></label>` +
      `<label><span>${bilingual("目的物名称", "Cargo name")}</span><input name="cargoName" type="text" value="siRNA"></label>` +
      `<label><span>${bilingual("库存浓度", "Stock concentration")}</span><div class="liquid-inline-input"><input name="stockConcentration" type="number" min="0" step="any" value="10"><select name="stockUnit">${liquidUnitOptions(["nM","µM","mM"], "µM")}</select></div></label>` +
      `<label><span data-target-label>${bilingual("目标终浓度", "Target final concentration")}</span><div class="liquid-inline-input"><input name="targetValue" type="number" min="0" step="any" value="10"><select name="targetUnit">${liquidUnitOptions(["nM","µM"], "nM")}</select></div></label>` +
      `<label><span data-reagent-label>RNAiMAX / well</span><div class="liquid-inline-input"><input name="reagentPerWell" type="number" min="0" step="any" value="${plateDefault.reagentPerWell}"><select disabled><option>µL</option></select></div></label>` +
      `<label data-lipo-only hidden><span>P3000 / µg DNA</span><div class="liquid-inline-input"><input name="p3000PerUg" type="number" min="0" step="any" value="2"><select disabled><option>µL</option></select></div></label>` +
      `<label data-lipo-only hidden><span>${bilingual("质粒长度（可选）", "Plasmid length (optional)")}</span><div class="liquid-inline-input"><input name="lengthBp" type="number" min="1" step="1" placeholder="5000"><select disabled><option>bp</option></select></div></label>` +
      `<label><span>${bilingual("余量", "Overage")}</span><div class="liquid-inline-input"><input name="overagePercent" type="number" min="0" step="any" value="10"><select disabled><option>%</option></select></div></label>` +
      `<label><span>${bilingual("最小可靠移液体积", "Minimum pipetting volume")}</span><div class="liquid-inline-input"><input name="minimumPipetteVolume" type="number" min="0" step="any" value="1"><select disabled><option>µL</option></select></div></label>` +
      `<label><span>${bilingual("中间工作液", "Intermediate working solution")}</span><select name="workingSolutionMode"><option value="suggest">${bilingual("仅建议，不改变计算", "Suggest only")}</option><option value="apply">${bilingual("确认并应用建议", "Confirm and apply")}</option></select></label>` +
      `<label class="wide"><span>${bilingual("分组角色（可选；每行 组名=角色）", "Group roles (optional; Group=Role per line)")}</span><textarea name="groupRoleLines" rows="3" placeholder="Mock=Mock&#10;Untreated=Untransfected&#10;Blank=Exclude"></textarea></label>` +
      `<label class="wide"><span>${bilingual("分组余量覆盖（可选；每行 组名=百分比）", "Group overage overrides (optional; Group=percent per line)")}</span><textarea name="groupOverageLines" rows="2" placeholder="Control=10&#10;Treatment=15"></textarea></label>` +
      `<label data-custom-only hidden><span>${bilingual("混合目的物总质量", "Total cargo mixture mass")}</span><div class="liquid-inline-input"><input name="totalCargoMass" type="number" min="0" step="any" value="600"><select name="totalCargoMassUnit">${liquidUnitOptions(["ng","µg"], "ng")}</select></div></label>` +
      `<label data-custom-only hidden><span>${bilingual("混合目的物总摩尔量", "Total cargo mixture amount")}</span><div class="liquid-inline-input"><input name="totalCargoAmount" type="number" min="0" step="any" value="10"><select name="totalCargoAmountUnit">${liquidUnitOptions(["pmol","nmol"], "pmol")}</select></div></label>` +
      `<label class="wide" data-custom-only hidden><span>${bilingual("目的物：名称,类型(siRNA/plasmid/other),库存,库存单位,目标模式,目标值/比例,目标单位,长度bp,分子量", "Cargo: name,type(siRNA/plasmid/other),stock,stock unit,target mode,target/ratio,target unit,length bp,molecular weight")}</span><textarea name="cargoLines" rows="4">Plasmid DNA,plasmid,500,ng/µL,mass-per-well,2500,ng,5000,&#10;siRNA,siRNA,10,µM,final-concentration,10,nM,,</textarea></label>` +
      `<label class="wide" data-custom-only hidden><span>${bilingual("分组目的物覆盖（每行：组名|完整目的物行）", "Group-specific cargo override (Group|complete cargo row)")}</span><textarea name="groupCargoLines" rows="3" placeholder="Treatment A|siA,siRNA,10,µM,final-concentration,10,nM,,&#10;Treatment B|siB,siRNA,10,µM,final-concentration,20,nM,,"></textarea></label>` +
      `<label class="wide" data-custom-only hidden><span>${bilingual("预混管：管名,每孔管体积,组分,模式,数值,关联目的物/集合,可稀释", "Premix tubes: tube,volume/well,component,mode,value,cargo/collection,dilutable")}</span><textarea name="tubeLines" rows="6">A,125,Plasmid DNA,cargo,,Plasmid DNA,yes&#10;A,125,siRNA,cargo,,siRNA,yes&#10;A,125,P3000,ratio-per-ug,2,Plasmid DNA,no&#10;A,125,Opti-MEM,diluent,,,yes&#10;B,125,Lipofectamine 3000,fixed,3.75,,no&#10;B,125,Opti-MEM,diluent,,,yes</textarea><small>${escapeHtml(bilingual("集合可用 all-cargos、all-siRNA、all-plasmid，或用 A+B 指定目的物子集；模式可用 cargo、fixed、ratio-per-ug、ratio-per-pmol、ratio-volume、diluent。", "Collections: all-cargos, all-siRNA, all-plasmid, or a named subset such as A+B. Modes: cargo, fixed, ratio-per-ug, ratio-per-pmol, ratio-volume, diluent."))}</small></label>` +
      `<details class="liquid-subsection liquid-protocol-editor" open><summary><strong>${bilingual("操作步骤（预设，可选修改）", "Protocol steps (preset, optional edit)")}</strong><span>${bilingual("步骤随转染方向与每孔体积生成；RNAiMAX 默认室温孵育 5 min。", "Steps follow the direction and per-well volumes; RNAiMAX defaults to 5 min at room temperature.")}</span></summary><input name="protocolMode" type="hidden" value="preset"><label class="wide"><span>${bilingual("每行一个步骤；保存后会冻结并导出", "One step per line; saved plans preserve and export this snapshot")}</span><textarea name="protocolSteps" rows="7">${escapeHtml(defaultProtocolSteps)}</textarea></label><div class="protocol-editor-actions"><span class="protocol-editor-state">${bilingual("跟随当前方案自动更新", "Updates from the current plan")}</span><button class="secondary-button" data-liquid-action="restore-protocol" type="button">${bilingual("按当前方案恢复步骤", "Restore from current plan")}</button></div></details>` +
      `<div class="liquid-subsection"><strong>${bilingual("优化梯度", "Optimization gradient")}</strong><label><span>${bilingual("默认关闭；开启后各变体分别计算且不合并 Master Mix", "Off by default; enabled variants are calculated separately and never merged")}</span><select name="optimizationEnabled"><option value="off">${bilingual("关闭", "Off")}</option><option value="on">${bilingual("开启", "On")}</option></select></label><label data-optimization-only hidden><span>${bilingual("变体：名称,目的物倍数,试剂倍数", "Variants: name,cargo factor,reagent factor")}</span><textarea name="optimizationLines" rows="3">Low,0.5,0.75&#10;Standard,1,1&#10;High,2,1.5</textarea></label></div>`,
      bilingual("输出每孔配方、每管 Master Mix、总消耗量、操作 checklist 和小体积警告。", "Returns per-well recipes, tube-level master mixes, total consumption, checklist, and small-volume warnings."),
    );
  }

  function serialLiquidMarkup() {
    return liquidWorkspace(
      bilingual("连续梯度稀释", "Serial dilution"),
      bilingual("生成固定倍比或指定范围的浓度系列，并比较直接配液或逐级稀释。", "Generate fixed-fold or range-based series using direct or stepwise preparation."),
      `<label><span>${bilingual("系列生成方式", "Series method")}</span><select name="method"><option value="fold">${bilingual("固定倍比", "Fixed fold")}</option><option value="range">${bilingual("起点/终点/点数", "High/low/points")}</option></select></label>` +
      `<label><span>${bilingual("配液策略", "Preparation strategy")}</span><select name="strategy"><option value="direct">${bilingual("各级直接由母液配制", "Direct from stock")}</option><option value="serial">${bilingual("逐级连续稀释", "Stepwise serial")}</option></select></label>` +
      `<label><span>${bilingual("母液浓度", "Stock concentration")}</span><input name="stockConcentration" type="number" min="0" step="any" value="1000"></label>` +
      `<label><span>${bilingual("最高浓度", "Highest concentration")}</span><input name="high" type="number" min="0" step="any" value="100"></label>` +
      `<label data-range-only hidden><span>${bilingual("最低浓度", "Lowest concentration")}</span><input name="low" type="number" min="0" step="any" value="1"></label>` +
      `<label><span>${bilingual("浓度点数", "Number of points")}</span><input name="points" type="number" min="2" step="1" value="8"></label>` +
      `<label data-fold-only><span>${bilingual("稀释倍数", "Dilution fold")}</span><input name="fold" type="number" min="1.000001" step="any" value="2"></label>` +
      `<label data-range-only hidden><span>${bilingual("范围刻度", "Range scale")}</span><select name="scale"><option value="log">Log</option><option value="linear">Linear</option></select></label>` +
      `<label><span>${bilingual("每级目标体积", "Volume per level")}</span><div class="liquid-inline-input"><input name="volumePerLevel" type="number" min="0" step="any" value="1000"><select name="volumeUnit">${liquidUnitOptions(["µL","mL"], "µL")}</select></div></label>` +
      `<label><span>${bilingual("余量", "Overage")}</span><div class="liquid-inline-input"><input name="overagePercent" type="number" min="0" step="any" value="10"><select disabled><option>%</option></select></div></label>` +
      `<label><span>${bilingual("最小可靠移液体积", "Minimum pipetting volume")}</span><div class="liquid-inline-input"><input name="minimumPipetteVolume" type="number" min="0" step="any" value="1"><select disabled><option>µL</option></select></div></label>` +
      `<label><span>${bilingual("映射到孔板", "Map series to plate")}</span><select name="mapToPlate"><option value="off">${bilingual("仅计算配液", "Preparation only")}</option><option value="on">${bilingual("生成排板预览", "Create layout preview")}</option></select></label>` +
      `<label><span>${bilingual("每个浓度复孔数", "Replicates per concentration")}</span><input name="replicates" type="number" min="1" step="1" value="1"></label>`,
      bilingual("输出每一级的来源、转移体积、稀释液体积和分步操作。", "Returns the source, transfer volume, diluent volume, and stepwise instructions for every level."),
    );
  }

  function drugLiquidMarkup() {
    return liquidWorkspace(
      bilingual("药物浓度梯度配液与排板", "Drug gradient preparation and layout"),
      bilingual("每行定义一种独立药物梯度；本模块不计算药物联合、协同作用或 IC50。", "Define one independent gradient per line. This module does not calculate drug combinations, synergy, or IC50."),
      `<label class="wide"><span>${bilingual("药物：名称,母液,最高,最低,点数,生成方式,参数,复孔,加药体积,溶剂,母液溶剂%", "Drug: name,stock,high,low,points,method,parameter,replicates,dose volume,vehicle,stock vehicle %")}</span><textarea name="drugLines" rows="5">Drug A,10000,100,0.78,8,fold,2,3,10,DMSO,100</textarea></label>` +
      `<label><span>${bilingual("每级配液体积", "Preparation volume per level")}</span><div class="liquid-inline-input"><input name="volumePerLevel" type="number" min="0" step="any" value="1000"><select disabled><option>µL</option></select></div></label>` +
      `<label><span>${bilingual("默认加药体积", "Default dosing volume")}</span><div class="liquid-inline-input"><input name="dosingVolume" type="number" min="0" step="any" value="10"><select disabled><option>µL</option></select></div></label>` +
      `<label><span>${bilingual("孔内终体积", "Final well volume")}</span><div class="liquid-inline-input"><input name="finalWellVolume" type="number" min="0" step="any" value="100"><select disabled><option>µL</option></select></div></label>` +
      `<label><span>${bilingual("排板方向", "Layout orientation")}</span><select name="orientation"><option value="row">${bilingual("按行", "Row-wise")}</option><option value="column">${bilingual("按列", "Column-wise")}</option></select></label>` +
      `<label><span>${bilingual("浓度方向", "Concentration direction")}</span><select name="direction"><option value="high-to-low">${bilingual("高到低", "High to low")}</option><option value="low-to-high">${bilingual("低到高", "Low to high")}</option></select></label>` +
      `<label><span>${bilingual("余量", "Overage")}</span><div class="liquid-inline-input"><input name="overagePercent" type="number" min="0" step="any" value="10"><select disabled><option>%</option></select></div></label>` +
      `<label><span>${bilingual("复孔分散", "Disperse replicates")}</span><select name="disperseReplicates"><option value="off">${bilingual("关闭", "Off")}</option><option value="on">${bilingual("开启", "On")}</option></select></label>` +
      `<label><span>${bilingual("避开边缘孔", "Avoid edge wells")}</span><select name="avoidEdges"><option value="off">${bilingual("关闭", "Off")}</option><option value="on">${bilingual("开启", "On")}</option></select></label>` +
      `<label><span>${bilingual("边缘孔填充", "Edge-well fill")}</span><select name="edgeFill"><option value="off">${bilingual("不写入", "Do not assign")}</option><option value="PBS">PBS</option><option value="Medium">${bilingual("培养基", "Medium")}</option></select></label>` +
      `<label><span>${bilingual("每种药物 vehicle 对照孔", "Vehicle controls per drug")}</span><input name="controlsPerDrug" type="number" min="0" step="1" value="0"></label>` +
      `<label><span>${bilingual("对照位置", "Control position")}</span><select name="controlPosition"><option value="end">${bilingual("末端", "End")}</option><option value="start">${bilingual("起始", "Start")}</option><option value="fixed">${bilingual("指定孔位", "Fixed wells")}</option></select></label>` +
      `<label class="wide"><span>${bilingual("指定 vehicle 对照孔（逗号或空格分隔）", "Fixed vehicle-control wells (comma/space separated)")}</span><input name="fixedControlWells" type="text" placeholder="B2, B3"></label>` +
      `<div class="liquid-subsection"><strong>${bilingual("范围与安全", "Scope and safety")}</strong><span>${escapeHtml(bilingual("优先使用当前选中孔；未选孔时使用当前板的空白孔。已有内容的孔不会被覆盖。计算后必须先预览，再确认写入。", "Selected wells are preferred; otherwise empty wells on the current plate are used. Populated wells are never overwritten. Preview is required before writing."))}</span></div>`,
      bilingual("输出每种药物的独立配液表和孔板预览；确认后写入药物、浓度和复孔字段。", "Returns independent preparation tables and a plate preview; confirmation writes drug, concentration, and replicate fields."),
    );
  }

  function captureLiquidDraft(module = activeLiquidModule) {
    const form = document.getElementById("liquidActiveForm");
    if (!form || !module) return;
    const draft = {};
    for (const control of form.elements) {
      if (!control.name || control.name === "wellCount" || control.name === "workingSolutionConfirmed" || ["button", "submit", "reset"].includes(control.type)) continue;
      if ((control.type === "checkbox" || control.type === "radio") && !control.checked) continue;
      draft[control.name] = control.value;
    }
    liquidDrafts[module] = draft;
  }

  function restoreLiquidDraft(form, module) {
    const draft = liquidDrafts[module];
    if (draft) {
      const setValue = (name) => {
        const control = form.elements[name];
        if (control && draft[name] !== undefined && [...(control.options || [])].some?.((option) => option.value === draft[name])) control.value = draft[name];
        else if (control && draft[name] !== undefined && !control.options) control.value = draft[name];
      };
      if (module === "basic") {
        ["calculationType", "kind", "solidKind", "volumeMode", "fixedMeaning", "fixedVolumeMode"].forEach(setValue);
        updateBasicFormControls(form);
      }
      if (module === "transfection") {
        setValue("preset");
        updateTransfectionFormControls(form);
      }
      if (module === "serial") {
        setValue("method");
        updateSerialFormControls(form);
      }
      for (const [name, value] of Object.entries(draft)) {
        const control = form.elements[name];
        if (!control || name === "wellCount") continue;
        if (control.options && ![...control.options].some((option) => option.value === value)) continue;
        control.value = value;
      }
      if (module === "basic") {
        let rows;
        try { rows = JSON.parse(form.elements.fixedReagentsJson.value); } catch (error) { rows = null; }
        renderFixedReagentRows(form, rows);
        updateBasicFormControls(form);
        form.elements.workingSolutionConfirmed.value = "no";
      }
      if (module === "transfection") updateTransfectionFormControls(form);
      if (module === "transfection" && draft.protocolSteps && draft.protocolMode === undefined) {
        form.elements.protocolMode.value = "custom";
        form.elements.protocolSteps.value = draft.protocolSteps;
        const state = form.querySelector(".protocol-editor-state");
        if (state) { state.textContent = bilingual("步骤已自定义；参数改变后请复核体积", "Custom steps; review volumes after changing parameters"); state.classList.add("is-custom"); }
      }
    }
    if (!draft && module === "transfection") {
      // The markup already contains the format-aware starting values. Mark that
      // preset as initialized before wiring dependent controls so the first
      // blur/change cannot overwrite a value the user has just entered.
      form.dataset.presetInitialized = form.elements.preset.value;
      updateTransfectionFormControls(form);
    }
    const scopeCount = liquidTargetWellIds().length;
    form.querySelectorAll('[name="wellCount"], [name="dilutionWellCount"]').forEach((control) => {
      control.value = String(scopeCount);
      control.readOnly = true;
      control.setAttribute("aria-readonly", "true");
    });
  }

  function liquidModuleDefinition(module) {
    return {
      basic: { markup: basicLiquidMarkup, updateNames: ["calculationType", "kind", "solidKind", "volumeMode", "fixedMeaning", "fixedVolumeMode"], update: updateBasicFormControls, calculate: calculateBasicLiquid },
      transfection: { markup: transfectionLiquidMarkup, updateNames: ["preset", "optimizationEnabled", "platePresetAction", "direction", "finalVolume", "complexVolume", "cargoName", "stockConcentration", "stockUnit", "targetValue", "targetUnit", "reagentPerWell", "workingSolutionMode"], update: updateTransfectionFormControls, calculate: calculateTransfectionLiquid },
      serial: { markup: serialLiquidMarkup, updateNames: ["method"], update: updateSerialFormControls, calculate: calculateSerialLiquid },
      drug: { markup: drugLiquidMarkup, updateNames: [], update: null, calculate: calculateDrugLiquid },
    }[module];
  }

  function renderLiquidModule(module = activeLiquidModule, { captureCurrent = true } = {}) {
    if (captureCurrent && document.getElementById("liquidActiveForm")) captureLiquidDraft(activeLiquidModule);
    activeLiquidModule = ["basic", "transfection", "serial", "drug"].includes(module) ? module : "basic";
    lastLiquidResult = null;
    pendingDrugLayout = null;
    pendingSerialLayout = null;
    document.querySelectorAll("[data-liquid-module]").forEach((button) => button.classList.toggle("active", button.dataset.liquidModule === activeLiquidModule));
    const markup = liquidModuleDefinition(activeLiquidModule).markup();
    elements.liquidDrawerContent.innerHTML = markup;
    restoreLiquidDraft(document.getElementById("liquidActiveForm"), activeLiquidModule);
  }

  function openLiquidDrawer(module = activeLiquidModule) {
    renderLiquidScopeBadge();
    elements.liquidDrawer.hidden = false;
    document.body.style.overflow = "hidden";
    renderLiquidModule(module);
    elements.closeLiquidDrawerButton.focus({ preventScroll: true });
  }

  function closeLiquidDrawer() {
    captureLiquidDraft(activeLiquidModule);
    elements.liquidDrawer.hidden = true;
    document.body.style.overflow = "";
  }

  function liquidResultActions() {
    return `<div class="liquid-action-row"><button class="secondary-button" data-liquid-action="copy" type="button">${bilingual("复制表格", "Copy table")}</button><button class="secondary-button" data-liquid-action="csv" type="button">CSV</button><button class="secondary-button" data-liquid-action="print" type="button">${bilingual("打印 / PDF", "Print / PDF")}</button><button class="primary-button" data-liquid-action="save" type="button">${bilingual("保存到项目", "Save to project")}</button><button class="secondary-button" data-liquid-action="save-preset" type="button">${bilingual("存为可复用预设", "Save reusable preset")}</button></div>`;
  }

  function renderLiquidResult(result) {
    lastLiquidResult = result;
    const host = document.getElementById("liquidResultHost");
    if (!host) return;
    const header = `<div class="liquid-result-meta">${(result.meta || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`;
    const table = result.rows?.length
      ? `<div class="liquid-table-wrap"><table class="liquid-table"><thead><tr>${result.headers.map((headerText) => `<th>${escapeHtml(headerText)}</th>`).join("")}</tr></thead><tbody>${result.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      : "";
    const warnings = result.warnings?.length ? `<div class="liquid-warning-list">${result.warnings.map((warning) => `<div class="liquid-warning">${escapeHtml(warning)}</div>`).join("")}</div>` : "";
    const checklist = result.checklist?.length ? `<ol class="liquid-checklist">${result.checklist.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>` : "";
    const layout = result.layout?.length ? liquidLayoutPreview(result.layout) : "";
    const applyAction = result.applyAction || "apply-layout";
    const applyLabel = result.applyLabel || bilingual("确认写入孔板", "Confirm plate write");
    host.innerHTML = header + table + warnings + checklist + layout + liquidResultActions() + (result.canApplyLayout ? `<div class="liquid-action-row"><button class="primary-button" data-liquid-action="${escapeHtml(applyAction)}" type="button">${escapeHtml(applyLabel)}</button></div>` : "");
  }

  function liquidOveragePercent(input = {}) {
    return Number(input.overagePercent ?? input.fixedOveragePercent ?? input.dilutionOveragePercent ?? input.solidOveragePercent ?? 0) || 0;
  }

  function stableRecipeInput(input = {}) {
    const omitted = new Set(["wellCount", "dilutionWellCount", "overagePercent", "fixedOveragePercent", "dilutionOveragePercent", "solidOveragePercent"]);
    return Object.fromEntries(Object.keys(input).filter((key) => !omitted.has(key)).sort().map((key) => [key, input[key]]));
  }

  function volumeFromCell(value) {
    const match = String(value ?? "").match(/(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*(nL|uL|µL|mL|L)\b/i);
    if (!match) return null;
    const unit = match[2] === "ul" || match[2] === "UL" ? "uL" : match[2];
    return { value: Number(match[1]), unit };
  }

  function liquidResultContributions(result, plate) {
    const input = result?.input || {};
    if (result?.module === "transfection" && Array.isArray(result.executionGroups)) {
      return LiquidPlan.buildTransfectionContributions({
        input,
        plate,
        planName: result.recipeName || bilingual("转染体系", "Transfection preparation"),
        groups: result.executionGroups,
      });
    }
    const multiplier = 1 + liquidOveragePercent(input) / 100;
    const groupKey = `${result.module}:${JSON.stringify(stableRecipeInput(input))}`;
    const moduleLabel = result.recipeName || ({
      basic: bilingual("基础常规配液", "Routine preparation"),
      serial: bilingual("连续梯度稀释", "Serial dilution"),
      drug: bilingual("药物浓度梯度", "Drug concentration series"),
      transfection: bilingual("转染体系", "Transfection preparation"),
    }[result.module] || bilingual("配液方案", "Preparation plan"));
    const contributions = [];
    const add = (component, cell, subgroup = "") => {
      const volume = volumeFromCell(cell);
      if (!volume || !Number.isFinite(volume.value) || volume.value < 0) return;
      contributions.push({
        groupKey: subgroup ? `${groupKey}:${subgroup}` : groupKey,
        groupLabel: subgroup ? `${moduleLabel} · ${subgroup}` : moduleLabel,
        component: String(component || bilingual("未命名组分", "Unnamed component")),
        baseVolume: volume.value / multiplier,
        unit: volume.unit,
        plateId: plate.id,
        plateName: plate.name,
      });
    };
    const rows = result?.rows || [];
    if (result.module === "basic" && input.calculationType === "fixed") {
      rows.filter((row) => /整批|Batch master mix/i.test(String(row[0])) && !/最终体系|Final mixture/i.test(String(row[1]))).forEach((row) => add(row[1], row[2]));
    } else if (result.module === "basic" && input.calculationType !== "solid") {
      rows.slice(0, 2).forEach((row) => add(row[0], row[1]));
    } else if (result.module === "transfection") {
      rows.forEach((row) => add(`${row[1]} · ${row[2]}`, row[4], String(row[0])));
    } else if (result.module === "serial") {
      rows.forEach((row) => {
        add(`${bilingual("第", "Level ")}${row[0]} · ${bilingual("来源液", "source")}`, row[3], `level-${row[0]}`);
        add(`${bilingual("第", "Level ")}${row[0]} · ${bilingual("稀释液", "diluent")}`, row[4], `level-${row[0]}`);
      });
    } else if (result.module === "drug") {
      rows.forEach((row) => {
        add(`${row[0]} · L${row[1]} · ${bilingual("母液", "stock")}`, row[4], `${row[0]}-L${row[1]}`);
        add(`${row[0]} · L${row[1]} · ${bilingual("稀释液", "diluent")}`, row[5], `${row[0]}-L${row[1]}`);
      });
    }
    return contributions;
  }

  function selectedLiquidPlates() {
    if (elements.projectLiquidScope.value === "current") return [project];
    if (elements.projectLiquidScope.value === "all") return workspace.plates;
    const checked = new Set([...elements.projectLiquidPlatePicker.querySelectorAll("input:checked")].map((input) => input.value));
    return workspace.plates.filter((plate) => checked.has(plate.id));
  }

  function renderSavedLiquidPlans() {
    const plans = project.liquidPlans || [];
    elements.savedLiquidPlansTitle.textContent = bilingual("当前板已保存方案", "Saved plans for this plate");
    elements.savedLiquidPlansHelp.textContent = bilingual("只有保存到项目且状态有效的方案，才会进入跨板汇总和项目导出。", "Only current plans saved to the project are included in cross-plate summaries and project exports.");
    elements.savedLiquidPlanCount.textContent = String(plans.length);
    if (!plans.length) {
      elements.savedLiquidPlanList.innerHTML = `<div class="saved-liquid-empty"><strong>${bilingual("还没有已保存方案", "No saved plans yet")}</strong><span>${bilingual("打开配液计算，完成计算后点击“保存到项目”。", "Open the calculator and choose “Save to project” after calculating.")}</span></div>`;
      return;
    }
    elements.savedLiquidPlanList.innerHTML = plans.map((plan) => {
      const stale = plan.stale === true || plan.status === "stale";
      const confirming = pendingLiquidPlanDeleteId === plan.id;
      const time = plan.updatedAt || plan.createdAt;
      const parsedTime = time ? new Date(time) : null;
      const timestamp = parsedTime && Number.isFinite(parsedTime.getTime())
        ? new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(parsedTime)
        : "";
      return `<div class="saved-liquid-plan${stale ? " is-stale" : " is-current"}" data-saved-liquid-plan="${escapeHtml(plan.id)}">` +
        `<span class="saved-liquid-plan-state">${stale ? bilingual("需重算", "Recalculate") : bilingual("已生效", "Current")}</span>` +
        `<input class="saved-liquid-plan-name" data-liquid-plan-name type="text" maxlength="80" value="${escapeHtml(plan.name || plan.recipeName || plan.module)}" aria-label="${bilingual("配液方案名称", "Liquid plan name")}">` +
        `<span class="saved-liquid-plan-meta">${escapeHtml(`${plan.recipeName || plan.module || ""}${timestamp ? ` · ${timestamp}` : ""}`)}</span>` +
        `<div class="saved-liquid-plan-actions"><button type="button" data-liquid-plan-action="edit">${bilingual("编辑", "Edit")}</button><button class="danger-text${confirming ? " confirming" : ""}" type="button" data-liquid-plan-action="clear">${confirming ? bilingual("确认清除", "Confirm clear") : bilingual("清除", "Clear")}</button></div>` +
      `</div>`;
    }).join("");
  }

  function renderProjectLiquidControls() {
    document.getElementById("projectLiquidTitle").textContent = bilingual("跨板配液汇总", "Cross-plate liquid summary");
    document.querySelector(".project-liquid-heading p").textContent = bilingual("合并相同配方的基础需求量，再统一加入一次余量。", "Merge compatible base requirements, then apply one shared overage.");
    document.querySelector(".project-liquid-overage > span:first-child").textContent = bilingual("统一余量", "Shared overage");
    document.querySelector(".project-liquid-capacity > span:first-child").textContent = bilingual("单管上限", "Container limit");
    elements.projectLiquidContainerCapacity.placeholder = bilingual("不限", "No limit");
    document.querySelector(".project-liquid-controls label > span").textContent = bilingual("汇总范围", "Summary scope");
    elements.projectLiquidScope.options[0].textContent = bilingual("当前板", "Current plate");
    elements.projectLiquidScope.options[1].textContent = bilingual("勾选板", "Checked plates");
    elements.projectLiquidScope.options[2].textContent = bilingual("全部板", "All plates");
    elements.projectLiquidSummaryButton.textContent = bilingual("生成汇总", "Build summary");
    elements.projectLiquidPlatePicker.hidden = elements.projectLiquidScope.value !== "checked";
    elements.projectLiquidPlatePicker.innerHTML = workspace.plates.map((plate) => `<label><input type="checkbox" value="${escapeHtml(plate.id)}"${plate.id === project.id ? " checked" : ""}>${escapeHtml(plate.name)} · ${plate.plateSize}</label>`).join("");
    if (!workspace.latestLiquidSummary) elements.projectLiquidSummary.innerHTML = "";
  }

  function aggregateLiquidPlans(plates, overagePercent, maxContainerVolume = Infinity) {
    const contributions = [];
    const skipped = [];
    for (const plate of plates) {
      for (const plan of plate.liquidPlans || []) {
        if (plan.stale) continue;
        if (!Array.isArray(plan.contributions) || !plan.contributions.length) skipped.push(`${plate.name} · ${plan.name || plan.module}`);
        else contributions.push(...plan.contributions.map((item) => ({ ...item, plateId: plate.id, plateName: plate.name })));
      }
    }
    return { merged: Workspace.mergeLiquidContributions(contributions, { overagePercent, minPipetteVolume: 1, maxContainerVolume }), skipped, contributionCount: contributions.length };
  }

  function renderProjectLiquidSummary(summary) {
    if (!summary) { elements.projectLiquidSummary.innerHTML = ""; return; }
    const rows = summary.groups.flatMap((group) => group.components.map((component) => [
      group.tubeRole === "cargo" ? bilingual("目的物管", "Cargo tube") : group.tubeRole === "common" ? bilingual("公共预混液", "Common premix") : bilingual("配液", "Preparation"),
      group.label || group.key,
      component.name,
      (group.sources || group.plates || []).map((source) => `${source.plateName || source.plateId}${source.scopeWellIds?.length ? ` · ${source.scopeWellIds.join(", ")}` : ""}`).join("；"),
      component.perWellVolume ? `${liquidNumber(component.perWellVolume)} µL` : "",
      `${liquidNumber(component.baseVolume)} µL`,
      `${liquidNumber(component.preparedVolume)} µL`,
      String(component.containerCount),
      component.warning ? bilingual("存在移液量低于 1 µL", "A transfer is below 1 µL") : "",
    ]));
    const skipped = summary.skipped?.length ? `<div class="project-liquid-summary-note warning">${escapeHtml(bilingual(`有 ${summary.skipped.length} 个旧方案没有可合并明细，请重新打开计算并保存：${summary.skipped.join("；")}`, `${summary.skipped.length} legacy plans have no mergeable detail; recalculate and save them: ${summary.skipped.join("; ")}`))}</div>` : "";
    const note = `<div class="project-liquid-summary-note">${escapeHtml(bilingual(`已汇总 ${summary.plateNames.length} 块板；按实际配液管合并兼容需求，再统一加入 ${summary.overagePercent}% 余量。目的物管按 siRNA/目的物身份计算，不按板号计算。`, `${summary.plateNames.length} plates summarized by physical preparation tube with one ${summary.overagePercent}% overage. Cargo tubes are grouped by cargo identity, never by plate name.`))}</div>`;
    const cargoTubes = summary.groups.filter((group) => group.tubeRole === "cargo").length;
    const commonTubes = summary.groups.filter((group) => group.tubeRole === "common").length;
    const overview = rows.length ? `<div class="project-liquid-summary-overview"><div class="project-liquid-summary-stat"><strong>${summary.plateNames.length}</strong><span>${bilingual("块板", "plates")}</span></div><div class="project-liquid-summary-stat"><strong>${cargoTubes}</strong><span>${bilingual("目的物管", "cargo tubes")}</span></div><div class="project-liquid-summary-stat"><strong>${commonTubes}</strong><span>${bilingual("公共预混管", "common tubes")}</span></div></div>` : "";
    const actions = rows.length ? `<div class="project-liquid-summary-actions"><button type="button" class="primary-button" data-open-liquid-summary>${bilingual("查看完整汇总与导出", "View full summary & export")}</button></div>` : "";
    const empty = rows.length ? "" : `<div class="project-liquid-summary-note warning">${escapeHtml(bilingual("所选板没有可汇总的已保存配液方案。", "The selected plates have no saved liquid plans that can be summarized."))}</div>`;
    elements.projectLiquidSummary.innerHTML = note + skipped + overview + empty + actions;
  }

  function fullLiquidSummaryTable(summary) {
    const rows = summary.groups.flatMap((group) => group.components.map((component) => [
      group.tubeRole === "cargo" ? bilingual("目的物管", "Cargo tube") : bilingual("公共预混液", "Common premix"), group.label || group.key, component.name,
      (group.sources || []).map((source) => `${source.plateName || source.plateId}${source.scopeWellIds?.length ? ` · ${source.scopeWellIds.join(", ")}` : ""}`).join("；"),
      component.perWellVolume ? `${liquidNumber(component.perWellVolume)} µL` : "", `${liquidNumber(component.baseVolume)} µL`, `${liquidNumber(component.preparedVolume)} µL`, String(component.containerCount),
      component.warning ? bilingual("存在移液量低于 1 µL", "A transfer is below 1 µL") : "",
    ]));
    return `<div class="project-liquid-table-wrap"><table class="liquid-table"><thead><tr>${[bilingual("配液类型", "Preparation type"), bilingual("配液管", "Tube"), bilingual("组分", "Component"), bilingual("覆盖板与孔", "Plates and wells"), bilingual("每孔", "Per well"), bilingual("基础需求", "Base need"), bilingual("建议准备", "Prepare"), bilingual("容器数", "Containers"), bilingual("提示", "Note")].map((item) => `<th>${item}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function openSummaryDrawer() {
    const summary = workspace.latestLiquidSummary;
    if (!summary?.groups?.length) return;
    elements.summaryDrawerMeta.textContent = bilingual(`${summary.plateNames.length} 块板 · ${summary.groups.length} 个物理配液管 · ${summary.overagePercent}% 统一余量`, `${summary.plateNames.length} plates · ${summary.groups.length} physical tubes · ${summary.overagePercent}% shared overage`);
    elements.summaryDrawerActions.innerHTML = `<button type="button" class="secondary-button" data-project-liquid-export="copy">${bilingual("复制汇总", "Copy summary")}</button><button type="button" class="secondary-button" data-project-liquid-export="csv">${bilingual("导出汇总 CSV", "Export summary CSV")}</button><button type="button" class="primary-button" data-project-liquid-export="xlsx">${bilingual("导出汇总 XLSX", "Export summary XLSX")}</button>`;
    elements.summaryDrawerContent.innerHTML = fullLiquidSummaryTable(summary);
    elements.summaryDrawer.hidden = false;
    document.body.classList.add("modal-open");
    elements.closeSummaryDrawerButton.focus();
  }

  function closeSummaryDrawer() {
    elements.summaryDrawer.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function liquidLayoutPreview(assignments) {
    const columns = Core.getSpec(project.plateSize).columns;
    return `<div class="liquid-layout-preview" style="--preview-columns:${columns}">${assignments.map((item) => `<div class="liquid-preview-well"><strong>${escapeHtml(item.wellId)}</strong><small>${escapeHtml(`${item.drug} · ${liquidNumber(item.concentration, 6)} · R${item.replicate}`)}</small></div>`).join("")}</div>`;
  }

  function formValues(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function calculateBasicLiquid(values) {
    if (values.calculationType === "fixed") {
      let reagents;
      try { reagents = JSON.parse(values.fixedReagentsJson); } catch (error) { throw new Error(bilingual("试剂列表无法读取，请重新填写。", "The reagent list could not be read; enter it again.")); }
      const result = Liquid.calculateFixedRatioPreparation({
        meaning: values.fixedMeaning,
        volumeMode: values.fixedVolumeMode,
        baseVolume: values.fixedBaseVolume,
        baseUnit: values.fixedBaseUnit,
        wellCount: values.wellCount,
        overagePercent: values.fixedOveragePercent,
        minimumPipetteVolume: values.minimumPipetteVolume,
        applyWorkingSolutions: values.workingSolutionMode === "apply" && values.workingSolutionConfirmed === "yes",
        reagents,
      });
      const theoreticalBasis = values.fixedVolumeMode === "per-well" ? bilingual("理论每孔", "Theoretical per well") : bilingual("理论输入总量", "Theoretical requested total");
      const rows = [
        [theoreticalBasis, bilingual("培养基/稀释液", "Medium/diluent"), `${liquidNumber(result.theoretical.mediumVolumeUL)} µL`, "—"],
        ...result.theoretical.reagents.map((reagent) => [theoreticalBasis, reagent.name, `${liquidNumber(reagent.volumeUL)} µL`, `1:${liquidNumber(reagent.normalizedRatio, 4)}`]),
        [theoreticalBasis, bilingual("最终体系", "Final mixture"), `${liquidNumber(result.theoretical.finalVolumeUL)} µL`, "—"],
        [bilingual("整批 Master Mix", "Batch master mix"), bilingual("培养基/稀释液", "Medium/diluent"), `${liquidNumber(result.batch.mediumVolumeUL)} µL`, "—"],
        ...result.batch.reagents.map((reagent) => [bilingual("整批 Master Mix", "Batch master mix"), reagent.name, `${liquidNumber(reagent.volumeUL)} µL`, `1:${liquidNumber(reagent.normalizedRatio, 4)}`]),
        [bilingual("整批 Master Mix", "Batch master mix"), bilingual("最终体系", "Final mixture"), `${liquidNumber(result.batch.finalVolumeUL)} µL`, "—"],
      ];
      const warnings = result.warnings.map((warning) => warning.code === "duplicate-name"
        ? bilingual(`存在重复试剂名称“${warning.name}”；已按独立试剂行计算，未自动合并。`, `Duplicate reagent name “${warning.name}”; rows were calculated separately and were not merged.`)
        : bilingual(`${warning.name} 的整批移液量 ${liquidNumber(warning.volumeUL)} µL 低于阈值；建议 ${warning.dilutionFactor} 倍稀释工作液（${warning.applied ? "已确认应用" : "尚未应用"}）。`, `${warning.name} batch transfer ${liquidNumber(warning.volumeUL)} µL is below the threshold; a ${warning.dilutionFactor}-fold diluted working solution is suggested (${warning.applied ? "confirmed and applied" : "not applied"}).`));
      result.workingSolutions.forEach((working) => warnings.push(bilingual(`工作液配制：${liquidNumber(working.stockForWorkingSolutionUL)} µL ${working.name} 原液 + ${liquidNumber(working.diluentForWorkingSolutionUL)} µL 稀释液，得到 ${liquidNumber(working.preparedWorkingSolutionUL)} µL；整批取用 ${liquidNumber(working.transferVolumeUL)} µL。`, `Working solution: combine ${liquidNumber(working.stockForWorkingSolutionUL)} µL ${working.name} stock with ${liquidNumber(working.diluentForWorkingSolutionUL)} µL diluent to make ${liquidNumber(working.preparedWorkingSolutionUL)} µL; transfer ${liquidNumber(working.transferVolumeUL)} µL into the batch.`)));
      const needsWorkingConfirmation = values.workingSolutionMode === "apply" && values.workingSolutionConfirmed !== "yes" && result.workingSolutions.length > 0;
      renderLiquidResult({
        module: "basic", input: values,
        meta: values.fixedVolumeMode === "per-well" ? [bilingual(`实际孔数 ${result.wellCount}`, `${result.wellCount} actual wells`), bilingual(`含余量等效 ${liquidNumber(result.equivalentWells)} 孔`, `${liquidNumber(result.equivalentWells)} equivalent wells with overage`)] : [bilingual(`输入总量 ${liquidNumber(result.requestedVolumeUL)} µL`, `Requested total ${liquidNumber(result.requestedVolumeUL)} µL`), bilingual(`余量 ${result.overagePercent}%`, `${result.overagePercent}% overage`)],
        headers: [bilingual("范围", "Scope"), bilingual("组分", "Component"), bilingual("体积", "Volume"), bilingual("归一化比例", "Normalized ratio")], rows, warnings,
        checklist: [bilingual("核对比例含义、试剂名称和单位。", "Confirm ratio meaning, reagent names, and units."), bilingual(`量取 ${liquidNumber(result.batch.mediumVolumeUL)} µL 培养基/稀释液。`, `Measure ${liquidNumber(result.batch.mediumVolumeUL)} µL medium/diluent.`), ...result.batch.reagents.map((reagent) => bilingual(`加入 ${liquidNumber(reagent.volumeUL)} µL ${reagent.name}。`, `Add ${liquidNumber(reagent.volumeUL)} µL ${reagent.name}.`)), bilingual(`轻柔混匀；整批最终体积为 ${liquidNumber(result.batch.finalVolumeUL)} µL。`, `Mix gently; the final batch volume is ${liquidNumber(result.batch.finalVolumeUL)} µL.`)],
        calculation: result,
        canApplyLayout: needsWorkingConfirmation,
        applyAction: "confirm-basic-working-solution",
        applyLabel: bilingual("再次确认并应用工作液", "Confirm again and apply working solution"),
      });
      return;
    }
    if (values.calculationType === "solid") {
      const result = Liquid.calculateSolutionMass({ kind: values.solidKind, targetConcentration: values.solidTargetConcentration, targetUnit: values.solidTargetUnit, totalVolume: values.solidTotalVolume, volumeUnit: values.solidVolumeUnit, purityPercent: values.purityPercent, molecularWeight: values.molecularWeight, overagePercent: values.solidOveragePercent });
      const preferredMass = result.massNg >= 1000000 ? `${liquidNumber(result.massNg / 1000000)} mg` : result.massNg >= 1000 ? `${liquidNumber(result.massNg / 1000)} µg` : `${liquidNumber(result.massNg)} ng`;
      renderLiquidResult({
        module: "basic", input: values,
        meta: [bilingual(`实际配制 ${liquidNumber(result.preparedVolumeUL)} µL`, `Prepare ${liquidNumber(result.preparedVolumeUL)} µL`), bilingual(`纯度 ${result.purityPercent}%`, `${result.purityPercent}% purity`)],
        headers: [bilingual("项目", "Item"), bilingual("计算结果", "Calculated result")],
        rows: [[bilingual("需称取物料", "Material to weigh"), preferredMass], [bilingual("精确计算值", "Exact calculated mass"), `${liquidNumber(result.massNg, 8)} ng`], [bilingual("定容至", "Bring to volume"), `${liquidNumber(result.preparedVolumeUL)} µL`]],
        warnings: result.massNg < 1000 ? [bilingual("称量质量低于 1 µg；建议先配制高浓度母液，再按 C1V1 稀释。", "Calculated mass is below 1 µg; prepare a concentrated stock and dilute using C1V1.")] : [],
        checklist: [bilingual(`称取 ${preferredMass} 物料。`, `Weigh ${preferredMass} material.`), bilingual("加入约 80% 目标体积的溶剂并完全溶解。", "Add about 80% of the target solvent volume and dissolve completely."), bilingual(`定容至 ${liquidNumber(result.preparedVolumeUL)} µL 并充分混匀。`, `Bring to ${liquidNumber(result.preparedVolumeUL)} µL and mix thoroughly.`)],
      });
      return;
    }
    const result = Liquid.calculateDilution({
      kind: values.kind,
      stockConcentration: values.stockConcentration,
      stockUnit: values.stockUnit,
      targetConcentration: values.targetConcentration,
      targetUnit: values.targetUnit,
      totalVolume: values.volumeMode === "total" ? values.totalVolume : undefined,
      volumeUnit: values.volumeUnit,
      perWellVolume: values.volumeMode === "per-well" ? values.perWellVolume : undefined,
      perWellUnit: values.perWellUnit,
      wellCount: values.dilutionWellCount,
      overagePercent: values.dilutionOveragePercent,
    });
    renderLiquidResult({
      module: "basic", input: values,
      meta: [bilingual(`实际配制 ${liquidNumber(result.preparedVolumeUL)} µL`, `Prepare ${liquidNumber(result.preparedVolumeUL)} µL`), bilingual(`余量 ${result.overagePercent}%`, `${result.overagePercent}% overage`)],
      headers: [bilingual("组分", "Component"), bilingual("体积", "Volume")],
      rows: [[bilingual("母液", "Stock"), `${liquidNumber(result.stockVolumeUL)} µL`], [bilingual("稀释液", "Diluent"), `${liquidNumber(result.diluentVolumeUL)} µL`], [bilingual("合计", "Total"), `${liquidNumber(result.preparedVolumeUL)} µL`]],
      warnings: result.stockVolumeUL > 0 && result.stockVolumeUL < 1 ? [bilingual("母液移取体积低于默认 1 µL 阈值；建议先配制中间工作液。", "Stock transfer is below the default 1 µL threshold; prepare an intermediate working solution.")] : [],
      checklist: [bilingual("确认浓度类型与单位一致。", "Confirm concentration type and units."), bilingual(`移取 ${liquidNumber(result.stockVolumeUL)} µL 母液。`, `Transfer ${liquidNumber(result.stockVolumeUL)} µL stock.`), bilingual(`加入 ${liquidNumber(result.diluentVolumeUL)} µL 稀释液并混匀。`, `Add ${liquidNumber(result.diluentVolumeUL)} µL diluent and mix.`)],
    });
  }

  function transfectionGroups(values) {
    const targetWellIds = liquidTargetWellIds();
    if (!values.groupDimension) return [{ name: bilingual("全部目标孔", "All target wells"), count: Number(values.wellCount), wellIds: targetWellIds }];
    const groups = new Map();
    for (const wellId of liquidTargetWellIds()) {
      const group = String(currentWells()[wellId]?.params?.[values.groupDimension] ?? "").trim();
      if (!group) continue;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(wellId);
    }
    return groups.size ? [...groups].map(([name, wellIds]) => ({ name, count: wellIds.length, wellIds })) : [{ name: bilingual("全部目标孔", "All target wells"), count: Number(values.wellCount), wellIds: targetWellIds }];
  }

  function parseGroupRoles(text) {
    const roles = new Map();
    String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line, index) => {
      const parts = line.split("=").map((part) => part.trim());
      const [name, role] = parts;
      if (parts.length !== 2 || !name || !["Transfection", "Experimental", "Mock", "Untransfected", "Exclude"].includes(role)) throw new Error(bilingual(`分组角色第 ${index + 1} 行无效；请使用“组名=Transfection/Mock/Untransfected/Exclude”。`, `Group role line ${index + 1} is invalid; use Group=Transfection/Mock/Untransfected/Exclude.`));
      roles.set(name, role === "Experimental" ? "Transfection" : role);
    });
    return roles;
  }

  function parseGroupOverages(text) {
    const overages = new Map();
    String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line, index) => {
      const parts = line.split("=").map((part) => part.trim());
      const [name, percent] = parts;
      if (parts.length !== 2 || !name || !Number.isFinite(Number(percent)) || Number(percent) < 0) throw new Error(bilingual(`分组余量第 ${index + 1} 行无效；请使用“组名=非负百分比”。`, `Group overage line ${index + 1} is invalid; use Group=non-negative percent.`));
      overages.set(name, Number(percent));
    });
    return overages;
  }

  function parseTransfectionCargos(text) {
    return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
      const [name, type, stockConcentration, stockUnit, targetMode, targetValue, targetUnit, lengthBp, molecularWeight] = line.split(/[,，\t]/).map((value) => value.trim());
      if (!name || !["siRNA", "plasmid", "other"].includes(type)) throw new Error(bilingual(`目的物第 ${index + 1} 行格式无效。`, `Cargo line ${index + 1} is invalid.`));
      return { name, type, stockConcentration, stockUnit, targetMode, targetValue, targetUnit, lengthBp: lengthBp || undefined, molecularWeight: molecularWeight || undefined };
    });
  }

  function parseGroupCargoOverrides(text) {
    const rows = new Map();
    String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line, index) => {
      const divider = line.indexOf("|");
      if (divider < 1) throw new Error(bilingual(`分组目的物第 ${index + 1} 行缺少“组名|”。`, `Group cargo line ${index + 1} needs “Group|”.`));
      const group = line.slice(0, divider).trim();
      const cargoLine = line.slice(divider + 1).trim();
      if (!rows.has(group)) rows.set(group, []);
      rows.get(group).push(cargoLine);
    });
    return new Map([...rows].map(([group, lines]) => [group, lines.join("\n")]));
  }

  function parseTransfectionTubes(text) {
    const tubes = new Map();
    String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line, index) => {
      const [tubeName, volumePerWell, componentName, mode, value, cargoName, dilutable] = line.split(/[,，\t]/).map((part) => part.trim());
      if (!tubeName || !componentName || !["cargo", "fixed", "ratio-per-ug", "ratio-per-pmol", "ratio-volume", "diluent"].includes(mode)) throw new Error(bilingual(`预混管第 ${index + 1} 行格式无效。`, `Premix line ${index + 1} is invalid.`));
      if (!tubes.has(tubeName)) tubes.set(tubeName, { name: tubeName, volumePerWell, components: [] });
      const component = { kind: mode, name: componentName, dilutionAllowed: dilutable !== "no" };
      if (mode === "cargo") component.cargoName = cargoName || componentName;
      if (mode === "fixed") component.volumePerWell = value;
      if (["ratio-per-ug", "ratio-per-pmol", "ratio-volume"].includes(mode)) { component.ratio = value; component.cargoName = cargoName; }
      tubes.get(tubeName).components.push(component);
    });
    return [...tubes.values()];
  }

  function parseOptimizationVariants(values) {
    if (values.optimizationEnabled !== "on") return [{ name: "", cargoFactor: 1, reagentFactor: 1 }];
    const variants = String(values.optimizationLines || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
      const [name, cargoFactor, reagentFactor] = line.split(/[,，\t]/).map((part) => part.trim());
      if (!name || !(Number(cargoFactor) > 0) || !(Number(reagentFactor) > 0)) throw new Error(bilingual(`优化变体第 ${index + 1} 行格式无效。`, `Optimization variant ${index + 1} is invalid.`));
      return { name, cargoFactor: Number(cargoFactor), reagentFactor: Number(reagentFactor) };
    });
    if (!variants.length) throw new Error(bilingual("开启优化梯度后至少需要一个变体。", "At least one optimization variant is required when optimization is enabled."));
    return variants;
  }

  function transfectionDefinition(values, mock = false, groupName = "", variant = { cargoFactor: 1, reagentFactor: 1 }) {
    let cargos;
    let tubes;
    if (["lipo3000-combo", "custom-one", "custom-two"].includes(values.preset)) {
      const groupCargoText = parseGroupCargoOverrides(values.groupCargoLines).get(groupName);
      cargos = parseTransfectionCargos(groupCargoText || values.cargoLines);
      tubes = parseTransfectionTubes(values.tubeLines);
    } else if (values.preset === "lipo3000") {
      cargos = [{ name: values.cargoName, type: "plasmid", stockConcentration: values.stockConcentration, stockUnit: values.stockUnit, targetMode: "mass-per-well", targetValue: values.targetValue, targetUnit: values.targetUnit, lengthBp: values.lengthBp || undefined }];
      tubes = [
        { name: "A", volumePerWell: Number(values.complexVolume) / 2, components: [{ kind: "cargo", cargoName: values.cargoName }, { kind: "ratio-per-ug", name: "P3000", ratio: values.p3000PerUg, cargoName: values.cargoName, dilutionAllowed: false }, { kind: "diluent", name: "Opti-MEM" }] },
        { name: "B", volumePerWell: Number(values.complexVolume) / 2, components: [{ kind: "fixed", name: "Lipofectamine 3000", volumePerWell: values.reagentPerWell, dilutionAllowed: false }, { kind: "diluent", name: "Opti-MEM" }] },
      ];
    } else {
      const cargoName = values.groupDimension && groupName ? groupName : values.cargoName;
      cargos = [{ name: cargoName, type: "siRNA", stockConcentration: values.stockConcentration, stockUnit: values.stockUnit, targetMode: "final-concentration", targetValue: values.targetValue, targetUnit: values.targetUnit }];
      tubes = [
        { name: "A", volumePerWell: Number(values.complexVolume) / 2, components: [{ kind: "cargo", cargoName }, { kind: "diluent", name: "Opti-MEM" }] },
        { name: "B", volumePerWell: Number(values.complexVolume) / 2, components: [{ kind: "fixed", name: "RNAiMAX", volumePerWell: values.reagentPerWell, dilutionAllowed: false }, { kind: "diluent", name: "Opti-MEM" }] },
      ];
    }
    cargos = cargos.map((cargo) => ({
      ...cargo,
      targetValue: ["mass-ratio", "molar-ratio"].includes(cargo.targetMode) ? cargo.targetValue : Number(cargo.targetValue) * variant.cargoFactor,
    }));
    tubes = tubes.map((tube) => ({
      ...tube,
      components: tube.components.map((component) => ["fixed", "ratio-per-ug", "ratio-per-pmol", "ratio-volume"].includes(component.kind)
        ? { ...component, ...(component.kind === "fixed" ? { volumePerWell: Number(component.volumePerWell) * variant.reagentFactor } : { ratio: Number(component.ratio) * variant.reagentFactor }) }
        : { ...component }),
    }));
    if (mock) {
      cargos = [];
      tubes = tubes.map((tube) => ({ ...tube, components: tube.components.filter((component) => !["cargo", "ratio-per-ug", "ratio-per-pmol", "ratio-volume"].includes(component.kind)) }));
    }
    return { cargos, tubes };
  }

  function calculateTransfectionLiquid(values) {
    const groups = transfectionGroups(values);
    const roles = parseGroupRoles(values.groupRoleLines);
    const groupOverages = parseGroupOverages(values.groupOverageLines);
    const variants = parseOptimizationVariants(values);
    const rows = [];
    const warnings = [];
    const meta = [];
    const groupResults = [];
    for (const group of groups) {
      const role = roles.get(group.name) || "Transfection";
      if (["Untransfected", "Exclude"].includes(role)) {
        meta.push(`${group.name}: ${role} · ${group.count} ${bilingual("孔不配转染液", "wells excluded from mix")}`);
        continue;
      }
      for (const variant of variants) {
        const displayGroup = variant.name ? { ...group, name: `${group.name} · ${variant.name}` } : group;
        const definition = transfectionDefinition(values, role === "Mock", group.name, variant);
        const result = Liquid.calculateGenericTransfection({ wellCount: group.count, overagePercent: groupOverages.get(group.name) ?? values.overagePercent, finalVolume: values.finalVolume, complexVolume: values.complexVolume, minimumPipetteVolume: values.minimumPipetteVolume, applyWorkingSolutions: values.workingSolutionMode === "apply", direction: values.direction, preset: values.preset, totalCargoMass: Number(values.totalCargoMass || 0) * variant.cargoFactor, totalCargoMassUnit: values.totalCargoMassUnit, totalCargoAmount: Number(values.totalCargoAmount || 0) * variant.cargoFactor, totalCargoAmountUnit: values.totalCargoAmountUnit, ...definition });
        groupResults.push({ group: displayGroup, role, result });
        meta.push(`${displayGroup.name}: ${role} · ${group.count} ${bilingual("孔", "wells")} → ${result.equivalents} ${bilingual("孔当量", "well equivalents")}`);
        result.warnings.forEach((warning) => warnings.push(bilingual(`${displayGroup.name}：${warning.component} 实际移取 ${liquidNumber(warning.volumeUL)} µL，低于 ${values.minimumPipetteVolume} µL。${warning.dilutionAllowed ? "可考虑中间工作液。" : "仅提示，不自动稀释该试剂。"}`, `${displayGroup.name}: ${warning.component} transfer ${liquidNumber(warning.volumeUL)} µL is below ${values.minimumPipetteVolume} µL. ${warning.dilutionAllowed ? "Consider an intermediate working solution." : "Warning only; do not auto-dilute this reagent."}`)));
        result.workingSolutions.forEach((working) => warnings.push(bilingual(`${displayGroup.name}：${working.component} 建议 ${working.dilutionFactor}× 中间工作液（${working.applied ? "已确认应用" : "尚未应用"}）。`, `${displayGroup.name}: ${working.dilutionFactor}× working solution proposed for ${working.component} (${working.applied ? "confirmed and applied" : "not applied"}).`)));
      }
    }
    if (values.mergeCommonMix === "on" && values.optimizationEnabled !== "on" && groupResults.length > 1) {
      const commonKeys = Liquid.commonTransfectionComponents(groupResults.map(({ result }) => result));
      for (const key of commonKeys) {
        const [tube, component] = key.split("\u0000");
        const matching = groupResults.map(({ result }) => result.totals.find((row) => row.tube === tube && row.component === component));
        rows.push([bilingual("公共 Master Mix", "Common master mix"), tube, component, `${liquidNumber(matching[0].volumeUL)} µL`, `${liquidNumber(matching.reduce((sum, row) => sum + row.totalVolumeUL, 0))} µL`]);
      }
      groupResults.forEach(({ group, result }) => result.totals.filter((row) => !commonKeys.includes(`${row.tube}\u0000${row.component}`)).forEach((row) => rows.push([group.name, row.tube, row.component, `${liquidNumber(row.volumeUL)} µL`, `${liquidNumber(row.totalVolumeUL)} µL`])));
    } else {
      groupResults.forEach(({ group, result }) => result.totals.forEach((row) => rows.push([group.name, row.tube, row.component, `${liquidNumber(row.volumeUL)} µL`, `${liquidNumber(row.totalVolumeUL)} µL`])));
    }
    if (values.optimizationEnabled === "on") warnings.push(bilingual(`优化梯度已开启：已生成 ${variants.length} 个独立变体，不自动合并 Master Mix。`, `Optimization is enabled: ${variants.length} independent variants were generated and were not merged.`));
    const customChecklist = values.protocolMode === "custom" ? String(values.protocolSteps || "").split(/\r?\n/).map((step) => step.trim()).filter(Boolean) : [];
    const generatedProtocols = groupResults.map(({ group, result }) => LiquidPlan.buildTransfectionProtocol({ language, preset: values.preset, direction: values.direction, groupName: groupResults.length > 1 ? group.name : "", result }));
    const checklist = customChecklist.length ? customChecklist : [...new Set(generatedProtocols.flat())];
    const recipeName = values.preset === "rnai" ? "RNAiMAX + siRNA" : values.preset === "lipo3000" ? "Lipofectamine 3000 + plasmid" : bilingual("自定义转染体系", "Custom transfection system");
    const executionGroups = groupResults.map(({ group, role, result }, index) => ({ ...group, role, result, protocolSteps: customChecklist.length ? customChecklist : generatedProtocols[index] }));
    renderLiquidResult({
      module: "transfection", input: values, meta,
      headers: [bilingual("组", "Group"), bilingual("管", "Tube"), bilingual("组分", "Component"), bilingual("每孔", "Per well"), bilingual("Master Mix", "Master mix")], rows, warnings,
      checklist,
      calculation: groupResults[0]?.result,
      executionGroups,
      recipeName,
    });
  }

  function calculateSerialLiquid(values) {
    const concentrations = Liquid.generateConcentrationSeries(values);
    const result = Liquid.calculateGradientPreparation({ ...values, concentrations });
    const direct = Liquid.calculateGradientPreparation({ ...values, concentrations, strategy: "direct" });
    const serial = Liquid.calculateGradientPreparation({ ...values, concentrations, strategy: "serial" });
    const minimum = Number(values.minimumPipetteVolume) || 1;
    const warnings = result.rows.filter((row) => row.transferVolumeUL > 0 && row.transferVolumeUL < minimum).map((row) => bilingual(`第 ${row.level} 级转移体积 ${liquidNumber(row.transferVolumeUL)} µL，低于 ${minimum} µL。`, `Level ${row.level} transfer ${liquidNumber(row.transferVolumeUL)} µL is below ${minimum} µL.`));
    pendingSerialLayout = null;
    if (values.mapToPlate === "on") {
      const replicates = Math.max(1, Math.floor(Number(values.replicates) || 1));
      const requested = concentrations.flatMap((concentration, level) => Array.from({ length: replicates }, (_, index) => ({ drug: bilingual("浓度梯度", "Concentration series"), concentration, replicate: index + 1, level: level + 1, controlType: "gradient" })));
      const allIds = Core.makeWellIds(project.plateSize);
      const scoped = selection.size ? [...selection] : allIds;
      const candidates = scoped.filter((wellId) => !currentWells()[wellId] || !Object.keys(currentWells()[wellId].params || {}).length);
      const occupiedCount = scoped.length - candidates.length;
      if (occupiedCount) warnings.push(bilingual(`已从预览中排除 ${occupiedCount} 个已有内容的孔。`, `${occupiedCount} populated wells were excluded from the preview.`));
      if (requested.length > candidates.length) warnings.push(bilingual(`排板需要 ${requested.length} 个孔，当前仅有 ${candidates.length} 个可用孔。`, `Layout needs ${requested.length} wells but only ${candidates.length} are available.`));
      else pendingSerialLayout = requested.map((item, index) => ({ wellId: candidates[index], ...item }));
    }
    renderLiquidResult({
      module: "serial", input: values,
      meta: [bilingual(`${concentrations.length} 个浓度点`, `${concentrations.length} concentrations`), result.strategy === "serial" ? bilingual("逐级稀释", "Stepwise serial") : bilingual("直接配液", "Direct preparation"), bilingual(`母液消耗比较：直接 ${liquidNumber(direct.stockConsumptionUL)} µL；逐级 ${liquidNumber(serial.stockConsumptionUL)} µL`, `Stock-use comparison: direct ${liquidNumber(direct.stockConsumptionUL)} µL; serial ${liquidNumber(serial.stockConsumptionUL)} µL`)],
      headers: [bilingual("级别", "Level"), bilingual("目标浓度", "Target concentration"), bilingual("来源", "Source"), bilingual("转移体积", "Transfer"), bilingual("稀释液", "Diluent"), bilingual("本级配制总量", "Prepared at this level"), bilingual("最终保留", "Final retained")],
      rows: result.rows.map((row) => [row.level, liquidNumber(row.concentration, 8), row.source === "stock" ? bilingual("母液", "Stock") : row.source, `${liquidNumber(row.transferVolumeUL)} µL`, `${liquidNumber(row.diluentVolumeUL)} µL`, `${liquidNumber(row.totalVolumeUL)} µL`, `${liquidNumber(row.retainedVolumeUL ?? row.totalVolumeUL)} µL`]), warnings,
      checklist: result.rows.map((row) => bilingual(`第 ${row.level} 级：从${row.source === "stock" ? "母液" : `第 ${row.level - 1} 级`}移取 ${liquidNumber(row.transferVolumeUL)} µL，加入 ${liquidNumber(row.diluentVolumeUL)} µL 稀释液；${row.downstreamTransferUL ? `再向下一级转移 ${liquidNumber(row.downstreamTransferUL)} µL，` : ""}最终保留 ${liquidNumber(row.retainedVolumeUL ?? row.totalVolumeUL)} µL。`, `Level ${row.level}: transfer ${liquidNumber(row.transferVolumeUL)} µL from ${row.source === "stock" ? "stock" : `level ${row.level - 1}`} and add ${liquidNumber(row.diluentVolumeUL)} µL diluent; ${row.downstreamTransferUL ? `transfer ${liquidNumber(row.downstreamTransferUL)} µL to the next level, then ` : ""}retain ${liquidNumber(row.retainedVolumeUL ?? row.totalVolumeUL)} µL.`)),
      layout: pendingSerialLayout || [], canApplyLayout: Boolean(pendingSerialLayout), applyAction: "apply-serial-layout", applyLabel: bilingual("确认写入浓度系列", "Confirm concentration layout"),
    });
  }

  function parseDrugLines(text, direction, defaultDosingVolume) {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) throw new Error(bilingual("请至少填写一种药物。", "Enter at least one drug."));
    return lines.map((line, index) => {
      const parts = line.split(/[,，\t]/).map((value) => value.trim());
      const [name, stock, high, low, points] = parts;
      if (!name) throw new Error(bilingual(`第 ${index + 1} 行缺少药物名称。`, `Drug line ${index + 1} needs a name.`));
      if (["fold", "range"].includes(parts[5])) {
        const method = parts[5];
        return { name, stockConcentration: Number(stock), high: Number(high), low: Number(low), points: Number(points), method, ...(method === "fold" ? { fold: Number(parts[6]) } : { scale: parts[6] === "linear" ? "linear" : "log" }), replicates: Number(parts[7]), dosingVolume: Number(parts[8] || defaultDosingVolume), vehicle: parts[9] || "DMSO", stockVehiclePercent: Number(parts[10] || 100), direction };
      }
      return { name, stockConcentration: Number(stock), high: Number(high), low: Number(low), points: Number(points), fold: Number(parts[5]), replicates: Number(parts[6]), dosingVolume: Number(defaultDosingVolume), vehicle: "DMSO", stockVehiclePercent: 100, method: "fold", direction };
    });
  }

  function calculateDrugLiquid(values) {
    const drugs = parseDrugLines(values.drugLines, values.direction, values.dosingVolume);
    const targetIds = selection.size ? [...selection] : Core.makeWellIds(project.plateSize);
    const occupied = targetIds.filter((wellId) => currentWells()[wellId] && Object.keys(currentWells()[wellId].params || {}).length);
    const fixedControlWellIds = String(values.fixedControlWells || "").split(/[\s,，;；]+/).map((value) => value.trim().toUpperCase()).filter(Boolean);
    const layout = Liquid.planDrugGradientLayout({ plateSize: project.plateSize, wellIds: targetIds, occupiedWellIds: occupied, orientation: values.orientation, drugs, disperseReplicates: values.disperseReplicates === "on", avoidEdges: values.avoidEdges === "on", edgeFill: values.edgeFill, controlsPerDrug: values.controlsPerDrug, controlPosition: values.controlPosition, fixedControlWellIds });
    const rows = [];
    for (const drug of drugs) {
      const concentrations = Liquid.generateConcentrationSeries(drug);
      const preparation = Liquid.calculateDrugDosingPreparation({ concentrations, stockConcentration: drug.stockConcentration, preparationVolume: values.volumePerLevel, dosingVolume: drug.dosingVolume, finalWellVolume: values.finalWellVolume, stockVehiclePercent: drug.stockVehiclePercent, overagePercent: values.overagePercent });
      preparation.rows.forEach((row) => rows.push([drug.name, row.level, liquidNumber(row.concentration, 8), liquidNumber(row.dosingSolutionConcentration, 8), `${liquidNumber(row.stockVolumeUL)} µL`, `${liquidNumber(row.diluentVolumeUL)} µL`, `${liquidNumber(drug.dosingVolume)} µL`, drug.vehicle, `${liquidNumber(row.finalVehiclePercent, 6)}%`]));
    }
    const warnings = [];
    if (layout.error) warnings.push(bilingual(`孔位不足：需要 ${layout.required} 个可用孔，当前仅有 ${layout.available} 个；建议至少使用 ${layout.platesNeeded} 块同规格孔板。未生成部分排板。`, `Insufficient capacity: ${layout.required} usable wells are required and ${layout.available} are available; use at least ${layout.platesNeeded} plates of this format. No partial layout was generated.`));
    pendingDrugLayout = layout.error ? null : [...layout.assignments, ...(layout.fillAssignments || [])];
    renderLiquidResult({
      module: "drug", input: values,
      meta: [bilingual(`${drugs.length} 种独立药物`, `${drugs.length} independent drugs`), bilingual(`排除 ${occupied.length} 个已有内容的孔`, `${occupied.length} populated wells excluded`)],
      headers: [bilingual("药物", "Drug"), bilingual("级别", "Level"), bilingual("孔内目标浓度", "Final well concentration"), bilingual("加药液浓度", "Dosing-solution concentration"), bilingual("母液体积", "Stock volume"), bilingual("稀释液", "Diluent"), bilingual("每孔加药", "Dose per well"), bilingual("溶剂", "Vehicle"), bilingual("孔内溶剂终比例", "Final vehicle fraction")], rows, warnings,
      checklist: [bilingual("分别配制每种药物的浓度系列。", "Prepare each drug concentration series independently."), bilingual("核对溶剂终浓度，并设置相应 vehicle control。", "Review final vehicle concentration and include the appropriate vehicle control."), bilingual("检查排板预览；确认后再写入孔板。", "Review the layout preview before writing to the plate.")],
      layout: pendingDrugLayout || [], canApplyLayout: Boolean(pendingDrugLayout), drugs,
    });
  }

  function ensureLiquidDimension(name, type, unit = "") {
    const normalized = name.toLowerCase();
    let dimension = project.dimensions.find((item) => item.name.toLowerCase() === normalized);
    if (!dimension) {
      dimension = { id: `dimension_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, name, type, unit };
      project.dimensions.push(dimension);
    }
    return dimension.id;
  }

  function applyDrugLayout() {
    if (!pendingDrugLayout?.length) return;
    const assignments = pendingDrugLayout.map((item) => ({ ...item }));
    commit(() => {
      const drugId = ensureLiquidDimension(bilingual("药物", "Drug"), "text");
      const concentrationId = ensureLiquidDimension(bilingual("药物浓度", "Drug concentration"), "number");
      const replicateId = ensureLiquidDimension(bilingual("药物复孔", "Drug replicate"), "number");
      const controlId = ensureLiquidDimension(bilingual("对照类型", "Control type"), "text");
      for (const item of assignments) {
        const existing = currentWells()[item.wellId];
        if (existing && Object.keys(existing.params || {}).length) continue;
        currentWells()[item.wellId] = { params: { [drugId]: item.drug, [concentrationId]: item.concentration, [replicateId]: item.replicate, [controlId]: item.controlType } };
      }
      project.colorDimension = drugId;
    });
    selection = new Set(assignments.map((item) => item.wellId));
    selectionAnchor = assignments[0]?.wellId || null;
    renderAll();
    closeLiquidDrawer();
    showToast(bilingual(`已将 ${assignments.length} 个处理孔写入孔板`, `Wrote ${assignments.length} treatment wells to the plate`));
  }

  function applySerialLayout() {
    if (!pendingSerialLayout?.length) return;
    const assignments = pendingSerialLayout.map((item) => ({ ...item }));
    commit(() => {
      const levelId = ensureLiquidDimension(bilingual("梯度级别", "Gradient level"), "number");
      const concentrationId = ensureLiquidDimension(bilingual("目标浓度", "Target concentration"), "number");
      const replicateId = ensureLiquidDimension(bilingual("梯度复孔", "Gradient replicate"), "number");
      for (const item of assignments) {
        const existing = currentWells()[item.wellId];
        if (existing && Object.keys(existing.params || {}).length) continue;
        currentWells()[item.wellId] = { params: { [levelId]: item.level, [concentrationId]: item.concentration, [replicateId]: item.replicate } };
      }
      project.colorDimension = concentrationId;
    });
    selection = new Set(assignments.map((item) => item.wellId));
    selectionAnchor = assignments[0]?.wellId || null;
    renderAll();
    closeLiquidDrawer();
    showToast(bilingual(`已将 ${assignments.length} 个浓度孔写入孔板`, `Wrote ${assignments.length} concentration wells to the plate`));
  }

  function liquidTableText(result, delimiter = "\t") {
    return [result.headers, ...(result.rows || [])].map((row) => row.map((cell) => String(cell ?? "")).join(delimiter)).join("\n");
  }

  function updateSelectionVisuals(refreshEditor = true) {
    resetClearConfirmation();
    if (refreshEditor) pendingBatchPaste = null;
    elements.plateGrid.querySelectorAll(".well").forEach((well) => {
      const selected = selection.has(well.dataset.well);
      well.classList.toggle("selected", selected);
      well.setAttribute("aria-pressed", String(selected));
    });
    elements.selectionCount.textContent = t("selectedCount", { n: selection.size });
    elements.editorSelectionCount.textContent = t("wellsCount", { n: selection.size });
    elements.clearSelectionButton.disabled = !selection.size;
    elements.clearWellsButton.disabled = !selection.size;
    if (refreshEditor) renderSelectionEditor();
    updateCalculationGuide();
    renderLiquidScopeBadge();
  }

  function resetClearConfirmation() {
    window.clearTimeout(clearConfirmationTimer);
    clearConfirmationTimer = null;
    elements.clearWellsButton.classList.remove("confirming");
    elements.clearWellsButton.textContent = t("clearWells");
    elements.clearWellsButton.removeAttribute("aria-live");
  }

  function renderAll() {
    colorRegistryCache = new Map();
    applyLanguage();
    renderWorkspaceChrome();
    elements.projectName.value = project.name;
    document.querySelectorAll(".plate-option").forEach((button) => button.classList.toggle("active", Number(button.dataset.size) === project.plateSize));
    renderPlate();
    renderDimensions();
    renderSelectionEditor();
    renderSelectOptions();
    renderCalculationOutputs();
    renderSavedLiquidPlans();
    updateSelectionVisuals(false);
    const history = historyFor();
    elements.undoButton.disabled = !history.undo.length && !workspaceUndoStack.length;
    elements.redoButton.disabled = !history.redo.length && !workspaceRedoStack.length;
  }

  function switchActivePlate(plateId, { closeOverview = false } = {}) {
    const next = workspace.plates.find((plate) => plate.id === plateId);
    if (!next || next.id === project.id) {
      if (closeOverview) { overviewOpen = false; renderAll(); }
      return;
    }
    workspace.activePlateId = next.id;
    project = next;
    selection = new Set();
    selectionAnchor = null;
    pendingBatchPaste = null;
    lastLiquidResult = null;
    pendingDrugLayout = null;
    pendingSerialLayout = null;
    if (closeOverview) overviewOpen = false;
    saveProject();
    renderAll();
  }

  function compatibleOverviewDimensions() {
    const candidates = new Map();
    for (const plate of workspace.plates) {
      for (const dimension of plate.dimensions) {
        const key = dimension.name.trim().toLowerCase();
        if (!candidates.has(key)) candidates.set(key, { name: dimension.name, type: dimension.type, unit: dimension.unit || "", compatible: true });
        else {
          const existing = candidates.get(key);
          if (existing.type !== dimension.type || (existing.type === "number" && existing.unit !== (dimension.unit || ""))) existing.compatible = false;
        }
      }
    }
    return [...candidates.values()].filter((item) => item.compatible).sort((left, right) => left.name.localeCompare(right.name, language === "en" ? "en" : "zh-CN"));
  }

  function renderWorkspaceChrome() {
    elements.workspaceName.value = workspace.name;
    elements.workspaceNameLabel.textContent = bilingual("项目名称", "Project name");
    elements.addPlateButton.textContent = bilingual("＋ 新建板", "+ New plate");
    elements.duplicatePlateButton.textContent = bilingual("复制整板", "Duplicate plate");
    elements.copyStructureButton.textContent = bilingual("仅复制参数", "Copy parameters");
    document.querySelector(".workspace-export-label").textContent = bilingual("整个项目", "Whole project");
    elements.xlsxOrderSelect.options[0].textContent = bilingual("N 序", "N order");
    elements.xlsxOrderSelect.options[1].textContent = bilingual("Z 序", "Z order");
    elements.xlsxOrderSelect.title = bilingual("XLSX 加样顺序（默认 N）", "XLSX pipetting order (N by default)");
    elements.overviewToggleButton.textContent = overviewOpen ? bilingual("返回单板", "Single plate") : bilingual("全部板概览", "All plates");
    elements.plateOverviewTitle.textContent = bilingual("全部板概览", "All plates overview");
    elements.plateOverviewDescription.textContent = bilingual("点击任意缩略孔板进入精细编辑。", "Open any miniature plate for detailed editing.");
    elements.overviewColorLabel.textContent = bilingual("统一按参数着色", "Shared color parameter");
    elements.plateTabs.innerHTML = workspace.plates.map((plate) => `<button class="plate-tab${plate.id === project.id ? " active" : ""}" type="button" role="tab" aria-selected="${plate.id === project.id}" data-plate-id="${escapeHtml(plate.id)}"><span>${escapeHtml(plate.name)}</span><small>${plate.plateSize}</small></button>`).join("");
    elements.plateTabs.querySelectorAll("[data-plate-id]").forEach((button) => button.addEventListener("click", () => switchActivePlate(button.dataset.plateId)));
    const index = workspace.plates.findIndex((plate) => plate.id === project.id);
    elements.movePlateLeftButton.disabled = index <= 0;
    elements.movePlateRightButton.disabled = index < 0 || index >= workspace.plates.length - 1;
    elements.addPlateButton.disabled = workspace.plates.length >= 24;
    elements.duplicatePlateButton.disabled = workspace.plates.length >= 24;
    elements.copyStructureButton.disabled = workspace.plates.length >= 24;
    elements.plateOverview.hidden = !overviewOpen;
    renderProjectLiquidControls();
    if (workspace.latestLiquidSummary) renderProjectLiquidSummary(workspace.latestLiquidSummary);
    if (overviewOpen) renderPlateOverview();
  }

  function renderPlateOverview() {
    const dimensions = compatibleOverviewDimensions();
    if (!dimensions.some((item) => item.name === overviewColorName)) overviewColorName = dimensions.find((item) => item.name.toLowerCase() === "处理" || item.name.toLowerCase() === "treatment")?.name || dimensions[0]?.name || "";
    elements.overviewColorDimension.innerHTML = `<option value="">${bilingual("不着色", "No color")}</option>${dimensions.map((item) => `<option value="${escapeHtml(item.name)}"${item.name === overviewColorName ? " selected" : ""}>${escapeHtml(item.name)}${item.unit ? ` (${escapeHtml(item.unit)})` : ""}</option>`).join("")}`;
    elements.plateOverviewGrid.innerHTML = workspace.plates.map((plate) => {
      const spec = Core.getSpec(plate.plateSize);
      const wells = plate.plates[plate.plateSize];
      const dimension = plate.dimensions.find((item) => item.name === overviewColorName);
      const miniWells = Core.makeWellIds(plate.plateSize).map((wellId) => {
        const value = dimension ? wells[wellId]?.params?.[dimension.id] : "";
        const filled = wells[wellId] && Object.values(wells[wellId].params || {}).some((item) => item !== "" && item !== undefined);
        const background = value !== "" && value !== undefined ? colorFor(value, overviewColorName)[0] : filled ? "#dfe9e7" : "#f8f5f0";
        return `<i class="overview-mini-well" style="background:${background}" title="${wellId}${value !== "" && value !== undefined ? ` · ${escapeHtml(value)}` : ""}"></i>`;
      }).join("");
      return `<button class="overview-plate${plate.id === project.id ? " active" : ""}" type="button" data-overview-plate="${escapeHtml(plate.id)}"><span class="overview-plate-heading"><strong>${escapeHtml(plate.name)}</strong><span>${plate.plateSize} ${bilingual("孔", "well")}</span></span><span class="overview-mini-grid" style="grid-template-columns:repeat(${spec.columns},1fr)">${miniWells}</span><span class="overview-plate-meta">${Object.keys(wells).length} / ${plate.plateSize} ${bilingual("孔已有信息", "wells assigned")}</span></button>`;
    }).join("");
    elements.plateOverviewGrid.querySelectorAll("[data-overview-plate]").forEach((button) => button.addEventListener("click", () => switchActivePlate(button.dataset.overviewPlate, { closeOverview: true })));
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
  }

  function resetPlateDeleteConfirmation() {
    window.clearTimeout(plateDeleteTimer);
    plateDeleteTimer = null;
    elements.deletePlateButton.classList.remove("confirming");
    elements.deletePlateButton.textContent = "×";
    elements.deletePlateButton.setAttribute("aria-label", bilingual("删除当前孔板", "Delete current plate"));
  }

  elements.workspaceName.addEventListener("input", () => {
    workspace.name = elements.workspaceName.value.slice(0, 80);
    saveProject();
  });
  elements.workspaceName.addEventListener("keydown", (event) => { if (event.key === "Enter") elements.workspaceName.blur(); });
  elements.workspaceName.addEventListener("blur", () => {
    workspace.name = elements.workspaceName.value.trim() || bilingual("未命名项目", "Untitled project");
    elements.workspaceName.value = workspace.name;
    saveProject();
  });
  elements.addPlateButton.addEventListener("click", () => {
    commitWorkspace(() => { workspace = Workspace.addPlate(workspace, { name: bilingual(`孔板 ${workspace.plates.length + 1}`, `Plate ${workspace.plates.length + 1}`), plateSize: project.plateSize }); });
    showToast(bilingual("已新建空白孔板", "Blank plate created"));
  });
  elements.duplicatePlateButton.addEventListener("click", () => {
    const sourceId = project.id;
    commitWorkspace(() => { workspace = Workspace.duplicatePlate(workspace, sourceId, "full"); });
    showToast(bilingual("已复制参数与孔位赋值，不含历史计算", "Plate values copied without calculation history"));
  });
  elements.copyStructureButton.addEventListener("click", () => {
    const sourceId = project.id;
    commitWorkspace(() => { workspace = Workspace.duplicatePlate(workspace, sourceId, "structure"); });
    showToast(bilingual("已复制参数结构，孔位保持为空", "Parameter structure copied with empty wells"));
  });
  elements.movePlateLeftButton.addEventListener("click", () => {
    const plateId = project.id;
    commitWorkspace(() => { workspace = Workspace.reorderPlate(workspace, plateId, -1); });
  });
  elements.movePlateRightButton.addEventListener("click", () => {
    const plateId = project.id;
    commitWorkspace(() => { workspace = Workspace.reorderPlate(workspace, plateId, 1); });
  });
  elements.deletePlateButton.addEventListener("click", () => {
    if (workspace.plates.length <= 1) {
      showToast(bilingual("项目必须至少保留一块孔板", "A project must keep at least one plate"));
      return;
    }
    if (!plateDeleteTimer) {
      elements.deletePlateButton.classList.add("confirming");
      elements.deletePlateButton.textContent = bilingual("确认", "Sure?");
      plateDeleteTimer = window.setTimeout(resetPlateDeleteConfirmation, 5000);
      return;
    }
    const plateId = project.id;
    resetPlateDeleteConfirmation();
    commitWorkspace(() => { workspace = Workspace.removePlate(workspace, plateId); });
    showToast(bilingual("孔板已删除，可使用撤销恢复", "Plate deleted; undo can restore it"));
  });
  elements.overviewToggleButton.addEventListener("click", () => { overviewOpen = !overviewOpen; renderAll(); });
  elements.overviewColorDimension.addEventListener("change", () => { overviewColorName = elements.overviewColorDimension.value; renderPlateOverview(); });

  function cleanWellMap(wellMap, wellId) {
    const params = wellMap[wellId]?.params || {};
    const hasValue = Object.values(params).some((value) => value !== undefined && value !== "");
    if (!hasValue) delete wellMap[wellId];
  }

  document.querySelectorAll(".plate-option").forEach((button) => {
    button.addEventListener("click", () => {
      const nextSize = Number(button.dataset.size);
      if (nextSize === project.plateSize) return;
      commit(() => { project.plateSize = nextSize; });
      selection = new Set();
      selectionAnchor = null;
      renderAll();
    });
  });

  elements.projectName.addEventListener("input", () => {
    project.name = elements.projectName.value.slice(0, 80);
    saveProject();
  });
  elements.projectName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") elements.projectName.blur();
  });
  elements.projectName.addEventListener("blur", () => {
    const normalizedName = elements.projectName.value.trim() || t("defaultProject");
    project.name = normalizedName;
    elements.projectName.value = normalizedName;
    saveProject();
    const activeTabName = elements.plateTabs.querySelector(`[data-plate-id="${CSS.escape(project.id)}"] span`);
    if (activeTabName) activeTabName.textContent = normalizedName;
  });

  elements.colorDimension.addEventListener("change", () => {
    commit(() => { project.colorDimension = elements.colorDimension.value; });
  });

  elements.selectAllButton.addEventListener("click", () => {
    selection = new Set(Core.makeWellIds(project.plateSize));
    selectionAnchor = Core.makeWellIds(project.plateSize)[0];
    updateSelectionVisuals();
  });

  elements.invertSelectionButton.addEventListener("click", () => {
    selection = new Set(Core.makeWellIds(project.plateSize).filter((wellId) => !selection.has(wellId)));
    selectionAnchor = [...selection][0] || null;
    updateSelectionVisuals();
  });

  elements.clearSelectionButton.addEventListener("click", () => {
    selection = new Set();
    selectionAnchor = null;
    updateSelectionVisuals();
  });

  elements.clearWellsButton.addEventListener("click", () => {
    if (!selection.size) return;
    const occupied = [...selection].filter((wellId) => currentWells()[wellId]).length;
    if (occupied && !elements.clearWellsButton.classList.contains("confirming")) {
      elements.clearWellsButton.classList.add("confirming");
      elements.clearWellsButton.textContent = t("confirmClear", { n: occupied });
      elements.clearWellsButton.setAttribute("aria-live", "polite");
      clearConfirmationTimer = window.setTimeout(resetClearConfirmation, 4000);
      return;
    }
    resetClearConfirmation();
    commit(() => {
      for (const wellId of selection) delete currentWells()[wellId];
    });
    showToast(bilingual(`已清空 ${selection.size} 个所选孔`, `Cleared ${selection.size} selected wells`));
  });

  document.addEventListener("pointerdown", (event) => {
    if (clearConfirmationTimer && !event.target.closest("#clearWellsButton")) resetClearConfirmation();
    if (dimensionDeleteTimer && !event.target.closest(".dimension-delete")) resetDimensionDeleteConfirmation();
    if (importConfirmationTimer && !event.target.closest("#confirmImportButton")) resetImportConfirmation();
    if (calculationDeleteTimer && !event.target.closest('.calculation-output-delete[data-action="delete"]')) resetCalculationDeleteConfirmation();
  });

  elements.plateCanvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const well = event.target.closest(".well");
    pointerSession = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWell: well?.dataset.well || null,
      additive: event.ctrlKey || event.metaKey,
      shiftKey: event.shiftKey,
      original: new Set(selection),
      dragging: false,
    };
    elements.plateCanvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  elements.plateCanvas.addEventListener("pointermove", (event) => {
    if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;
    const distance = Math.hypot(event.clientX - pointerSession.startX, event.clientY - pointerSession.startY);
    if (distance < 5 && !pointerSession.dragging) return;
    pointerSession.dragging = true;
    const canvasRect = elements.plateCanvas.getBoundingClientRect();
    const minX = Math.min(pointerSession.startX, event.clientX);
    const maxX = Math.max(pointerSession.startX, event.clientX);
    const minY = Math.min(pointerSession.startY, event.clientY);
    const maxY = Math.max(pointerSession.startY, event.clientY);
    Object.assign(elements.selectionBox.style, {
      left: `${minX - canvasRect.left}px`,
      top: `${minY - canvasRect.top}px`,
      width: `${maxX - minX}px`,
      height: `${maxY - minY}px`,
    });
    elements.selectionBox.hidden = false;
    const next = pointerSession.additive ? new Set(pointerSession.original) : new Set();
    elements.plateGrid.querySelectorAll(".well").forEach((well) => {
      const rect = well.getBoundingClientRect();
      const intersects = rect.right >= minX && rect.left <= maxX && rect.bottom >= minY && rect.top <= maxY;
      if (intersects) next.add(well.dataset.well);
    });
    selection = next;
    updateSelectionVisuals(false);
  });

  function finishPointer(event) {
    if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;
    const session = pointerSession;
    pointerSession = null;
    elements.selectionBox.hidden = true;
    if (!session.dragging && session.startWell) {
      if (session.shiftKey && selectionAnchor) {
        const range = Core.rangeSelection(project.plateSize, selectionAnchor, session.startWell);
        selection = session.additive ? new Set([...session.original, ...range]) : new Set(range);
      } else if (session.additive) {
        selection = new Set(session.original);
        if (selection.has(session.startWell)) selection.delete(session.startWell);
        else selection.add(session.startWell);
        selectionAnchor = session.startWell;
      } else {
        selection = new Set([session.startWell]);
        selectionAnchor = session.startWell;
      }
      const button = elements.plateGrid.querySelector(`[data-well="${session.startWell}"]`);
      button?.focus({ preventScroll: true });
    } else if (!session.dragging) {
      selection = new Set();
      selectionAnchor = null;
    } else if (session.dragging) {
      selectionAnchor = [...selection].at(-1) || selectionAnchor;
    }
    updateSelectionVisuals();
  }

  elements.plateCanvas.addEventListener("pointerup", finishPointer);
  elements.plateCanvas.addEventListener("pointercancel", finishPointer);
  elements.plateCanvas.addEventListener("contextmenu", (event) => {
    if (event.ctrlKey && event.target.closest(".well")) event.preventDefault();
  });

  elements.addDimensionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.newDimensionName.value.trim();
    if (!name) return;
    if (project.dimensions.some((dimension) => dimension.name.toLowerCase() === name.toLowerCase())) {
      showToast(bilingual("这个维度名称已经存在", "This parameter name already exists"));
      return;
    }
    const id = `dimension_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    commit(() => {
      project.dimensions.push({ id, name, type: elements.newDimensionType.value === "number" ? "number" : "text", unit: "" });
      if (!project.colorDimension) project.colorDimension = id;
    });
    elements.newDimensionName.value = "";
    elements.newDimensionName.focus();
    showToast(bilingual(`已添加维度“${name}”`, `Added parameter “${name}”`));
  });

  elements.dimensionList.addEventListener("change", (event) => {
    const row = event.target.closest(".dimension-row");
    if (!row) return;
    const dimension = project.dimensions.find((item) => item.id === row.dataset.dimension);
    if (!dimension) return;
    if (event.target.classList.contains("dimension-name-input")) {
      const nextName = event.target.value.trim();
      if (!nextName || project.dimensions.some((item) => item.id !== dimension.id && item.name.toLowerCase() === nextName.toLowerCase())) {
        showToast(bilingual("维度名称不能为空或重复", "Parameter names cannot be empty or duplicated"));
        renderDimensions();
        return;
      }
      commit(() => { dimension.name = nextName; });
    }
    if (event.target.classList.contains("dimension-type-select")) {
      commit(() => {
        dimension.type = event.target.value === "number" ? "number" : "text";
        if (dimension.type === "text") dimension.unit = "";
      });
    }
    if (event.target.classList.contains("dimension-unit-input")) {
      commit(() => { dimension.unit = event.target.value.trim().slice(0, 16); });
    }
  });

  function resetDimensionDeleteConfirmation() {
    window.clearTimeout(dimensionDeleteTimer);
    dimensionDeleteTimer = null;
    pendingDimensionDeleteId = null;
    elements.dimensionList.querySelectorAll(".dimension-row.pending-delete").forEach((row) => row.classList.remove("pending-delete"));
    elements.dimensionList.querySelectorAll(".dimension-delete").forEach((button) => { button.textContent = "×"; });
  }

  elements.dimensionList.addEventListener("click", (event) => {
    const orderButton = event.target.closest(".dimension-order-button");
    if (orderButton) {
      const row = orderButton.closest(".dimension-row");
      const index = project.dimensions.findIndex((item) => item.id === row.dataset.dimension);
      const nextIndex = orderButton.dataset.action === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= project.dimensions.length) return;
      commit(() => {
        [project.dimensions[index], project.dimensions[nextIndex]] = [project.dimensions[nextIndex], project.dimensions[index]];
        const dimensionOrder = new Map(project.dimensions.map((dimension, order) => [dimension.id, order]));
        project.calculationOutputs.sort((left, right) => (dimensionOrder.get(left.id) ?? Infinity) - (dimensionOrder.get(right.id) ?? Infinity));
      });
      showToast(bilingual("参数顺序、孔内显示和导出列已同步更新", "Parameter, well-display, and export-column order updated"));
      return;
    }
    const button = event.target.closest(".dimension-delete");
    if (!button) return;
    const row = button.closest(".dimension-row");
    const dimension = project.dimensions.find((item) => item.id === row.dataset.dimension);
    if (!dimension) return;
    if (pendingDimensionDeleteId !== dimension.id) {
      resetDimensionDeleteConfirmation();
      pendingDimensionDeleteId = dimension.id;
      row.classList.add("pending-delete");
      button.textContent = t("confirmDelete");
      dimensionDeleteTimer = window.setTimeout(resetDimensionDeleteConfirmation, 5000);
      return;
    }
    resetDimensionDeleteConfirmation();
    commit(() => {
      project.dimensions = project.dimensions.filter((item) => item.id !== dimension.id);
      project.calculationOutputs = project.calculationOutputs.filter((item) => item.id !== dimension.id);
      project.calculationLog = project.calculationLog.filter((entry) => entry.outputId !== dimension.id);
      for (const size of [6, 12, 24, 96, 384]) {
        for (const [wellId, well] of Object.entries(project.plates[size])) {
          delete well.params[dimension.id];
          cleanWellMap(project.plates[size], wellId);
        }
      }
      if (project.colorDimension === dimension.id) project.colorDimension = project.dimensions[0]?.id || "";
    });
    showToast(bilingual(`已删除维度“${dimension.name}”`, `Deleted parameter “${dimension.name}”`));
  });

  elements.selectionEditor.addEventListener("input", (event) => {
    if (!event.target.classList.contains("parameter-value")) return;
    event.target.closest(".parameter-input-row").querySelector(".parameter-apply-checkbox").checked = true;
  });

  function clipboardValues(event) {
    const clipboardText = event.clipboardData?.getData("text/plain") || "";
    const clipboardHtml = event.clipboardData?.getData("text/html") || "";
    if (clipboardHtml && /<t[dh]\b/i.test(clipboardHtml)) {
      const documentFragment = new DOMParser().parseFromString(clipboardHtml, "text/html");
      const cells = [...documentFragment.querySelectorAll("td, th")].map((cell) => cell.textContent.trim());
      if (cells.length > 1) return cells;
    }
    if (/[\t\r\n]/.test(clipboardText)) {
      const lines = clipboardText.replace(/\r/g, "").split("\n");
      while (lines.length && lines.at(-1) === "") lines.pop();
      return lines.flatMap((line) => line.split("\t").map((value) => value.trim()));
    }
    const whitespaceValues = clipboardText.trim().split(/\s+/).filter(Boolean);
    return whitespaceValues.length >= 3 ? whitespaceValues : null;
  }

  elements.selectionEditor.addEventListener("paste", (event) => {
    const input = event.target.closest(".parameter-value");
    if (!input) return;
    const values = clipboardValues(event);
    if (!values) return;
    event.preventDefault();
    if (!selection.size) {
      showToast(bilingual("请先选择目标孔位", "Select target wells first"));
      return;
    }
    const dimensionId = input.dataset.dimension;
    const dimension = project.dimensions.find((item) => item.id === dimensionId);
    if (!values.length || !dimension) return;
    if (dimension.type === "number") {
      const invalid = values.find((value) => value !== "" && Core.asFiniteNumber(value) === null);
      if (invalid !== undefined) {
        showToast(bilingual(`“${invalid}”不是有效数值`, `“${invalid}” is not a valid number`));
        return;
      }
    }
    input.closest(".parameter-input-row").querySelector(".parameter-apply-checkbox").checked = true;
    pendingBatchPaste = { dimensionId, values, order: "N" };
    renderBatchPastePanel();
  });

  elements.selectionEditor.addEventListener("click", (event) => {
    const orderButton = event.target.closest(".batch-order");
    if (orderButton && pendingBatchPaste) {
      pendingBatchPaste.order = orderButton.dataset.order === "Z" ? "Z" : "N";
      renderBatchPastePanel();
      return;
    }
    if (event.target.closest(".batch-paste-cancel")) {
      pendingBatchPaste = null;
      renderSelectionEditor();
      return;
    }
    const applyButton = event.target.closest(".batch-paste-apply, .batch-paste-partial");
    if (!applyButton || !pendingBatchPaste) return;
    const targetIds = batchTargetWells(pendingBatchPaste.order);
    const allowPartial = applyButton.classList.contains("batch-paste-partial");
    if (pendingBatchPaste.values.length > targetIds.length && !allowPartial) return;
    const { dimensionId, values, order } = pendingBatchPaste;
    const appliedValues = values.slice(0, targetIds.length);
    const omittedCount = values.length - appliedValues.length;
    const filledIds = targetIds.slice(0, appliedValues.length);
    pendingBatchPaste = null;
    selection = new Set(filledIds);
    selectionAnchor = filledIds[0] || null;
    commit(() => {
      const wells = currentWells();
      appliedValues.forEach((rawValue, index) => {
        const wellId = targetIds[index];
        if (!wells[wellId]) wells[wellId] = { params: {} };
        if (rawValue === "") delete wells[wellId].params[dimensionId];
        else wells[wellId].params[dimensionId] = project.dimensions.find((item) => item.id === dimensionId)?.type === "number" ? Number(rawValue) : rawValue;
        cleanWellMap(wells, wellId);
      });
    });
    showToast(omittedCount
      ? bilingual(`已填满 ${appliedValues.length} 个剩余孔位，${omittedCount} 个值未填入`, `Filled ${appliedValues.length} remaining wells; ${omittedCount} values were not filled`)
      : bilingual(`已按 ${order} 型顺序写入 ${appliedValues.length} 个值`, `${appliedValues.length} values pasted in ${order} order`));
  });

  function checkedParameterRows() {
    return [...elements.selectionEditor.querySelectorAll(".parameter-input-row")]
      .filter((row) => row.querySelector(".parameter-apply-checkbox").checked);
  }

  elements.applyParametersButton.addEventListener("click", () => {
    if (!selection.size) return;
    const rows = checkedParameterRows();
    if (!rows.length) {
      showToast(bilingual("请先修改并勾选至少一个参数", "Edit and check at least one parameter first"));
      return;
    }
    const changes = [];
    for (const row of rows) {
      const input = row.querySelector(".parameter-value");
      const dimension = project.dimensions.find((item) => item.id === input.dataset.dimension);
      if (!dimension) continue;
      if (dimension.type === "number" && input.value !== "" && !Number.isFinite(Number(input.value))) {
        showToast(bilingual(`“${dimension.name}”不是有效数值`, `“${dimension.name}” is not a valid number`));
        return;
      }
      changes.push({ id: dimension.id, value: dimension.type === "number" && input.value !== "" ? Number(input.value) : input.value });
    }
    commit(() => {
      const wells = currentWells();
      for (const wellId of selection) {
        const params = { ...(wells[wellId]?.params || {}) };
        for (const change of changes) {
          if (change.value === "") delete params[change.id];
          else params[change.id] = change.value;
        }
        wells[wellId] = { params };
        cleanWellMap(wells, wellId);
      }
    });
    showToast(bilingual(`已更新 ${selection.size} 个孔的 ${changes.length} 个参数`, `Updated ${changes.length} parameters across ${selection.size} wells`));
  });

  elements.clearParametersButton.addEventListener("click", () => {
    if (!selection.size) return;
    const rows = checkedParameterRows();
    if (!rows.length) {
      showToast(bilingual("请先勾选要清除的参数维度", "Check the parameters to clear first"));
      return;
    }
    const ids = rows.map((row) => row.querySelector(".parameter-value").dataset.dimension);
    commit(() => {
      const wells = currentWells();
      for (const wellId of selection) {
        if (!wells[wellId]) continue;
        for (const id of ids) delete wells[wellId].params[id];
        cleanWellMap(wells, wellId);
      }
    });
    showToast(bilingual(`已从 ${selection.size} 个孔清除 ${ids.length} 个参数`, `Cleared ${ids.length} parameters from ${selection.size} wells`));
  });

  elements.operandMode.addEventListener("change", () => {
    const parameterMode = elements.operandMode.value === "parameter";
    elements.constantOperandWrap.hidden = parameterMode;
    elements.parameterOperandWrap.hidden = !parameterMode;
    updateCalculationGuide();
  });
  elements.calcConditionDimension.addEventListener("change", () => {
    updateConditionSuggestions();
    updateCalculationGuide();
  });
  document.querySelector(".calc-grid").addEventListener("input", updateCalculationGuide);
  document.querySelector(".calc-grid").addEventListener("change", updateCalculationGuide);

  elements.runCalculationButton.addEventListener("click", () => {
    const targetIds = elements.calcScope.value === "selected" ? [...selection] : Core.makeWellIds(project.plateSize);
    if (!targetIds.length) {
      showToast(bilingual("当前没有选中的孔", "No wells are selected"));
      return;
    }
    const sourceId = elements.calcSource.value;
    if (!sourceId) {
      showToast(bilingual("请先添加并选择数值维度", "Add and select a numeric parameter first"));
      return;
    }
    if (elements.operandMode.value === "constant" && Core.asFiniteNumber(elements.constantOperand.value) === null) {
      showToast(bilingual("请输入有效的固定数值", "Enter a valid constant"));
      return;
    }
    if (elements.operandMode.value === "parameter" && !elements.parameterOperand.value) {
      showToast(bilingual("请选择参与计算的另一个数值参数", "Choose the other numeric parameter to use in the calculation"));
      return;
    }
    const requestedOutputName = elements.calcOutputName.value.trim();
    if (!requestedOutputName) {
      showToast(bilingual("请输入结果维度名称", "Enter an output parameter name"));
      return;
    }
    const outputName = nextAvailableDimensionName(requestedOutputName);
    const outputId = `dimension_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const conditionId = elements.calcConditionDimension.value;
    const result = Core.calculateWells({
      wellMap: currentWells(),
      wellIds: targetIds,
      conditionId,
      conditionValue: elements.calcConditionValue.value,
      sourceId,
      operation: elements.calcOperation.value,
      operandMode: elements.operandMode.value,
      operandValue: elements.constantOperand.value,
      operandId: elements.parameterOperand.value,
      outputId,
      precision: elements.calcPrecision.value,
    });
    if (!result.updated) {
      const sourceDimension = project.dimensions.find((dimension) => dimension.id === sourceId);
      const sourceName = sourceDimension ? dimensionLabel(sourceDimension) : bilingual("所选数值", "the selected value");
      elements.calculationResult.className = "calculation-result warning";
      elements.calculationResult.textContent = bilingual(`未计算任何孔：${result.skipped} 个目标孔中“${sourceName}”为空或不是数字，或筛选条件/参与计算的另一个参数不匹配。`, `No wells were calculated: in ${result.skipped} target wells, “${sourceName}” was empty or non-numeric, or the filter/other calculation parameter did not match.`);
      return;
    }
    commit(() => {
      project.dimensions.push({ id: outputId, name: outputName, type: "number", unit: "" });
      project.plates[project.plateSize] = result.nextWells;
      project.colorDimension = outputId;
      project.calculationOutputs.push({
        id: outputId, plateSize: project.plateSize, scope: elements.calcScope.value,
        conditionId, conditionValue: elements.calcConditionValue.value, sourceId,
        operation: elements.calcOperation.value, operandMode: elements.operandMode.value,
        operandValue: elements.constantOperand.value, operandId: elements.parameterOperand.value,
        updated: result.updated, skipped: result.skipped, createdAt: new Date().toISOString(),
      });
      project.calculationLog.push({
        at: new Date().toISOString(), plateSize: project.plateSize, outputId, outputName,
        updated: result.updated, skipped: result.skipped,
      });
      project.calculationLog = project.calculationLog.slice(-50);
    });
    elements.calculationResult.className = "calculation-result success";
    elements.calculationResult.innerHTML =
      `<span>${escapeHtml(bilingual(`完成：${result.updated} 孔已写入“${outputName}”，${result.skipped} 孔因缺失、非数值或除零被跳过。`, `Done: wrote “${outputName}” to ${result.updated} wells; ${result.skipped} skipped for missing or invalid values, or division by zero.`))}</span>` +
      `<small>${escapeHtml(bilingual(`孔板已自动切换为显示“${outputName}”；点选孔位可查看完整参数，CSV 中也会包含该结果列。`, `The plate now displays “${outputName}”. Select a well for full details; CSV export also includes this result column.`))}</small>` +
      `<button class="calculation-view-result" data-output="${escapeHtml(outputId)}" type="button">${bilingual("在孔板查看", "View on plate")}</button>`;
    showToast(bilingual(`批量计算完成：更新 ${result.updated} 孔`, `Calculation complete: ${result.updated} wells updated`));
  });

  elements.calculationResult.addEventListener("click", (event) => {
    const button = event.target.closest(".calculation-view-result");
    if (!button) return;
    viewCalculationOutput(button.dataset.output);
  });

  elements.calculationOutputList.addEventListener("click", (event) => {
    const itemElement = event.target.closest(".calculation-output-item");
    const actionButton = event.target.closest("[data-action]");
    if (!itemElement || !actionButton) return;
    const outputId = itemElement.dataset.output;
    const index = project.calculationOutputs.findIndex((item) => item.id === outputId);
    if (index < 0) return;
    const action = actionButton.dataset.action;
    if (action === "view") {
      viewCalculationOutput(outputId);
      return;
    }
    if (action === "up" || action === "down") {
      const nextIndex = action === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= project.calculationOutputs.length) return;
      commit(() => {
        [project.calculationOutputs[index], project.calculationOutputs[nextIndex]] = [project.calculationOutputs[nextIndex], project.calculationOutputs[index]];
        reorderCalculatedDimensions();
      });
      showToast(bilingual("已同步调整导出列顺序", "Export column order updated"));
      return;
    }
    if (action !== "delete") return;
    if (pendingCalculationDeleteId !== outputId) {
      resetCalculationDeleteConfirmation();
      pendingCalculationDeleteId = outputId;
      renderCalculationOutputs();
      calculationDeleteTimer = window.setTimeout(resetCalculationDeleteConfirmation, 5000);
      return;
    }
    const outputName = project.dimensions.find((dimension) => dimension.id === outputId)?.name || bilingual("计算结果", "calculation result");
    window.clearTimeout(calculationDeleteTimer);
    calculationDeleteTimer = null;
    pendingCalculationDeleteId = null;
    commit(() => {
      project.calculationOutputs = project.calculationOutputs.filter((item) => item.id !== outputId);
      project.dimensions = project.dimensions.filter((dimension) => dimension.id !== outputId);
      for (const size of [6, 12, 24, 96, 384]) {
        for (const [wellId, well] of Object.entries(project.plates[size])) {
          delete well.params[outputId];
          cleanWellMap(project.plates[size], wellId);
        }
      }
      project.calculationLog = project.calculationLog.filter((entry) => entry.outputId !== outputId);
      if (project.colorDimension === outputId) project.colorDimension = project.dimensions[0]?.id || "";
      reorderCalculatedDimensions();
    });
    showToast(bilingual(`已删除“${outputName}”及其导出列`, `Deleted “${outputName}” and its export column`));
  });

  document.querySelectorAll(".liquid-module-launch").forEach((button) => button.addEventListener("click", () => { editingLiquidPlanId = null; openLiquidDrawer(button.dataset.liquidModule); }));
  elements.openLiquidCalculatorButton.addEventListener("click", () => { editingLiquidPlanId = null; openLiquidDrawer(activeLiquidModule); });
  elements.savedLiquidPlanList.addEventListener("change", (event) => {
    const row = event.target.closest("[data-saved-liquid-plan]");
    if (!row || !event.target.matches("[data-liquid-plan-name]")) return;
    const plan = project.liquidPlans.find((item) => item.id === row.dataset.savedLiquidPlan);
    if (!plan) return;
    const nextName = event.target.value.trim() || plan.recipeName || bilingual("未命名配液方案", "Untitled liquid plan");
    commit(() => {
      plan.name = nextName.slice(0, 80);
      plan.updatedAt = new Date().toISOString();
      workspace.latestLiquidSummary = null;
    }, { invalidateLiquid: false });
    showToast(bilingual("方案名称已更新；请重新生成跨板汇总", "Plan name updated; regenerate the cross-plate summary"));
  });
  elements.savedLiquidPlanList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-liquid-plan-action]");
    const row = event.target.closest("[data-saved-liquid-plan]");
    if (!actionButton || !row) return;
    const plan = project.liquidPlans.find((item) => item.id === row.dataset.savedLiquidPlan);
    if (!plan) return;
    if (actionButton.dataset.liquidPlanAction === "edit") {
      editingLiquidPlanId = plan.id;
      liquidDrafts[plan.module] = { ...(plan.input || {}) };
      openLiquidDrawer(plan.module);
      showToast(bilingual("已载入方案；重新计算并保存会更新原条目", "Plan loaded; recalculate and save to update this entry"));
      return;
    }
    if (pendingLiquidPlanDeleteId !== plan.id) {
      pendingLiquidPlanDeleteId = plan.id;
      window.clearTimeout(liquidPlanDeleteTimer);
      liquidPlanDeleteTimer = window.setTimeout(() => { pendingLiquidPlanDeleteId = null; renderSavedLiquidPlans(); }, 5000);
      renderSavedLiquidPlans();
      return;
    }
    window.clearTimeout(liquidPlanDeleteTimer);
    pendingLiquidPlanDeleteId = null;
    commit(() => {
      project.liquidPlans = project.liquidPlans.filter((item) => item.id !== plan.id);
      workspace.latestLiquidSummary = null;
    }, { invalidateLiquid: false });
    showToast(bilingual("已清除方案；跨板汇总需要重新生成", "Plan cleared; regenerate the cross-plate summary"));
  });
  elements.projectLiquidScope.addEventListener("change", renderProjectLiquidControls);
  elements.projectLiquidSummaryButton.addEventListener("click", () => {
    const plates = selectedLiquidPlates();
    if (!plates.length) {
      showToast(bilingual("请至少勾选一块板", "Select at least one plate"));
      return;
    }
    const overagePercent = Math.max(0, Math.min(100, Number(elements.projectLiquidOverage.value) || 0));
    const capacityValue = Number(elements.projectLiquidContainerCapacity.value);
    const maxContainerVolume = Number.isFinite(capacityValue) && capacityValue > 0 ? capacityValue : Infinity;
    const { merged, skipped } = aggregateLiquidPlans(plates, overagePercent, maxContainerVolume);
    workspace.latestLiquidSummary = {
      id: `liquid_summary_${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      plateIds: plates.map((plate) => plate.id),
      plateNames: plates.map((plate) => plate.name),
      overagePercent,
      maxContainerVolume: Number.isFinite(maxContainerVolume) ? maxContainerVolume : null,
      groups: merged.groups,
      skipped,
    };
    saveProject();
    renderProjectLiquidSummary(workspace.latestLiquidSummary);
    showToast(bilingual("跨板配液汇总已生成，并会写入 XLSX", "Cross-plate liquid summary created and included in XLSX"));
  });
  async function handleProjectLiquidExport(event) {
    if (event.target.closest("[data-open-liquid-summary]")) {
      openSummaryDrawer();
      return;
    }
    const button = event.target.closest("[data-project-liquid-export]");
    const summary = workspace.latestLiquidSummary;
    if (!button || !summary?.groups?.length) return;
    const rows = summaryRowsForExport(summary);
    if (button.dataset.projectLiquidExport === "copy") {
      try {
        await navigator.clipboard.writeText(rows.map((row) => row.join("\t")).join("\n"));
        showToast(bilingual("跨板配液汇总已复制", "Cross-plate liquid summary copied"));
      } catch (error) {
        showToast(bilingual("浏览器未允许复制，请导出 CSV", "Clipboard access was denied; export CSV instead"));
      }
      return;
    }
    if (button.dataset.projectLiquidExport === "csv") {
      const csv = `\uFEFF${rows.map((row) => row.map(Core.csvEscape).join(",")).join("\r\n")}`;
      downloadBlob(csv, "text/csv;charset=utf-8", `${Core.safeFileName(workspace.name)}_liquid-summary.csv`);
      return;
    }
    try {
      const bytes = Xlsx.buildWorkbook({ sheets: liquidSummaryWorkbookSheets(summary) });
      downloadBlob(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${Core.safeFileName(workspace.name)}_liquid-summary.xlsx`);
      showToast(bilingual("跨板配液执行工作簿已导出", "Cross-plate liquid execution workbook exported"));
    } catch (error) {
      showToast(bilingual(`汇总导出失败：${error.message}`, `Summary export failed: ${error.message}`));
    }
  }
  elements.projectLiquidSummary.addEventListener("click", handleProjectLiquidExport);
  elements.summaryDrawerActions.addEventListener("click", handleProjectLiquidExport);
  elements.closeSummaryDrawerButton.addEventListener("click", closeSummaryDrawer);
  elements.summaryDrawer.querySelector(".summary-drawer-backdrop").addEventListener("click", closeSummaryDrawer);
  elements.closeLiquidDrawerButton.addEventListener("click", closeLiquidDrawer);
  elements.liquidDrawer.querySelector(".liquid-drawer-backdrop").addEventListener("click", closeLiquidDrawer);
  elements.liquidModuleTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-liquid-module]");
    if (button) renderLiquidModule(button.dataset.liquidModule);
  });

  function fixedReagentRows(form) {
    return [...form.querySelectorAll("[data-fixed-reagent-row]")].map((row) => ({
      name: row.querySelector('[data-fixed-field="name"]').value,
      referenceVolume: row.querySelector('[data-fixed-field="referenceVolume"]').value,
      referenceUnit: row.querySelector('[data-fixed-field="referenceUnit"]').value,
      reagentVolume: row.querySelector('[data-fixed-field="reagentVolume"]').value,
      reagentUnit: row.querySelector('[data-fixed-field="reagentUnit"]').value,
    }));
  }

  function fixedReagentRowMarkup(reagent = {}) {
    return `<div class="fixed-reagent-row" data-fixed-reagent-row><label><span>${bilingual("试剂名称", "Reagent name")}</span><input data-fixed-field="name" type="text" value="${escapeHtml(reagent.name || "")}" placeholder="CCK-8"></label><div class="fixed-ratio-sentence"><label><span data-fixed-reference-label>${bilingual("参照培养基体积", "Reference medium volume")}</span><div class="liquid-inline-input"><input data-fixed-field="referenceVolume" type="number" min="0" step="any" value="${escapeHtml(reagent.referenceVolume || "100")}"><select data-fixed-field="referenceUnit">${liquidUnitOptions(["µL", "mL"], reagent.referenceUnit || "µL")}</select></div></label><label><span>${bilingual("加入试剂体积", "Reagent volume to add")}</span><div class="liquid-inline-input"><input data-fixed-field="reagentVolume" type="number" min="0" step="any" value="${escapeHtml(reagent.reagentVolume || "10")}"><select data-fixed-field="reagentUnit">${liquidUnitOptions(["µL", "mL"], reagent.reagentUnit || "µL")}</select></div></label></div><small data-fixed-ratio-preview></small><button class="icon-button" data-liquid-action="remove-fixed-reagent" type="button" aria-label="${bilingual("删除试剂", "Remove reagent")}">×</button></div>`;
  }

  function syncFixedReagentRows(form) {
    const rows = fixedReagentRows(form);
    form.elements.fixedReagentsJson.value = JSON.stringify(rows);
    const finalMeaning = form.elements.fixedMeaning.value === "final";
    const referenceLabel = finalMeaning ? bilingual("参照最终体系体积", "Reference final-mixture volume") : bilingual("参照培养基体积", "Reference medium volume");
    const ratiosToReference = rows.map((reagent) => {
      const referenceUL = Number(reagent.referenceVolume) * (reagent.referenceUnit === "mL" ? 1000 : 1);
      const reagentUL = Number(reagent.reagentVolume) * (reagent.reagentUnit === "mL" ? 1000 : 1);
      return referenceUL > 0 && reagentUL > 0 ? reagentUL / referenceUL : NaN;
    });
    const totalReagentPerMedium = ratiosToReference.every(Number.isFinite) ? ratiosToReference.reduce((sum, ratio) => sum + ratio, 0) : NaN;
    form.querySelectorAll("[data-fixed-reagent-row]").forEach((row, index) => {
      row.querySelector("[data-fixed-reference-label]").textContent = referenceLabel;
      const reagent = rows[index];
      const referenceUL = Number(reagent.referenceVolume) * (reagent.referenceUnit === "mL" ? 1000 : 1);
      const reagentUL = Number(reagent.reagentVolume) * (reagent.reagentUnit === "mL" ? 1000 : 1);
      const reagentName = reagent.name.trim() || bilingual("试剂", "Reagent");
      let preview = bilingual("请填写大于 0 的体积。", "Enter volumes greater than zero.");
      if (referenceUL > 0 && reagentUL > 0) {
        const referenceDenominator = referenceUL / reagentUL;
        preview = finalMeaning
          ? bilingual(`${reagentName} : 最终体系 = 1:${liquidNumber(referenceDenominator, 4)}`, `${reagentName} : final mixture = 1:${liquidNumber(referenceDenominator, 4)}`)
          : bilingual(`${reagentName} : 培养基 = 1:${liquidNumber(referenceDenominator, 4)}；${reagentName} : 最终体系 = 1:${liquidNumber((1 + totalReagentPerMedium) / ratiosToReference[index], 4)}`, `${reagentName} : medium = 1:${liquidNumber(referenceDenominator, 4)}; ${reagentName} : final mixture = 1:${liquidNumber((1 + totalReagentPerMedium) / ratiosToReference[index], 4)}`);
      }
      row.querySelector("[data-fixed-ratio-preview]").textContent = preview;
    });
  }

  function renderFixedReagentRows(form, rows) {
    const list = form.querySelector("[data-fixed-reagent-list]");
    if (!list) return;
    const safeRows = Array.isArray(rows) && rows.length ? rows : [{ name: "CCK-8", referenceVolume: "100", referenceUnit: "µL", reagentVolume: "10", reagentUnit: "µL" }];
    list.innerHTML = safeRows.map(fixedReagentRowMarkup).join("");
    syncFixedReagentRows(form);
  }

  function updateBasicFormControls(form) {
    const task = form.elements.calculationType.value;
    form.querySelectorAll("[data-basic-task]").forEach((element) => { element.hidden = element.dataset.basicTask !== task; });
    form.querySelectorAll("[data-volume-mode]").forEach((element) => { element.hidden = task !== "dilution" || element.dataset.volumeMode !== form.elements.volumeMode.value; });
    form.querySelectorAll("[data-fixed-scope]").forEach((element) => { element.hidden = task !== "fixed" || element.dataset.fixedScope !== form.elements.fixedVolumeMode.value; });
    form.querySelector("[data-molecular-weight]").hidden = task !== "solid" || form.elements.solidKind.value !== "molar";
    const fixedBaseLabel = form.querySelector("[data-fixed-base-label]");
    if (fixedBaseLabel) {
      const perWell = form.elements.fixedVolumeMode.value === "per-well";
      const finalMeaning = form.elements.fixedMeaning.value === "final";
      fixedBaseLabel.textContent = bilingual(`${perWell ? "每孔" : "总"}${finalMeaning ? "最终体系" : "培养基"}体积`, `${finalMeaning ? "Final-mixture" : "Medium"} volume${perWell ? " per well" : " total"}`);
    }
    if (!form.querySelector("[data-fixed-reagent-row]")) {
      let rows;
      try { rows = JSON.parse(form.elements.fixedReagentsJson.value); } catch (error) { rows = null; }
      renderFixedReagentRows(form, rows);
    } else syncFixedReagentRows(form);
    const kind = task === "solid" ? form.elements.solidKind.value : form.elements.kind.value;
    const units = kind === "molar" ? ["nM", "µM", "mM", "M"] : kind === "mass" ? ["ng/µL", "µg/mL", "µg/µL", "mg/mL"] : ["%"];
    if (task === "dilution") [form.elements.stockUnit, form.elements.targetUnit].forEach((select, index) => {
      const prior = select.value;
      select.innerHTML = liquidUnitOptions(units, units.includes(prior) ? prior : units[index === 0 ? units.length - 1 : 0]);
    });
    if (task === "solid") {
      const prior = form.elements.solidTargetUnit.value;
      form.elements.solidTargetUnit.innerHTML = liquidUnitOptions(units, units.includes(prior) ? prior : units[0]);
    }
  }

  function protocolPreviewResult(values) {
    const groupName = values.cargoName || bilingual("目的物", "Cargo");
    const definition = transfectionDefinition(values, false, groupName, { cargoFactor: 1, reagentFactor: 1 });
    return Liquid.calculateGenericTransfection({
      wellCount: Math.max(1, Number(values.wellCount) || 1),
      overagePercent: values.overagePercent,
      finalVolume: values.finalVolume,
      complexVolume: values.complexVolume,
      minimumPipetteVolume: values.minimumPipetteVolume,
      applyWorkingSolutions: values.workingSolutionMode === "apply",
      direction: values.direction,
      preset: values.preset,
      totalCargoMass: values.totalCargoMass,
      totalCargoMassUnit: values.totalCargoMassUnit,
      totalCargoAmount: values.totalCargoAmount,
      totalCargoAmountUnit: values.totalCargoAmountUnit,
      ...definition,
    });
  }

  function refreshTransfectionProtocol(form, { force = false } = {}) {
    if (!form?.elements.protocolSteps || !form.elements.protocolMode) return;
    if (!force && form.elements.protocolMode.value === "custom") return;
    try {
      const values = formValues(form);
      const result = protocolPreviewResult(values);
      const steps = LiquidPlan.buildTransfectionProtocol({ language, preset: values.preset, direction: values.direction, result });
      form.elements.protocolSteps.dataset.updatingProtocol = "true";
      form.elements.protocolSteps.value = steps.join("\n");
      delete form.elements.protocolSteps.dataset.updatingProtocol;
      form.elements.protocolMode.value = "preset";
      const state = form.querySelector(".protocol-editor-state");
      if (state) {
        state.textContent = bilingual("跟随当前方案自动更新", "Updates from the current plan");
        state.classList.remove("is-custom");
      }
    } catch (error) {
      if (force) showToast(bilingual(`暂时无法生成步骤：${error.message}`, `Could not generate protocol yet: ${error.message}`));
    }
  }

  function updateTransfectionFormControls(form) {
    const preset = form.elements.preset.value;
    const lipo = preset === "lipo3000";
    const custom = ["lipo3000-combo", "custom-one", "custom-two"].includes(preset);
    form.querySelectorAll("[data-lipo-only]").forEach((label) => { label.hidden = !lipo; });
    form.querySelectorAll("[data-custom-only]").forEach((label) => { label.hidden = !custom; });
    form.querySelectorAll("[data-optimization-only]").forEach((label) => { label.hidden = form.elements.optimizationEnabled.value !== "on"; });
    form.querySelector("[data-target-label]").textContent = lipo ? bilingual("每孔质粒质量", "Plasmid mass per well") : bilingual("目标终浓度", "Target final concentration");
    form.querySelector("[data-reagent-label]").textContent = lipo ? "Lipofectamine 3000 / well" : "RNAiMAX / well";
    const stockUnits = lipo ? ["ng/µL", "µg/µL"] : ["nM", "µM", "mM"];
    const targetUnits = lipo ? ["ng", "µg"] : ["nM", "µM"];
    form.elements.stockUnit.innerHTML = liquidUnitOptions(stockUnits, lipo ? "ng/µL" : "µM");
    form.elements.targetUnit.innerHTML = liquidUnitOptions(targetUnits, lipo ? "ng" : "nM");
    if (form.dataset.presetInitialized !== preset) {
      const knownRnai = { 6: { finalVolume: 2000, complexVolume: 200, reagentPerWell: 6 }, 24: { finalVolume: 300, complexVolume: 30, reagentPerWell: 0.9 } }[project.plateSize];
      const knownLipo = project.plateSize === 6 ? { finalVolume: 2000, complexVolume: 250, reagentPerWell: 3.75 } : null;
      const known = lipo ? knownLipo : preset === "rnai" ? knownRnai : null;
      form.elements.finalVolume.value = known?.finalVolume ?? "";
      form.elements.complexVolume.value = known?.complexVolume ?? "";
      form.elements.cargoName.value = lipo ? "Plasmid DNA" : "siRNA";
      form.elements.stockConcentration.value = lipo ? 500 : 10;
      form.elements.targetValue.value = lipo ? 2500 : 10;
      form.elements.reagentPerWell.value = known?.reagentPerWell ?? "";
      if (form.elements.protocolMode) form.elements.protocolMode.value = "preset";
      if (custom) {
        form.elements.finalVolume.value = 2000;
        form.elements.complexVolume.value = preset === "custom-one" ? 125 : 250;
        if (preset === "custom-one") form.elements.tubeLines.value = "A,125,siRNA,cargo,,siRNA,yes\nA,125,Transfection reagent,fixed,3,,no\nA,125,Opti-MEM,diluent,,,yes";
      }
      form.dataset.presetInitialized = preset;
    }
    if (form.elements.platePresetAction.value === "apply-default") {
      const known = preset === "rnai" ? {
        6: { finalVolume: 2000, complexVolume: 200, reagentPerWell: 6 },
        24: { finalVolume: 300, complexVolume: 30, reagentPerWell: 0.9 },
      }[project.plateSize] : preset === "lipo3000" && project.plateSize === 6 ? { finalVolume: 2000, complexVolume: 250, reagentPerWell: 3.75 } : null;
      if (known) Object.entries(known).forEach(([name, value]) => { form.elements[name].value = value; });
      else showToast(bilingual("该板型与预设没有内置起始值，已保留当前配方。", "No built-in starting values exist for this format and preset; current values were kept."));
      form.elements.platePresetAction.value = "keep";
    } else if (form.elements.platePresetAction.value === "recalculate") {
      form.elements.platePresetAction.value = "keep";
      showToast(bilingual("配方已保留；计算时将使用当前只读孔数。", "Recipe kept; calculation will use the current read-only well count."));
    }
    refreshTransfectionProtocol(form);
  }

  function updateSerialFormControls(form) {
    const range = form.elements.method.value === "range";
    form.querySelectorAll("[data-range-only]").forEach((label) => { label.hidden = !range; });
    form.querySelectorAll("[data-fold-only]").forEach((label) => { label.hidden = range; });
  }

  elements.liquidDrawerContent.addEventListener("change", (event) => {
    const form = event.target.closest("#liquidActiveForm");
    if (!form) return;
    if (activeLiquidModule === "basic" && form.elements.calculationType.value === "fixed" && form.elements.workingSolutionConfirmed) form.elements.workingSolutionConfirmed.value = "no";
    const definition = liquidModuleDefinition(activeLiquidModule);
    if (definition.update && definition.updateNames.includes(event.target.name)) definition.update(form);
  });

  elements.liquidDrawerContent.addEventListener("input", (event) => {
    const form = event.target.closest("#liquidActiveForm");
    if (activeLiquidModule === "basic" && form?.elements.calculationType.value === "fixed" && form.elements.workingSolutionConfirmed) form.elements.workingSolutionConfirmed.value = "no";
    if (form && event.target.closest("[data-fixed-reagent-row]")) syncFixedReagentRows(form);
    if (activeLiquidModule === "transfection" && form) {
      if (event.target.name === "protocolSteps" && !event.target.dataset.updatingProtocol) {
        form.elements.protocolMode.value = "custom";
        const state = form.querySelector(".protocol-editor-state");
        if (state) {
          state.textContent = bilingual("步骤已自定义；参数改变后请复核体积", "Custom steps; review volumes after changing parameters");
          state.classList.add("is-custom");
        }
      } else if (["finalVolume", "complexVolume", "cargoName", "stockConcentration", "targetValue", "reagentPerWell"].includes(event.target.name)) refreshTransfectionProtocol(form);
    }
  });

  elements.liquidDrawerContent.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-liquid-library-import]");
    if (!input?.files?.[0]) return;
    try {
      const parsed = JSON.parse(await input.files[0].text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.recipes;
      if (!Array.isArray(incoming)) throw new Error(bilingual("JSON 中没有 recipes 数组。", "The JSON does not contain a recipes array."));
      const current = readLiquidRecipeLibrary();
      const imported = incoming.filter((item) => item && ["basic", "transfection", "serial", "drug"].includes(item.module) && item.input && typeof item.input === "object").map((item) => ({ ...item, id: `recipe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, builtIn: false, name: String(item.name || item.module).slice(0, 80) }));
      writeLiquidRecipeLibrary([...current, ...imported]);
      renderLiquidModule(activeLiquidModule);
      showToast(bilingual(`已导入 ${imported.length} 个配方`, `Imported ${imported.length} recipes`));
    } catch (error) {
      showToast(bilingual(`配方导入失败：${error.message}`, `Recipe import failed: ${error.message}`));
    }
  });

  elements.liquidDrawerContent.addEventListener("submit", (event) => {
    const form = event.target.closest("#liquidActiveForm");
    if (!form) return;
    event.preventDefault();
    try {
      if (activeLiquidModule === "basic") syncFixedReagentRows(form);
      const values = formValues(form);
      liquidModuleDefinition(activeLiquidModule).calculate(values);
    } catch (error) {
      console.error(error);
      const host = document.getElementById("liquidResultHost");
      if (host) host.innerHTML = `<div class="liquid-warning">${escapeHtml(bilingual(`无法计算：${error.message}`, `Could not calculate: ${error.message}`))}</div>`;
    }
  });

  elements.liquidDrawerContent.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-liquid-action]");
    if (!button) return;
    const action = button.dataset.liquidAction;
    if (action === "reset") {
      if (activeLiquidModule === "basic") {
        const form = document.getElementById("liquidActiveForm");
        captureLiquidDraft("basic");
        const task = form.elements.calculationType.value;
        const prefixes = task === "fixed" ? ["fixed", "minimumPipetteVolume", "workingSolutionMode"] : task === "dilution" ? ["kind", "stock", "target", "volumeMode", "totalVolume", "volumeUnit", "perWell", "dilutionWellCount"] : ["solid", "purityPercent", "molecularWeight"];
        for (const name of Object.keys(liquidDrafts.basic || {})) if (prefixes.some((prefix) => name === prefix || name.startsWith(prefix))) delete liquidDrafts.basic[name];
        liquidDrafts.basic.calculationType = task;
      } else delete liquidDrafts[activeLiquidModule];
      renderLiquidModule(activeLiquidModule, { captureCurrent: false });
      return;
    }
    if (action === "restore-protocol") {
      refreshTransfectionProtocol(document.getElementById("liquidActiveForm"), { force: true });
      return;
    }
    if (action === "add-fixed-reagent") {
      const form = document.getElementById("liquidActiveForm");
      form.querySelector("[data-fixed-reagent-list]").insertAdjacentHTML("beforeend", fixedReagentRowMarkup({ name: "", referenceVolume: "100", referenceUnit: "µL", reagentVolume: "1", reagentUnit: "µL" }));
      syncFixedReagentRows(form);
      form.elements.workingSolutionConfirmed.value = "no";
      return;
    }
    if (action === "remove-fixed-reagent") {
      const form = document.getElementById("liquidActiveForm");
      button.closest("[data-fixed-reagent-row]")?.remove();
      syncFixedReagentRows(form);
      form.elements.workingSolutionConfirmed.value = "no";
      return;
    }
    if (action === "apply-layout") {
      applyDrugLayout();
      return;
    }
    if (action === "apply-serial-layout") {
      applySerialLayout();
      return;
    }
    if (action === "confirm-basic-working-solution") {
      const form = document.getElementById("liquidActiveForm");
      form.elements.workingSolutionConfirmed.value = "yes";
      form.requestSubmit();
      return;
    }
    if (action === "print") {
      document.body.classList.add("liquid-printing");
      window.addEventListener("afterprint", () => document.body.classList.remove("liquid-printing"), { once: true });
      window.print();
      return;
    }
    const selectedRecipeId = elements.liquidDrawerContent.querySelector("[data-liquid-library-select]")?.value;
    const selectedRecipe = [...BUILTIN_LIQUID_RECIPES, ...readLiquidRecipeLibrary()].find((recipe) => recipe.id === selectedRecipeId);
    if (action === "load-preset" && selectedRecipe) {
      liquidDrafts[selectedRecipe.module] = normalizeLiquidRecipeInput(selectedRecipe);
      renderLiquidModule(selectedRecipe.module, { captureCurrent: false });
      showToast(bilingual(`已加载“${selectedRecipe.name}”`, `Loaded “${selectedRecipe.name}”`));
      return;
    }
    if (action === "copy-preset" && selectedRecipe) {
      const copy = { ...selectedRecipe, id: `recipe_${Date.now().toString(36)}`, builtIn: false, name: bilingual(`${selectedRecipe.name} 副本`, `${selectedRecipe.name} copy`), input: normalizeLiquidRecipeInput(selectedRecipe) };
      writeLiquidRecipeLibrary([...readLiquidRecipeLibrary(), copy]);
      liquidDrafts[copy.module] = { ...copy.input };
      renderLiquidModule(copy.module, { captureCurrent: false });
      showToast(bilingual("已复制为可编辑配方", "Copied as an editable recipe"));
      return;
    }
    if (action === "delete-preset" && selectedRecipe) {
      if (selectedRecipe.builtIn) {
        showToast(bilingual("内置配方为只读，不能删除；可先复制再修改。", "Built-in recipes are read-only and cannot be deleted; copy one to customize it."));
        return;
      }
      writeLiquidRecipeLibrary(readLiquidRecipeLibrary().filter((recipe) => recipe.id !== selectedRecipe.id));
      renderLiquidModule(activeLiquidModule);
      showToast(bilingual("配方已删除", "Recipe deleted"));
      return;
    }
    if (action === "export-presets") {
      downloadBlob(JSON.stringify({ version: 1, recipes: readLiquidRecipeLibrary() }, null, 2), "application/json", "plate-layout-liquid-recipes.json");
      return;
    }
    if (!lastLiquidResult) return;
    if (action === "copy") {
      try {
        await navigator.clipboard.writeText(liquidTableText(lastLiquidResult));
        showToast(bilingual("配液表已复制", "Preparation table copied"));
      } catch (error) {
        showToast(bilingual("浏览器未允许复制，请使用 CSV 导出", "Clipboard access was denied; use CSV export"));
      }
      return;
    }
    if (action === "csv") {
      const csv = `\uFEFF${[lastLiquidResult.headers, ...(lastLiquidResult.rows || [])].map((row) => row.map(Core.csvEscape).join(",")).join("\r\n")}`;
      downloadBlob(csv, "text/csv;charset=utf-8", `${Core.safeFileName(project.name)}_${activeLiquidModule}_liquid-preparation.csv`);
      return;
    }
    const savedInput = activeLiquidModule === "basic"
      ? { ...lastLiquidResult.input, workingSolutionConfirmed: "no" }
      : lastLiquidResult.input;
    const existingPlan = editingLiquidPlanId ? project.liquidPlans.find((item) => item.id === editingLiquidPlanId) : null;
    const recipeName = lastLiquidResult.recipeName || (activeLiquidModule === "transfection" ? bilingual("转染体系", "Transfection preparation") : bilingual(`${activeLiquidModule} 配液`, `${activeLiquidModule} preparation`));
    const groupingDimension = savedInput.groupDimension ? project.dimensions.find((dimension) => dimension.id === savedInput.groupDimension) : null;
    const automaticName = groupingDimension ? `${recipeName} · ${dimensionLabel(groupingDimension)}` : recipeName;
    const now = new Date().toISOString();
    const saved = {
      id: existingPlan?.id || `liquid_${Date.now().toString(36)}`,
      module: activeLiquidModule,
      name: existingPlan?.name || automaticName,
      recipeName,
      plateId: project.id,
      plateName: project.name,
      plateSize: project.plateSize,
      scopeWellIds: liquidTargetWellIds(),
      input: savedInput,
      resultSnapshot: { headers: lastLiquidResult.headers, rows: lastLiquidResult.rows, warnings: lastLiquidResult.warnings || [], checklist: lastLiquidResult.checklist || [], executionGroups: lastLiquidResult.executionGroups || [] },
      protocolSnapshot: { steps: lastLiquidResult.checklist || [] },
      contributions: liquidResultContributions(lastLiquidResult, project),
      createdAt: existingPlan?.createdAt || now,
      updatedAt: now,
      stale: false,
      status: "saved",
    };
    if (action === "save") {
      commit(() => {
        const index = project.liquidPlans.findIndex((item) => item.id === saved.id);
        if (index >= 0) project.liquidPlans[index] = saved;
        else project.liquidPlans.push(saved);
        workspace.latestLiquidSummary = null;
      }, { invalidateLiquid: false });
      editingLiquidPlanId = null;
      showToast(existingPlan ? bilingual("已更新项目中的配液方案", "Saved plan updated") : bilingual("配液方案已保存并可用于跨板汇总", "Plan saved and available for cross-plate summary"));
      return;
    }
    if (action === "save-preset") {
      const library = readLiquidRecipeLibrary();
      const recipe = { ...saved, name: bilingual(`${activeLiquidModule} 配方 ${new Date().toLocaleString("zh-CN", { hour12: false })}`, `${activeLiquidModule} recipe ${new Date().toLocaleString("en-US")}`), scopeWellIds: undefined, plateId: undefined, plateName: undefined, plateSize: undefined, resultSnapshot: undefined, contributions: undefined, builtIn: false };
      library.push(recipe);
      writeLiquidRecipeLibrary(library);
      const select = elements.liquidDrawerContent.querySelector("[data-liquid-library-select]");
      if (select) {
        const option = document.createElement("option");
        option.value = recipe.id;
        option.textContent = recipe.name;
        option.selected = true;
        select.appendChild(option);
      }
      showToast(bilingual("已保存为浏览器本地可复用预设", "Saved as a reusable browser-local preset"));
    }
  });

  function downloadBlob(content, mimeType, fileName) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  elements.exportCsvButton.addEventListener("click", () => {
    const headers = ["PlateSize", "Well", "Row", "Column", ...project.dimensions.map(dimensionLabel)];
    const rows = [headers];
    for (const wellId of Core.makeWellIds(project.plateSize)) {
      const parsed = Core.parseWell(project.plateSize, wellId);
      const params = currentWells()[wellId]?.params || {};
      rows.push([project.plateSize, wellId, Core.getSpec(project.plateSize).rows[parsed.row], parsed.column + 1, ...project.dimensions.map((dimension) => params[dimension.id] ?? "")]);
    }
    const csv = `\uFEFF${rows.map((row) => row.map(Core.csvEscape).join(",")).join("\r\n")}`;
    downloadBlob(csv, "text/csv;charset=utf-8", `${Core.safeFileName(project.name)}_${project.plateSize}well.csv`);
    showToast(bilingual("CSV 已导出", "CSV exported"));
  });

  function buildSvg() {
    const spec = Core.getSpec(project.plateSize);
    const geometry = {
      6: { step: 120, radius: 45 },
      12: { step: 105, radius: 40 },
      24: { step: 94, radius: 35 },
      96: { step: 76, radius: 27 },
      384: { step: 38, radius: 13 },
    }[project.plateSize];
    const { step, radius } = geometry;
    const marginX = 78;
    const marginY = 104;
    const width = marginX * 2 + (spec.columns - 1) * step + radius * 2;
    const height = marginY + 58 + (spec.rows.length - 1) * step + radius * 2;
    const circles = [];
    for (let rowIndex = 0; rowIndex < spec.rows.length; rowIndex += 1) {
      circles.push(`<text x="35" y="${marginY + rowIndex * step + 5}" class="axis">${spec.rows[rowIndex]}</text>`);
      for (let column = 1; column <= spec.columns; column += 1) {
        if (rowIndex === 0) circles.push(`<text x="${marginX + (column - 1) * step}" y="61" class="axis">${column}</text>`);
        const wellId = `${spec.rows[rowIndex]}${column}`;
        const params = currentWells()[wellId]?.params || {};
        const entries = getDisplayEntries(params);
        const colorValue = project.colorDimension ? params[project.colorDimension] : undefined;
        const colors = colorValue !== undefined && colorValue !== "" ? colorFor(colorValue) : ["#f8f5f0", "#4f5550", "#c9c3bb"];
        const label = colorValue !== undefined && colorValue !== "" ? colorValue : entries[0]?.[1] ?? "";
        const x = marginX + (column - 1) * step;
        const y = marginY + rowIndex * step;
        circles.push(`<circle cx="${x}" cy="${y}" r="${radius}" fill="${colors[0]}" stroke="${colors[2]}" stroke-width="2"/>`);
        circles.push(`<text x="${x}" y="${y - (label !== "" ? 4 : -4)}" class="well-id">${wellId}</text>`);
        if (label !== "") circles.push(`<text x="${x}" y="${y + 13}" class="well-label">${escapeXml(String(label).slice(0, 12))}</text>`);
      }
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>.title{font:700 20px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#202824}.subtitle{font:11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#827f78}.axis{font:700 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#827f78;text-anchor:middle}.well-id{font:800 10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#26302c;text-anchor:middle}.well-label{font:700 8px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#56615b;text-anchor:middle}</style>
  <rect width="100%" height="100%" rx="26" fill="#fffdf9"/>
  <text x="28" y="30" class="title">${escapeXml(project.name || (language === "en" ? "Plate layout" : "孔板布局"))}</text>
  <text x="28" y="48" class="subtitle">${project.plateSize}-well plate · ${escapeXml(project.dimensions.find((dimension) => dimension.id === project.colorDimension)?.name || (language === "en" ? "No color" : "未着色"))}</text>
  ${circles.join("\n  ")}
</svg>`;
  }

  elements.exportSvgButton.addEventListener("click", () => {
    downloadBlob(buildSvg(), "image/svg+xml;charset=utf-8", `${Core.safeFileName(project.name)}_${project.plateSize}well.svg`);
    showToast(bilingual("矢量孔板图已导出", "Vector plate exported"));
  });

  elements.exportJsonButton.addEventListener("click", () => {
    downloadBlob(JSON.stringify(workspace, null, 2), "application/json;charset=utf-8", `${Core.safeFileName(workspace.name)}_workspace_backup.json`);
    showToast(bilingual("项目备份已导出", "Project backup exported"));
  });

  function exportOrderWellIds(plate) {
    return Core.orderedWellIds(plate.plateSize, elements.xlsxOrderSelect.value);
  }

  function summaryRowsForExport(summary, roleFilter = "") {
    const rows = [[bilingual("配液类型", "Preparation type"), bilingual("配液管", "Tube"), bilingual("目的物/分组", "Cargo / group"), bilingual("组分", "Component"), bilingual("每孔用量", "Per well"), bilingual("基础需求量", "Base need"), bilingual("统一余量", "Shared overage"), bilingual("建议准备量", "Suggested preparation"), bilingual("覆盖板", "Source plates"), bilingual("目标孔", "Target wells"), bilingual("方案", "Plan"), bilingual("容器数", "Containers"), bilingual("操作步骤", "Protocol steps"), bilingual("提示", "Note")]];
    for (const group of summary?.groups || []) {
      if (roleFilter && group.tubeRole !== roleFilter) continue;
      const sources = group.sources || [];
      const plates = [...new Set(sources.map((source) => source.plateName || source.plateId))].join("；");
      const wells = sources.map((source) => `${source.plateName || source.plateId}: ${(source.scopeWellIds || []).join(", ")}`).join("；");
      const plans = [...new Set([...(group.recipeNames || []), ...sources.map((source) => source.planName).filter(Boolean)])].join("；");
      const protocols = [...new Set(sources.flatMap((source) => source.protocolSteps || []).filter(Boolean))].join(" → ");
      for (const component of group.components || []) rows.push([
        group.tubeRole === "cargo" ? bilingual("目的物管", "Cargo tube") : group.tubeRole === "common" ? bilingual("公共预混液", "Common premix") : bilingual("配液", "Preparation"),
        group.tube || group.label || "",
        group.cargoIdentity || group.label || "",
        component.name,
        component.perWellVolume ? `${liquidNumber(component.perWellVolume)} µL` : "",
        `${liquidNumber(component.baseVolume)} µL`,
        `${summary.overagePercent}%`,
        `${liquidNumber(component.preparedVolume)} µL`,
        plates,
        wells,
        plans,
        component.containerCount,
        protocols,
        component.warning ? bilingual("存在移液量低于 1 µL", "A transfer is below 1 µL") : "",
      ]);
    }
    return rows;
  }

  function pipettingRowsForSummary(summary) {
    const rows = [[bilingual("执行顺序", "Step"), bilingual("配液类型", "Preparation type"), bilingual("配液管", "Tube"), bilingual("目的物/分组", "Cargo / group"), bilingual("组分", "Component"), bilingual("来源容器或母液", "Source container / stock"), bilingual("目标板", "Target plate"), bilingual("目标孔", "Target well"), bilingual("每孔加入体积", "Volume per well"), bilingual("基础需求量", "Base need"), bilingual("建议准备量（含余量）", "Suggested preparation incl. overage"), bilingual("实际加入量", "Actual volume"), bilingual("完成状态", "Done"), bilingual("操作者", "Operator"), bilingual("时间", "Time"), bilingual("备注", "Notes")]];
    let step = 1;
    for (const group of summary?.groups || []) for (const component of group.components || []) {
      const sources = group.sources || [];
      rows.push([
        step,
        group.tubeRole === "cargo" ? bilingual("目的物管", "Cargo tube") : bilingual("公共预混液", "Common premix"),
        group.tube || group.label || "",
        group.cargoIdentity || group.label || "",
        component.name,
        bilingual("按配液表配制", "Prepare from liquid sheet"),
        [...new Set(sources.map((source) => source.plateName || source.plateId))].join("；"),
        sources.map((source) => `${source.plateName || source.plateId}: ${(source.scopeWellIds || []).join(", ")}`).join("；"),
        component.perWellVolume ? `${liquidNumber(component.perWellVolume)} µL` : "",
        `${liquidNumber(component.baseVolume)} µL`,
        `${liquidNumber(component.preparedVolume)} µL`,
        "", "□", "", "",
        component.containerCount > 1 ? bilingual(`分装 ${component.containerCount} 管`, `Split across ${component.containerCount} containers`) : "",
      ]);
      step += 1;
    }
    return rows;
  }

  function liquidSummaryWorkbookSheets(summary) {
    return [
      { name: bilingual("跨板公共液", "Cross-plate common mixes"), systemKind: "liquid-common", rows: summaryRowsForExport(summary, "common"), freezeRows: 1, autoFilter: true },
      { name: bilingual("独立目的物管", "Cargo-specific tubes"), systemKind: "liquid-cargo", rows: summaryRowsForExport(summary, "cargo"), freezeRows: 1, autoFilter: true },
      { name: bilingual("逐步加样清单", "Pipetting checklist"), systemKind: "pipetting", rows: pipettingRowsForSummary(summary), freezeRows: 1, autoFilter: true },
    ];
  }

  function buildWorkspaceWorkbookSheets() {
    const overviewName = bilingual("实验总览", "Project overview");
    const overviewRows = [[bilingual("板序", "Plate order"), bilingual("板名", "Plate name"), bilingual("规格", "Format"), bilingual("已赋值孔数", "Assigned wells"), bilingual("参数维度数", "Parameters"), bilingual("已保存配液方案", "Saved liquid plans"), bilingual("方案状态", "Plan status")]];
    workspace.plates.forEach((plate, index) => overviewRows.push([
      index + 1,
      plate.name,
      `${plate.plateSize}-well`,
      Object.keys(plate.plates[plate.plateSize]).length,
      plate.dimensions.length,
      (plate.liquidPlans || []).map((plan) => plan.name || plan.recipeName || plan.module).join("；"),
      (plate.liquidPlans || []).map((plan) => plan.stale ? bilingual("需重算", "Recalculate") : bilingual("有效", "Current")).join("；"),
    ]));
    const sheets = [{ name: overviewName, systemKind: "overview", rows: overviewRows, freezeRows: 1, autoFilter: true }];
    for (const plate of workspace.plates) {
      const headers = [bilingual("孔位", "Well"), ...plate.dimensions.map((dimension) => {
        const name = dimensionLabelForPlate(plate, dimension);
        return dimension.type === "number" && dimension.unit ? `${name} (${dimension.unit})` : name;
      })];
      const rows = [headers, ...exportOrderWellIds(plate).map((wellId) => [wellId, ...plate.dimensions.map((dimension) => plate.plates[plate.plateSize][wellId]?.params?.[dimension.id] ?? "")])];
      sheets.push({ name: plate.name, systemKind: "plate", rows, freezeRows: 1, autoFilter: true });
      const preparationRows = [[bilingual("方案名称", "Plan name"), bilingual("配方", "Recipe"), bilingual("状态", "Status"), bilingual("配液类型", "Preparation type"), bilingual("管", "Tube"), bilingual("目的物/分组", "Cargo / group"), bilingual("组分", "Component"), bilingual("每孔", "Per well"), bilingual("基础需求", "Base need"), bilingual("本板方案准备量", "Saved-plan preparation"), bilingual("余量", "Overage"), bilingual("目标孔", "Target wells"), bilingual("操作步骤", "Protocol steps")]];
      for (const plan of plate.liquidPlans || []) for (const contribution of plan.contributions || []) preparationRows.push([
        plan.name || plan.recipeName || plan.module,
        plan.recipeName || plan.module,
        plan.stale ? bilingual("需重算", "Recalculate") : bilingual("有效", "Current"),
        contribution.tubeRole === "cargo" ? bilingual("目的物管", "Cargo tube") : contribution.tubeRole === "common" ? bilingual("公共预混液", "Common premix") : bilingual("配液", "Preparation"),
        contribution.tube || "",
        contribution.cargoIdentity || contribution.groupName || "",
        contribution.component,
        contribution.perWellVolume ? `${liquidNumber(contribution.perWellVolume)} µL` : "",
        `${liquidNumber(contribution.baseVolume)} µL`,
        contribution.savedPreparedVolume !== undefined ? `${liquidNumber(contribution.savedPreparedVolume)} µL` : "",
        contribution.planOveragePercent !== undefined ? `${contribution.planOveragePercent}%` : "",
        (contribution.scopeWellIds || plan.scopeWellIds || []).join(", "),
        (plan.protocolSnapshot?.steps || contribution.protocolSteps || []).join(" → "),
      ]);
      if (preparationRows.length === 1) preparationRows.push([bilingual("尚未保存配液方案", "No saved liquid plan"), "", "", "", "", "", "", "", "", "", "", "", ""]);
      sheets.push({ name: `${plate.name}-${bilingual("配液", "liquid")}`, systemKind: "plate-liquid", rows: preparationRows, freezeRows: 1, autoFilter: true });
    }
    const liquidSummary = workspace.latestLiquidSummary;
    if (liquidSummary?.groups?.length) sheets.push(...liquidSummaryWorkbookSheets(liquidSummary));
    else sheets.push({ name: bilingual("跨板配液未生成", "No liquid summary"), systemKind: "liquid-empty", rows: [[bilingual("请先从已保存且有效的配液方案生成跨板汇总。", "Build a cross-plate summary from current saved plans first.")]] });
    return sheets;
  }

  function dimensionLabelForPlate(plate, dimension) {
    const defaultDimension = DEFAULT_DIMENSIONS.find((item) => item.id === dimension.id);
    if (!defaultDimension) return dimension.name;
    const englishName = I18N.en.defaultNames[dimension.id];
    return [defaultDimension.name, englishName].includes(dimension.name) ? (language === "en" ? englishName : defaultDimension.name) : dimension.name;
  }

  elements.exportXlsxButton.addEventListener("click", () => {
    try {
      const bytes = Xlsx.buildWorkbook({ sheets: buildWorkspaceWorkbookSheets() });
      const fileName = `${Core.safeFileName(workspace.name)}_multi-plate.xlsx`;
      downloadBlob(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
      showToast(bilingual(`已导出 ${workspace.plates.length} 块板：${fileName}`, `Exported ${workspace.plates.length} plates: ${fileName}`));
    } catch (error) {
      console.error(error);
      showToast(bilingual(`XLSX 导出失败：${error.message}`, `XLSX export failed: ${error.message}`));
    }
  });

  function projectTemplateWorkbookSheets() {
    const instructions = [
      [bilingual("Plate Layout Planner 项目导入模板", "Plate Layout Planner project import template")],
      [bilingual("使用规则", "Rules"), bilingual("每张以“孔位/Well”为第一列表头的工作表会导入为一块板。", "Each sheet whose first header is Well imports as one plate.")],
      [bilingual("板名", "Plate name"), bilingual("工作表名称将成为孔板名称。", "The worksheet name becomes the plate name.")],
      [bilingual("参数维度", "Parameters"), bilingual("第二列起的表头将创建参数维度；例如“剂量 (μM)”会识别单位。", "Headers after Well create parameters; e.g. Dose (μM) preserves the unit.")],
      [bilingual("支持板型", "Formats"), "6 / 12 / 24 / 96 / 384"],
      [bilingual("导入方式", "Import mode"), bilingual("默认新增孔板；也可明确选择覆盖当前板。", "Adds plates by default; replacing the current plate must be selected explicitly.")],
      [bilingual("注意", "Note"), bilingual("请勿重复孔位；空参数值会保持为空。说明表不会被导入。", "Do not duplicate wells. Blank values remain blank. This instruction sheet is skipped.")],
    ];
    const sheets = [{ name: bilingual("使用说明", "Instructions"), systemKind: "instructions", rows: instructions, freezeRows: 1 }];
    for (const plate of workspace.plates) {
      const headers = [bilingual("孔位", "Well"), ...plate.dimensions.map((dimension) => {
        const name = dimensionLabelForPlate(plate, dimension);
        return dimension.type === "number" && dimension.unit ? `${name} (${dimension.unit})` : name;
      })];
      sheets.push({ name: plate.name, systemKind: "plate-template", rows: [headers, ...exportOrderWellIds(plate).map((wellId) => [wellId, ...plate.dimensions.map(() => "")])], freezeRows: 1, autoFilter: true });
    }
    return sheets;
  }

  elements.projectTemplateButton.addEventListener("click", () => {
    const bytes = Xlsx.buildWorkbook({ sheets: projectTemplateWorkbookSheets() });
    downloadBlob(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${Core.safeFileName(workspace.name)}_import-template.xlsx`);
    showToast(bilingual(`项目 Excel 模板已下载（${workspace.plates.length} 块板）`, `Project Excel template downloaded (${workspace.plates.length} plates)`));
  });

  elements.excelTemplateButton.addEventListener("click", () => {
    const headers = language === "en"
      ? ["Well", "Sample", "Treatment", "Dose (μM)", "Time point (h)", "Replicate", "Raw value"]
      : ["孔位", "样本", "处理", "剂量 (μM)", "时间点 (h)", "重复", "原始值"];
    const rows = Core.makeWellIds(project.plateSize).map((wellId, index) => {
      if (index === 0) return [wellId, "S001", "Drug A", "1", "24", "1", ""];
      if (index === 1) return [wellId, "S002", "Drug A", "1", "24", "2", ""];
      return [wellId, "", "", "", "", "", ""];
    });
    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(Core.csvEscape).join(",")).join("\r\n")}`;
    const suffix = language === "en" ? "CSV_template" : "CSV模板";
    downloadBlob(csv, "text/csv;charset=utf-8", `${Core.safeFileName(project.name)}_${project.plateSize}well_${suffix}.csv`);
    showToast(bilingual("当前板 CSV 模板已下载", "Current plate CSV template downloaded"));
  });

  function parseDelimitedText(source, delimiter) {
    const text = String(source || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quoted) {
        if (character === '"' && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"' && field === "") {
        quoted = true;
      } else if (character === delimiter) {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        if (character === "\r" && text[index + 1] === "\n") index += 1;
      } else {
        field += character;
      }
    }
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((cells) => cells.some((cell) => String(cell).trim() !== ""));
  }

  function importedDimensionId(name, index, usedIds) {
    const normalizedName = String(name).trim().toLowerCase().replace(/[\s_-]+/g, "");
    const knownIds = {
      "样本": "sample", sample: "sample",
      "处理": "treatment", treatment: "treatment",
      "剂量": "dose", dose: "dose",
      "时间点": "timepoint", timepoint: "timepoint",
      "重复": "replicate", replicate: "replicate",
      "原始值": "value", rawvalue: "value",
    };
    const ascii = normalizedName.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const base = knownIds[normalizedName] || ascii || `column-${index}`;
    let candidate = base;
    let suffix = 2;
    while (usedIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(candidate);
    return candidate;
  }

  function projectFromTable(text, fileName) {
    const delimiter = /\.tsv$/i.test(fileName) || (!String(text).split(/\r?\n/, 1)[0].includes(",") && String(text).includes("\t")) ? "\t" : ",";
    const rows = parseDelimitedText(text, delimiter);
    if (rows.length < 2) throw new Error(bilingual("表格至少需要标题行和一行孔位数据。", "The table needs a header and at least one well row."));
    const firstHeader = String(rows[0][0] || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (!["孔位", "孔号", "well", "wellid"].includes(firstHeader)) {
      throw new Error(bilingual("第一列必须命名为“孔位”或“Well”。", "The first column must be named Well."));
    }

    const usedIds = new Set();
    const columns = rows[0].slice(1).map((rawHeader, index) => {
      const header = String(rawHeader || "").trim();
      if (!header) throw new Error(bilingual(`第 ${index + 2} 列缺少参数名称。`, `Column ${index + 2} needs a parameter name.`));
      const match = /^(.*?)\s*[（(]\s*([^()（）]+)\s*[)）]\s*$/.exec(header);
      const name = (match?.[1] || header).trim();
      const unit = (match?.[2] || "").trim();
      const values = rows.slice(1).map((row) => String(row[index + 1] ?? "").trim()).filter(Boolean);
      const defaultType = DEFAULT_DIMENSIONS.find((dimension) => [dimension.name, I18N.en.defaultNames[dimension.id]].some((label) => label.toLowerCase() === name.toLowerCase()))?.type;
      const numeric = values.length > 0 && values.every((value) => Core.asFiniteNumber(value) !== null);
      const type = unit || defaultType === "number" || numeric ? "number" : "text";
      return { id: importedDimensionId(name, index + 1, usedIds), name, type, unit: type === "number" ? unit : "" };
    });

    const wellRows = rows.slice(1).map((row) => ({ wellId: String(row[0] || "").trim().toUpperCase(), values: row.slice(1) })).filter((row) => row.wellId);
    const sizeFromName = /_(6|12|24|96|384)well(?:_|\.|$)/i.exec(fileName)?.[1];
    const plateSize = sizeFromName
      ? Number(sizeFromName)
      : [6, 12, 24, 96, 384].find((size) => wellRows.every((row) => Core.parseWell(size, row.wellId)));
    if (!plateSize || wellRows.some((row) => !Core.parseWell(plateSize, row.wellId))) {
      throw new Error(bilingual("表格包含无法匹配孔板规格的孔位。", "The table contains wells that do not match a supported plate size."));
    }
    const seenWells = new Set();
    const wells = {};
    for (const row of wellRows) {
      if (seenWells.has(row.wellId)) throw new Error(bilingual(`孔位 ${row.wellId} 重复。`, `Well ${row.wellId} is duplicated.`));
      seenWells.add(row.wellId);
      const params = {};
      columns.forEach((dimension, index) => {
        const value = String(row.values[index] ?? "").trim();
        if (value !== "") params[dimension.id] = value;
      });
      if (Object.keys(params).length) wells[row.wellId] = { params };
    }
    const baseName = fileName.replace(/\.(csv|tsv)$/i, "").replace(/_(6|12|24|96|384)well(?:_(Excel模板|Excel_template))?$/i, "");
    return normalizeProject({
      version: 1,
      name: baseName || bilingual("导入孔板", "Imported plate"),
      plateSize,
      dimensions: columns,
      plates: { [plateSize]: wells },
      colorDimension: columns.find((dimension) => dimension.id === "treatment")?.id || columns[0]?.id || "",
      calculationLog: [],
      calculationOutputs: [],
    });
  }

  function plateDocumentFromLegacy(legacy) {
    return Workspace.createPlate({
      name: legacy.name,
      plateSize: legacy.plateSize,
      dimensions: legacy.dimensions,
      wells: legacy.plates[legacy.plateSize],
      colorDimension: legacy.colorDimension,
      calculationLog: legacy.calculationLog,
      calculationOutputs: legacy.calculationOutputs,
      liquidPlans: legacy.liquidPlans,
    });
  }

  function projectFromWorkbookRows(rows, sheetName) {
    const csv = rows.map((row) => row.map(Core.csvEscape).join(",")).join("\r\n");
    return projectFromTable(csv, `${sheetName}.csv`);
  }

  function openProjectFileDialog(mode = "import") {
    const restoring = mode === "restore";
    elements.projectImportPanel.hidden = restoring;
    elements.projectRestorePanel.hidden = !restoring;
    elements.projectFileDialogTitle.textContent = restoring ? bilingual("恢复项目备份", "Restore project backup") : bilingual("导入孔板表格", "Import plate tables");
    elements.projectFileDialogHelp.textContent = restoring
      ? bilingual("JSON 备份会替换当前工作区；请先核对项目名称和板数。", "A JSON backup replaces the current workspace; review the project name and plate count first.")
      : bilingual("XLSX 可一次导入多块板；CSV/TSV 每个文件表示一块板。", "XLSX can import multiple plates; each CSV/TSV file represents one plate.");
    elements.projectFileDialog.hidden = false;
    document.body.classList.add("modal-open");
    elements.closeProjectFileDialogButton.focus();
  }

  function resetRestoreConfirmation() {
    pendingRestoredWorkspace = null;
    elements.restoreJsonInput.value = "";
    elements.restorePreview.innerHTML = "";
    elements.confirmRestoreButton.hidden = true;
  }

  function closeProjectFileDialog() {
    resetImportConfirmation();
    resetRestoreConfirmation();
    elements.projectFileDialog.hidden = true;
    document.body.classList.remove("modal-open");
  }

  elements.openProjectImportButton.addEventListener("click", () => openProjectFileDialog("import"));
  elements.openBackupRestoreButton.addEventListener("click", () => openProjectFileDialog("restore"));
  elements.closeProjectFileDialogButton.addEventListener("click", closeProjectFileDialog);
  elements.projectFileDialog.querySelector(".project-file-backdrop").addEventListener("click", closeProjectFileDialog);

  elements.importJsonInput.addEventListener("change", async () => {
    const file = elements.importJsonInput.files?.[0];
    if (!file) return;
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const parsed = await Xlsx.parseWorkbook(new Uint8Array(await file.arrayBuffer()));
        const systemNames = new Set(["实验总览", "Project overview", "配液汇总", "Liquid summary", "逐步加样清单", "Pipetting checklist"]);
        const plates = [];
        const skipped = [];
        for (const sheet of parsed.sheets) {
          const firstHeader = String(sheet.rows?.[0]?.[0] || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
          if (systemNames.has(sheet.name) || !["孔位", "孔号", "well", "wellid"].includes(firstHeader)) { skipped.push(sheet.name); continue; }
          plates.push(plateDocumentFromLegacy(projectFromWorkbookRows(sheet.rows, sheet.name)));
        }
        if (!plates.length) throw new Error(bilingual("工作簿中没有以“孔位/Well”为第一列的孔板工作表。", "No plate worksheet starts with a Well column."));
        pendingImportedProject = { kind: "plates", plates, skipped };
      } else {
        pendingImportedProject = { kind: "plates", plates: [plateDocumentFromLegacy(projectFromTable(await file.text(), file.name))], skipped: [] };
      }
      elements.importJsonLabel.hidden = true;
      elements.importModeSelect.hidden = false;
      elements.confirmImportButton.hidden = false;
      elements.importModeSelect.options[0].textContent = bilingual("新增孔板", "Add as new plate");
      elements.importModeSelect.options[1].textContent = bilingual("覆盖当前板", "Replace current plate");
      elements.importModeSelect.value = "add";
      elements.importPreview.innerHTML = pendingImportedProject.plates.map((plate) => `<div class="import-preview-card"><strong>${escapeHtml(plate.name)}</strong><span>${plate.plateSize} ${bilingual("孔", "well")}</span><small>${escapeHtml(plate.dimensions.map((dimension) => dimension.unit ? `${dimension.name} (${dimension.unit})` : dimension.name).join(" · ") || bilingual("没有参数列", "No parameter columns"))}</small></div>`).join("") + (pendingImportedProject.skipped.length ? `<div class="project-liquid-summary-note">${escapeHtml(bilingual(`将跳过：${pendingImportedProject.skipped.join("、")}`, `Skipped: ${pendingImportedProject.skipped.join(", ")}`))}</div>` : "");
      showToast(bilingual(`已识别 ${pendingImportedProject.plates.length} 块板，请核对后确认`, `${pendingImportedProject.plates.length} plate(s) found; review before confirming`));
    } catch (error) {
      console.error(error);
      elements.importPreview.innerHTML = `<div class="project-liquid-summary-note warning">${escapeHtml(bilingual(`导入失败：${error.message}`, `Import failed: ${error.message}`))}</div>`;
      showToast(bilingual(`导入失败：${error.message}`, `Import failed: ${error.message}`));
    }
  });

  function resetImportConfirmation() {
    window.clearTimeout(importConfirmationTimer);
    importConfirmationTimer = null;
    pendingImportedProject = null;
    elements.importJsonInput.value = "";
    elements.importJsonLabel.hidden = false;
    elements.importModeSelect.hidden = true;
    elements.confirmImportButton.hidden = true;
    elements.importPreview.innerHTML = "";
  }

  elements.confirmImportButton.addEventListener("click", () => {
    if (!pendingImportedProject) return;
    const pending = pendingImportedProject;
    const mode = elements.importModeSelect.value;
    resetImportConfirmation();
    commitWorkspace(() => {
      const available = 24 - workspace.plates.length + (mode === "replace" ? 1 : 0);
      const incoming = pending.plates.slice(0, available);
      if (mode === "replace") {
        const index = workspace.plates.findIndex((plate) => plate.id === project.id);
        incoming[0].id = project.id;
        workspace.plates.splice(index, 1, ...incoming);
        workspace.activePlateId = incoming[0].id;
      } else {
        workspace.plates.push(...incoming);
        workspace.activePlateId = incoming[0].id;
      }
    });
    closeProjectFileDialog();
    showToast(bilingual(`已导入 ${pending.plates.length} 块孔板`, `${pending.plates.length} plate(s) imported`));
  });

  elements.restoreJsonInput.addEventListener("change", async () => {
    const file = elements.restoreJsonInput.files?.[0];
    if (!file) return;
    try {
      const restored = Workspace.normalizeWorkspace(JSON.parse(await file.text()));
      pendingRestoredWorkspace = restored;
      elements.restorePreview.innerHTML = `<div class="import-preview-card"><strong>${escapeHtml(restored.name)}</strong><span>${restored.plates.length} ${bilingual("块板", "plates")}</span><small>${escapeHtml(restored.plates.map((plate) => `${plate.name} · ${plate.plateSize}`).join("；"))}</small></div><div class="project-liquid-summary-note warning">${escapeHtml(bilingual("确认后将替换当前工作区；可使用撤销恢复。", "Confirming replaces the current workspace; Undo can restore it."))}</div>`;
      elements.confirmRestoreButton.hidden = false;
    } catch (error) {
      pendingRestoredWorkspace = null;
      elements.restorePreview.innerHTML = `<div class="project-liquid-summary-note warning">${escapeHtml(bilingual(`备份无法读取：${error.message}`, `Backup could not be read: ${error.message}`))}</div>`;
      elements.confirmRestoreButton.hidden = true;
    }
  });

  elements.confirmRestoreButton.addEventListener("click", () => {
    if (!pendingRestoredWorkspace) return;
    const restored = pendingRestoredWorkspace;
    commitWorkspace(() => { workspace = restored; });
    closeProjectFileDialog();
    showToast(bilingual(`已恢复“${restored.name}”（${restored.plates.length} 块板）`, `Restored “${restored.name}” (${restored.plates.length} plates)`));
  });

  elements.printButton.addEventListener("click", () => window.print());
  elements.undoButton.addEventListener("click", undo);
  elements.redoButton.addEventListener("click", redo);
  document.querySelectorAll(".language-option").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.language === language) return;
      language = button.dataset.language === "en" ? "en" : "zh";
      localStorage.setItem(LANGUAGE_KEY, language);
      elements.calculationResult.textContent = "";
      elements.calculationResult.className = "calculation-result";
      renderAll();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.summaryDrawer.hidden) {
      closeSummaryDrawer();
      return;
    }
    if (event.key === "Escape" && !elements.projectFileDialog.hidden) {
      closeProjectFileDialog();
      return;
    }
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    }
    if (event.key === "Escape" && selection.size) {
      selection = new Set();
      selectionAnchor = null;
      updateSelectionVisuals();
    }
  });

  renderAll();
  initializeIndexedStorage();
})();
