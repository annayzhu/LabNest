"use client";

import { useEffect, useMemo, useState } from "react";

type Locale = "zh" | "en";
type SectionKey =
  | "overview"
  | "projects"
  | "plans"
  | "protocols"
  | "experiments"
  | "results"
  | "reports";

const sectionKeys: SectionKey[] = [
  "overview",
  "projects",
  "plans",
  "protocols",
  "experiments",
  "results",
  "reports",
];

const text = {
  zh: {
    product: "LabNest Demo",
    subtitle: "公开演示环境 / 仅使用合成数据",
    title: "转化研究记录工作台",
    description: "从研究项目到报告的最小闭环，适合给朋友演示 LabNest 的使用方式。",
    demoNoticeTitle: "演示环境",
    demoNotice:
      "此版本不连接 LabNest 本地数据库，不接收真实样本信息，不保存到服务器。页面操作只写入当前浏览器。",
    reset: "重置演示",
    language: "EN",
    localMode: "真实 LabNest 仍保留在本机 Docker/Postgres 路径中。",
    nav: {
      overview: "Overview",
      projects: "Projects",
      plans: "Research Plans",
      protocols: "Protocols",
      experiments: "Experiments",
      results: "Results",
      reports: "Reports",
    },
    metrics: ["项目", "研究方案", "实验规程", "结果模板"],
    metricsValues: ["1", "2", "3", "2"],
    status: {
      planned: "计划中",
      active: "进行中",
      ready: "可执行",
      review: "待复核",
      done: "已汇总",
    },
    sections: {
      overview: "Workflow overview",
      projects: "Project list",
      plans: "Research plan list",
      protocols: "Protocol library",
      experiments: "Experiment runs",
      results: "Result recording",
      reports: "Report draft",
    },
    sideTitle: "当前上下文",
    notes: "现场记录",
    saveHint: "自动保存在当前浏览器",
  },
  en: {
    product: "LabNest Demo",
    subtitle: "Public demo / synthetic data only",
    title: "Translational Research Workspace",
    description:
      "A compact workflow from project setup to report drafting for showing how LabNest works.",
    demoNoticeTitle: "Demo environment",
    demoNotice:
      "This version does not connect to the local LabNest database, does not accept real sample data, and does not persist anything server-side. Edits stay in this browser.",
    reset: "Reset demo",
    language: "中",
    localMode: "The real LabNest app remains on the local Docker/Postgres path.",
    nav: {
      overview: "Overview",
      projects: "Projects",
      plans: "Research Plans",
      protocols: "Protocols",
      experiments: "Experiments",
      results: "Results",
      reports: "Reports",
    },
    metrics: ["Projects", "Plans", "Protocols", "Templates"],
    metricsValues: ["1", "2", "3", "2"],
    status: {
      planned: "Planned",
      active: "Active",
      ready: "Ready",
      review: "Review",
      done: "Summarized",
    },
    sections: {
      overview: "Workflow overview",
      projects: "Project list",
      plans: "Research plan list",
      protocols: "Protocol library",
      experiments: "Experiment runs",
      results: "Result recording",
      reports: "Report draft",
    },
    sideTitle: "Current context",
    notes: "Bench notes",
    saveHint: "Saved in this browser",
  },
};

const workflow = [
  {
    key: "projects",
    zhTitle: "DEMO-PRJ-001 / FBN2 与 ZNF436 表达验证",
    enTitle: "DEMO-PRJ-001 / FBN2 and ZNF436 expression validation",
    zhBody: "项目记录研究目标、负责人、关联方案和当前进展。",
    enBody: "The project holds the goal, owner, linked plans, and current progress.",
    status: "active",
  },
  {
    key: "plans",
    zhTitle: "研究方案 / siRNA 干预与表达检测",
    enTitle: "Research plan / siRNA perturbation and expression assay",
    zhBody: "方案记录科学前提、实验路线、关键判定标准和关联规程。",
    enBody: "Plans capture scientific premise, route, decision criteria, and linked protocols.",
    status: "planned",
  },
  {
    key: "protocols",
    zhTitle: "实验规程 / RNA 提取、逆转录、qPCR",
    enTitle: "Protocols / RNA extraction, RT, qPCR",
    zhBody: "通用规程可被研究方案适配，然后用于多次实验。",
    enBody: "General protocols can be adapted to the plan and reused across runs.",
    status: "ready",
  },
  {
    key: "experiments",
    zhTitle: "实验 / DEMO-EXP-20260815-01",
    enTitle: "Experiment / DEMO-EXP-20260815-01",
    zhBody: "实验记录现场执行、样本批次、检查项和偏差说明。",
    enBody: "Runs record execution, sample batches, checks, and deviations.",
    status: "active",
  },
  {
    key: "results",
    zhTitle: "结果 / Ct 表与 2^-ΔΔCt 汇总",
    enTitle: "Results / Ct table and 2^-ΔΔCt summary",
    zhBody: "结果模板把表格、文件、重点指标和实验关联放在一起。",
    enBody: "Templates keep tables, files, key metrics, and experiment links together.",
    status: "review",
  },
  {
    key: "reports",
    zhTitle: "报告 / 项目阶段性总结",
    enTitle: "Report / interim project summary",
    zhBody: "报告从项目、实验和结果中汇总证据，便于后续整理。",
    enBody: "Reports assemble evidence from project, experiments, and results.",
    status: "done",
  },
] as const;

const records = {
  projects: [
    {
      code: "DEMO-PRJ-001",
      zhTitle: "FBN2 与 ZNF436 对 LUAD 细胞状态的影响",
      enTitle: "FBN2 and ZNF436 effects on LUAD cell states",
      zhBody: "以 A549、NCI-H596、NCI-H358 为示例模型，串联细胞状态观察、RNA 提取、qPCR 和结果整理。",
      enBody:
        "A synthetic workflow linking cell-state observation, RNA extraction, qPCR, and result review across example LUAD cell lines.",
      chips: ["Owner: Demo user", "Status: Active", "No real samples"],
    },
  ],
  plans: [
    {
      code: "DEMO-RP-001",
      zhTitle: "siRNA 敲低后表达变化检测",
      enTitle: "Expression change after siRNA knockdown",
      zhBody: "关联 RNA 提取、逆转录和 qPCR 三个规程，实验粒度为一次细胞处理批次。",
      enBody:
        "Links RNA extraction, reverse transcription, and qPCR protocols at one treatment-batch grain.",
      chips: ["3 protocols", "2 result templates", "Draft"],
    },
    {
      code: "DEMO-RP-002",
      zhTitle: "基础细胞质量控制与支原体排查",
      enTitle: "Baseline cell QC and mycoplasma check",
      zhBody: "用于说明 Research Plan 可容纳不同研究路线，而不是直接从 Project 跳到 Experiment。",
      enBody:
        "Shows that Research Plans sit between Projects and Experiments instead of jumping directly to runs.",
      chips: ["QC", "Protocol-linked", "Planned"],
    },
  ],
  protocols: [
    {
      code: "DEMO-PRT-100008",
      zhTitle: "细胞 RNA 提取",
      enTitle: "Cell RNA extraction",
      zhBody: "适配当前项目的版本保留关键材料、风险提示和可打印步骤。",
      enBody:
        "The project-adapted version keeps materials, risk notes, and printable steps.",
      chips: ["Version 0.1", "Active", "A4 print"],
    },
    {
      code: "DEMO-PRT-100009",
      zhTitle: "RNA 逆转录",
      enTitle: "RNA reverse transcription",
      zhBody: "同一规程可被多次 Experiment 复用，并保留版本来源。",
      enBody:
        "The same protocol can be reused across runs while preserving version provenance.",
      chips: ["Reusable", "Versioned", "Linked"],
    },
    {
      code: "DEMO-PRT-200101",
      zhTitle: "qPCR 表达检测",
      enTitle: "qPCR expression assay",
      zhBody: "结果模板预设 Ct 原始表和 fold-change 汇总表。",
      enBody: "Result templates include a raw Ct table and a fold-change summary.",
      chips: ["Template-ready", "qPCR", "Structured"],
    },
  ],
} as const;

const experimentChecks = [
  {
    id: "cell-qc",
    zhTitle: "细胞状态检查",
    enTitle: "Cell-state check",
    zhBody: "记录融合度、污染风险和传代信息。",
    enBody: "Record confluency, contamination risk, and passage context.",
  },
  {
    id: "rna-extraction",
    zhTitle: "RNA 提取完成",
    enTitle: "RNA extraction completed",
    zhBody: "记录批号、洗脱体积和样本编号。",
    enBody: "Record lot, elution volume, and sample identifiers.",
  },
  {
    id: "rt-reaction",
    zhTitle: "逆转录反应完成",
    enTitle: "Reverse transcription completed",
    zhBody: "记录模板量、试剂盒和 no-RT 对照。",
    enBody: "Record input, kit, and no-RT control.",
  },
  {
    id: "qpcr-run",
    zhTitle: "qPCR 上机完成",
    enTitle: "qPCR run completed",
    zhBody: "确认 NTC、内参、重复孔和熔解曲线。",
    enBody: "Check NTC, reference gene, replicates, and melt curves.",
  },
] as const;

const initialChecks = Object.fromEntries(
  experimentChecks.map((item, index) => [item.id, index < 2]),
) as Record<string, boolean>;

const resultRows = [
  ["DEMO-S01", "A549", "siNC", "FBN2", "23.41", "1.00"],
  ["DEMO-S02", "A549", "siFBN2-1", "FBN2", "27.88", "0.18"],
  ["DEMO-S03", "NCI-H596", "siNC", "ZNF436", "24.02", "1.00"],
  ["DEMO-S04", "NCI-H596", "siZNF436", "ZNF436", "28.11", "0.21"],
];

const plateRows = [
  ["A01", "DEMO-S01", "A549", "siNC"],
  ["A02", "DEMO-S02", "A549", "siFBN2-1"],
  ["A03", "DEMO-S03", "NCI-H596", "siNC"],
  ["A04", "DEMO-S04", "NCI-H596", "siZNF436"],
];

function localized<T extends { zhTitle: string; enTitle: string; zhBody: string; enBody: string }>(
  item: T,
  locale: Locale,
) {
  return {
    title: locale === "zh" ? item.zhTitle : item.enTitle,
    body: locale === "zh" ? item.zhBody : item.enBody,
  };
}

type DemoState = {
  locale: Locale;
  active: SectionKey;
  checks: Record<string, boolean>;
  note: string;
};

const defaultNote =
  "DEMO: A549 cells looked healthy before RNA extraction. NTC clean. Repeat qPCR if replicate SD > 0.5 Ct.";

function defaultDemoState(): DemoState {
  return {
    locale: "zh",
    active: "overview",
    checks: initialChecks,
    note: defaultNote,
  };
}

function readInitialDemoState(): DemoState {
  if (typeof window === "undefined") return defaultDemoState();

  const saved = window.localStorage.getItem("labnest-demo-state");
  if (!saved) return defaultDemoState();

  try {
    const parsed = JSON.parse(saved) as Partial<DemoState>;
    return {
      locale: parsed.locale === "zh" || parsed.locale === "en" ? parsed.locale : "zh",
      active: parsed.active && sectionKeys.includes(parsed.active) ? parsed.active : "overview",
      checks: parsed.checks ? { ...initialChecks, ...parsed.checks } : initialChecks,
      note: typeof parsed.note === "string" ? parsed.note : defaultNote,
    };
  } catch {
    window.localStorage.removeItem("labnest-demo-state");
    return defaultDemoState();
  }
}

export default function Home() {
  const [demoState, setDemoState] = useState<DemoState>(readInitialDemoState);
  const { active, checks, locale, note } = demoState;

  useEffect(() => {
    window.localStorage.setItem("labnest-demo-state", JSON.stringify(demoState));
  }, [demoState]);

  const t = text[locale];
  const progress = useMemo(() => {
    const done = Object.values(checks).filter(Boolean).length;
    return Math.round((done / experimentChecks.length) * 100);
  }, [checks]);

  function updateState(patch: Partial<DemoState>) {
    setDemoState((current) => ({ ...current, ...patch }));
  }

  function resetDemo() {
    setDemoState(defaultDemoState());
    window.localStorage.removeItem("labnest-demo-state");
  }

  return (
    <main className="demo-shell">
      <aside className="demo-sidebar">
        <div className="demo-brand">
          <div className="demo-brand-row">
            <div className="demo-logo">{t.product}</div>
            <span className="demo-badge">Demo</span>
          </div>
          <p className="demo-subtitle">{t.subtitle}</p>
        </div>

        <nav className="demo-nav" aria-label="LabNest demo sections">
          {sectionKeys.map((key, index) => (
            <button
              className={active === key ? "is-active" : undefined}
              key={key}
              onClick={() => updateState({ active: key })}
              type="button"
            >
              <span>{t.nav[key]}</span>
              <small>{String(index + 1).padStart(2, "0")}</small>
            </button>
          ))}
        </nav>

        <div className="demo-sidebar-footer">
          <span>{t.localMode}</span>
          <span>{t.saveHint}</span>
        </div>
      </aside>

      <section className="demo-main">
        <div className="demo-topbar">
          <div className="demo-title-block">
            <h1>{t.title}</h1>
            <p>{t.description}</p>
          </div>
          <div className="demo-actions">
            <button
              className="demo-button"
              onClick={() => updateState({ locale: locale === "zh" ? "en" : "zh" })}
              type="button"
            >
              {t.language}
            </button>
            <button className="demo-button" onClick={resetDemo} type="button">
              {t.reset}
            </button>
            <button className="demo-button primary" onClick={() => updateState({ active: "experiments" })} type="button">
              {locale === "zh" ? "进入实验记录" : "Open run"}
            </button>
          </div>
        </div>

        <div className="demo-content">
          <div className="demo-alert">
            <div>
              <strong>{t.demoNoticeTitle}</strong>
              {t.demoNotice}
            </div>
            <span className="demo-badge">DEMO DATA</span>
          </div>

          {active === "overview" ? (
            <Overview locale={locale} progress={progress} />
          ) : (
            <SectionPanel
              active={active}
              checks={checks}
              locale={locale}
              note={note}
              progress={progress}
              setChecks={(nextChecks) => updateState({ checks: nextChecks })}
              setNote={(nextNote) => updateState({ note: nextNote })}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function Overview({ locale, progress }: { locale: Locale; progress: number }) {
  const t = text[locale];

  return (
    <div className="demo-grid">
      <section className="demo-panel">
        <div className="demo-panel-header">
          <h2>{t.sections.overview}</h2>
          <span>{progress}% run progress</span>
        </div>
        <div className="demo-panel-body workflow">
          {workflow.map((item) => {
            const localizedItem = localized(item, locale);
            const statusClass =
              item.status === "active" || item.status === "ready"
                ? "active"
                : item.status === "review"
                  ? "warn"
                  : "";
            return (
              <div className="workflow-row" key={item.key}>
                <strong>{t.nav[item.key as SectionKey]}</strong>
                <div>
                  <strong>{localizedItem.title}</strong>
                  <p>{localizedItem.body}</p>
                </div>
                <span className={`status-pill ${statusClass}`}>{t.status[item.status]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <SideContext locale={locale} progress={progress} />
    </div>
  );
}

function SectionPanel({
  active,
  locale,
  checks,
  setChecks,
  note,
  setNote,
  progress,
}: {
  active: SectionKey;
  locale: Locale;
  checks: Record<string, boolean>;
  setChecks: (value: Record<string, boolean>) => void;
  note: string;
  setNote: (value: string) => void;
  progress: number;
}) {
  const t = text[locale];

  return (
    <div className="demo-grid">
      <section className="demo-panel">
        <div className="demo-panel-header">
          <h2>{t.sections[active]}</h2>
          <span>DEMO-CTX-001</span>
        </div>
        <div className="demo-panel-body">
          {active === "projects" && <RecordList locale={locale} type="projects" />}
          {active === "plans" && <ResearchPlanView locale={locale} />}
          {active === "protocols" && <ProtocolView locale={locale} />}
          {active === "experiments" && (
            <ExperimentView checks={checks} locale={locale} setChecks={setChecks} />
          )}
          {active === "results" && <ResultsView locale={locale} />}
          {active === "reports" && <ReportView locale={locale} />}
        </div>
      </section>

      <SideContext locale={locale} note={note} progress={progress} setNote={setNote} />
    </div>
  );
}

function SideContext({
  locale,
  note,
  progress,
  setNote,
}: {
  locale: Locale;
  note?: string;
  progress: number;
  setNote?: (value: string) => void;
}) {
  const t = text[locale];

  return (
    <aside className="demo-panel">
      <div className="demo-panel-header">
        <h3>{t.sideTitle}</h3>
        <span>{progress}%</span>
      </div>
      <div className="demo-panel-body record-list">
        <dl className="demo-metrics">
          {t.metrics.map((label, index) => (
            <div className="metric" key={label}>
              <dt>{label}</dt>
              <dd>{t.metricsValues[index]}</dd>
            </div>
          ))}
        </dl>
        <div className="record-card">
          <h3>{locale === "zh" ? "当前实验" : "Current run"}</h3>
          <p>DEMO-EXP-20260815-01 · DEMO-RP-001 · DEMO-PRJ-001</p>
          <div className="meta-row">
            <span className="chip">A549</span>
            <span className="chip">NCI-H596</span>
            <span className="chip">qPCR</span>
          </div>
        </div>
        {setNote ? (
          <div className="record-card">
            <h3>{t.notes}</h3>
            <textarea
              aria-label={t.notes}
              className="note-box"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function RecordList({ locale, type }: { locale: Locale; type: keyof typeof records }) {
  return (
    <div className="record-list">
      {records[type].map((item) => {
        const localizedItem = localized(item, locale);
        return (
          <article className="record-card" key={item.code}>
            <h3>
              {item.code} · {localizedItem.title}
            </h3>
            <p>{localizedItem.body}</p>
            <div className="meta-row">
              {item.chips.map((chip) => (
                <span className="chip" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ResearchPlanView({ locale }: { locale: Locale }) {
  return (
    <div className="record-list">
      <RecordList locale={locale} type="plans" />
      <div className="doc-preview">
        <h3>{locale === "zh" ? "科学前提" : "Scientific premise"}</h3>
        <p>
          {locale === "zh"
            ? "公共数据提示 FBN2 与 ZNF436 可能与 LUAD 细胞状态相关。本方案只作为实验室内部探索性验证示例，不包含真实患者或样本数据。"
            : "Public-data signals suggest FBN2 and ZNF436 may relate to LUAD cell states. This demo plan is exploratory and contains no real patient or sample data."}
        </p>
        <h4>{locale === "zh" ? "关联规程" : "Linked protocols"}</h4>
        <ul>
          <li>DEMO-PRT-100008 RNA extraction</li>
          <li>DEMO-PRT-100009 Reverse transcription</li>
          <li>DEMO-PRT-200101 qPCR expression assay</li>
        </ul>
      </div>
    </div>
  );
}

function ProtocolView({ locale }: { locale: Locale }) {
  return (
    <div className="record-list">
      <RecordList locale={locale} type="protocols" />
      <div className="doc-preview">
        <h3>{locale === "zh" ? "DEMO-PRT-100008 细胞 RNA 提取" : "DEMO-PRT-100008 Cell RNA extraction"}</h3>
        <section>
          <h4>{locale === "zh" ? "目的" : "Purpose"}</h4>
          <p>
            {locale === "zh"
              ? "从示例细胞样本中提取总 RNA，用于后续逆转录和 qPCR 表达检测。"
              : "Extract total RNA from example cell samples for downstream reverse transcription and qPCR."}
          </p>
        </section>
        <section>
          <h4>{locale === "zh" ? "步骤" : "Steps"}</h4>
          <ol>
            <li>{locale === "zh" ? "确认细胞状态和样本编号。" : "Confirm cell state and sample identifiers."}</li>
            <li>{locale === "zh" ? "加入裂解液并充分混匀。" : "Add lysis buffer and mix thoroughly."}</li>
            <li>
              {locale === "zh"
                ? "完成柱纯化、洗涤、洗脱和质控记录。"
                : "Complete column purification, wash, elution, and QC recording."}
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}

function ExperimentView({
  checks,
  locale,
  setChecks,
}: {
  checks: Record<string, boolean>;
  locale: Locale;
  setChecks: (value: Record<string, boolean>) => void;
}) {
  return (
    <div className="record-list">
      <div className="checklist">
        {experimentChecks.map((item) => {
          const localizedItem = localized(item, locale);
          return (
            <label className="check-item" key={item.id}>
              <input
                aria-label={localizedItem.title}
                checked={checks[item.id]}
                onChange={(event) => setChecks({ ...checks, [item.id]: event.target.checked })}
                type="checkbox"
              />
              <span>
                <strong>{localizedItem.title}</strong>
                <span>{localizedItem.body}</span>
              </span>
            </label>
          );
        })}
      </div>
      <DemoTable
        headers={locale === "zh" ? ["孔位", "样本", "细胞", "处理"] : ["Well", "Sample", "Cell", "Treatment"]}
        rows={plateRows}
      />
    </div>
  );
}

function ResultsView({ locale }: { locale: Locale }) {
  return (
    <div className="record-list">
      <div className="report-box">
        <h3>{locale === "zh" ? "结果模板：qPCR 表达检测" : "Result template: qPCR expression assay"}</h3>
        <p>
          {locale === "zh"
            ? "一个 Experiment 可挂载多张结果 sheet，例如 Ct 原始表、fold-change 汇总表、图片或附件。"
            : "One experiment can hold multiple result sheets, such as raw Ct, fold-change summary, images, or attachments."}
        </p>
      </div>
      <DemoTable
        headers={
          locale === "zh"
            ? ["样本", "细胞", "处理", "靶基因", "Ct", "相对表达"]
            : ["Sample", "Cell", "Treatment", "Target", "Ct", "Relative expression"]
        }
        rows={resultRows}
      />
    </div>
  );
}

function ReportView({ locale }: { locale: Locale }) {
  return (
    <div className="doc-preview">
      <h3>{locale === "zh" ? "DEMO-RPT-001 项目阶段性总结" : "DEMO-RPT-001 Interim project summary"}</h3>
      <section>
        <h4>{locale === "zh" ? "证据来源" : "Evidence sources"}</h4>
        <ul>
          <li>DEMO-EXP-20260815-01</li>
          <li>DEMO-RESULT-QPCR-001</li>
          <li>DEMO-PRT-100008 / 100009 / 200101</li>
        </ul>
      </section>
      <section>
        <h4>{locale === "zh" ? "阶段判断" : "Interim readout"}</h4>
        <p>
          {locale === "zh"
            ? "示例数据提示 siRNA 处理后目标基因表达下降；真实项目中该结论需要重复实验、质控记录和原始文件共同支持。"
            : "Synthetic data suggest reduced target expression after siRNA treatment; a real project would require replicates, QC records, and raw files."}
        </p>
      </section>
    </div>
  );
}

function DemoTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="demo-table-wrap">
      <table className="demo-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("-")}>
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
