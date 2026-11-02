"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { AlertTriangle, CalendarPlus, Check, ChevronDown, Minus, MoreHorizontal, Pencil, Plus, Scissors, Trash2, Undo2, Wand2, Workflow, List, X } from "lucide-react";
import { saveSchedule, setItemDone, type ScheduleSaveResult } from "@/app/experiments/[id]/schedule/actions";
import {
  addDays, blockState, blockTitle, daysBetween, defaultWorkHours, draftSchedule, formatDuration, formatWait, formatWindow, insertDay, labClock, labDayKey, labInstant, labMinuteOfDay,
  localizeBlockTitle, MAX_SCHEDULE_DAYS, moveBlock, removeDay, scheduleDayLabel, scheduleMarks, scheduleSpan, shiftSchedule, sortBlocks, weekday,
  type BlockMark, type OtherBlock, type ScheduleBlock, type ScheduleStep, type WorkHours,
} from "@/lib/experiment-schedule";
import { useI18n } from "./I18nProvider";
import "./experiment-schedule.css";

type Props = {
  experiment: { id: string; runCode: string; status: string };
  editable: boolean;
  steps: ScheduleStep[];
  blocks: ScheduleBlock[];
  token: string;
  others: OtherBlock[];
  suggestedStart: string;
  todayKey: string;
  /** Day 1 and the length the author saved (Q314, Q315); null follows the blocks. */
  startDay: string;
  savedDays: number | null;
};
type Connector = { id: string; d: string; warn: boolean };

const hoursKey = "labnest.schedule.hours";
const viewKey = "labnest.schedule.view";
const clockMinutes = (value: string) => { const [h, m] = value.split(":").map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN; };
const clockOf = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const waitText = (minutes: number) => formatWait(Math.max(0, minutes) * 60);

/**
 * The schedule (Q262, Q314–Q317): days left to right from day 1, a card for each block, the waits between them as
 * labelled connectors. The author sets day 1 and how many days there are; days can be put in or taken out, and the
 * schedule never ends before its last block. A card dragged to another day takes the blocks that wait for it along unless
 * only that block should move. Below 768 px the days stack and fold. Nothing is saved until "Save schedule".
 */
export function ExperimentScheduleBoard({ experiment, editable, steps, blocks: initialBlocks, token: initialToken, others, suggestedStart, todayKey, startDay, savedDays }: Props) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const router = useRouter();
  const initialDays = Math.max(savedDays ?? 1, scheduleSpan(startDay, initialBlocks));
  const [saved, setSaved] = useState({ blocks: initialBlocks, token: initialToken, startDay, days: initialDays });
  const [blocks, setBlocks] = useState(initialBlocks);
  const [start, setStart] = useState(startDay);
  const [length, setLength] = useState(initialDays);
  const [menuDay, setMenuDay] = useState<string | null>(null);
  const [confirmDay, setConfirmDay] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "list">("board");
  const [hours, setHours] = useState<WorkHours>(defaultWorkHours);
  const [chain, setChain] = useState(true);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drafting, setDrafting] = useState(!initialBlocks.length);
  const [draftClock, setDraftClock] = useState(labClock(suggestedStart));
  const [pending, startTransition] = useTransition();

  // Working hours and the chosen view are this browser's own settings.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const storedHours = JSON.parse(localStorage.getItem(hoursKey) ?? "null");
        if (storedHours && Number.isFinite(storedHours.start) && Number.isFinite(storedHours.end) && Array.isArray(storedHours.workdays)) setHours(storedHours);
        if (localStorage.getItem(viewKey) === "list") setView("list");
      } catch { /* settings stay at their defaults */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  // A day's menu closes on a click anywhere else.
  useEffect(() => {
    if (!menuDay) return;
    const close = (event: PointerEvent) => { if (!(event.target instanceof Element && event.target.closest(".ln-schedule-day-menu"))) { setMenuDay(null); setConfirmDay(null); } };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuDay]);
  const remember = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private window: not kept */ } };
  const changeHours = (next: WorkHours) => { setHours(next); remember(hoursKey, JSON.stringify(next)); };
  const changeView = (next: "board" | "list") => { setView(next); remember(viewKey, next); };

  const stepMap = useMemo(() => new Map(steps.map(step => [step.ref, step])), [steps]);
  const ordered = useMemo(() => sortBlocks(blocks), [blocks]);
  const locked = useMemo(() => new Set(blocks.filter(block => blockState(block, stepMap) === "done").map(block => block.id)), [blocks, stepMap]);
  const marks = useMemo(() => scheduleMarks(blocks, { hours, others }), [blocks, hours, others]);
  // A block put before day 1 makes its day the first; a block past the last day lengthens the schedule.
  const firstDay = ordered[0] && labDayKey(ordered[0].startAt) < start ? labDayKey(ordered[0].startAt) : start;
  const minDays = scheduleSpan(firstDay, blocks);
  const dayCount = Math.max(length + daysBetween(firstDay, start), minDays);
  const days = Array.from({ length: dayCount }, (_, index) => addDays(firstDay, index));
  const lastDay = days[days.length - 1];
  const dirty = JSON.stringify(sortBlocks(blocks)) !== JSON.stringify(sortBlocks(saved.blocks)) || firstDay !== saved.startDay || dayCount !== saved.days;
  const scheduled = new Set(blocks.flatMap(block => block.stepRefs));
  const unscheduled = steps.filter(step => !scheduled.has(step.ref) && !step.completed);
  const movedSaved = blocks.some(block => { const before = saved.blocks.find(item => item.id === block.id); return before && before.startAt !== block.startAt; });
  const needsReason = experiment.status === "running" && movedSaved;
  const selected = blocks.find(block => block.id === selectedId) ?? null;
  const dayIndex = (dayKey: string) => daysBetween(firstDay, dayKey) + 1;
  const stepBlocks = blocks.filter(block => block.kind === "steps").length;
  const openItems = blocks.filter(block => block.kind === "task" && !block.doneAt).length;

  const apply = (next: ScheduleBlock[]) => { setBlocks(next); setError(""); setNotice(""); };
  const doneError = () => setError(zh ? "已完成的段不能移动；请先调整其他天。" : "A done block stays where it is; change the other days instead.");
  /** The length from the current day 1, so a day put before it is not lost. */
  const resize = (count: number) => { setStart(firstDay); setLength(Math.min(MAX_SCHEDULE_DAYS, Math.max(minDays, count))); };

  function changeStart(next: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || next === firstDay) return;
    const shift = daysBetween(firstDay, next);
    if (blocks.length) {
      if (locked.size) { doneError(); return; }
      apply(shiftSchedule(blocks, shift * 86_400_000));
      setNotice(zh ? `整份日程${shift > 0 ? "推后" : "提前"} ${Math.abs(shift)} 天（${blocks.length} 项），检查后保存。` : `The whole schedule moved ${Math.abs(shift)} day${Math.abs(shift) === 1 ? "" : "s"} ${shift > 0 ? "later" : "earlier"} (${blocks.length} blocks). Check it, then save.`);
    }
    setStart(next);
    setLength(dayCount);
  }
  function putDay(dayKey: string) {
    if (dayCount >= MAX_SCHEDULE_DAYS) { setError(zh ? `日程最长 ${MAX_SCHEDULE_DAYS} 天。` : `A schedule spans ${MAX_SCHEDULE_DAYS} days at most.`); return; }
    try { apply(insertDay(blocks, dayKey, locked)); } catch { doneError(); return; }
    setStart(firstDay); setLength(dayCount + 1); setMenuDay(null);
  }
  function takeDay(dayKey: string) {
    const count = blocks.filter(block => labDayKey(block.startAt) === dayKey).length;
    if (count && confirmDay !== dayKey) { setConfirmDay(dayKey); return; }
    let next: ScheduleBlock[];
    try { next = removeDay(blocks, dayKey, locked); } catch { doneError(); return; }
    apply(next);
    // Taking out day 1 makes the next day the first; the others keep their place.
    setStart(dayKey === firstDay ? addDays(firstDay, 1) : firstDay);
    setLength(Math.max(1, dayCount - 1));
    setMenuDay(null); setConfirmDay(null); setSelectedId(null);
    if (count) setNotice(zh ? `删除了这一天和其中 ${count} 项，后面的事项提前了一天。` : `The day and its ${count} block${count === 1 ? "" : "s"} were taken out; later days moved one day earlier.`);
  }
  const update = (id: string, patch: Partial<ScheduleBlock>) => apply(blocks.map(block => block.id === id ? { ...block, ...patch } : block));
  const move = (id: string, startAt: string) => {
    try { apply(moveBlock(blocks, id, startAt, { chain, locked })); }
    catch (cause) { setError(cause instanceof Error && cause.message === "A done block stays where it is" ? (zh ? "已完成的段不能移动。" : "A done block stays where it is.") : (zh ? "这一段不能移动。" : "This block cannot move.")); }
  };

  function draft() {
    const begin = labInstant(firstDay, clockMinutes(draftClock));
    if (Number.isNaN(Date.parse(begin))) { setError(zh ? "请选择开始的日期和时间。" : "Choose a start date and time."); return; }
    if (locked.size) { setError(zh ? "已有完成的段，不能重新排初稿；请直接调整。" : "Some blocks are done: adjust the schedule instead of redrafting it."); return; }
    const drafted = draftSchedule(steps, begin, { hours, newId: () => crypto.randomUUID() });
    if (!drafted.length) { setError(zh ? "没有可以安排的步骤。" : "There are no open steps to schedule."); return; }
    // Items stay where they were; what they waited for may be gone.
    const items = blocks.filter(block => block.kind === "task").map(block => ({ ...block, afterBlockId: null, minGapMinutes: null, maxGapMinutes: null, gapSource: null }));
    apply([...drafted, ...items]);
    setDrafting(false);
    setNotice(zh ? `排出 ${drafted.length} 段初稿，检查后保存。` : `Drafted ${drafted.length} blocks. Check them, then save.`);
  }

  function addItem(dayKey: string) {
    const id = crypto.randomUUID();
    apply([...blocks, { id, kind: "task", title: "", stepRefs: [], startAt: labInstant(dayKey, hours.start), allDay: true, estimatedMinutes: null, afterBlockId: null, minGapMinutes: null, maxGapMinutes: null, gapSource: null, note: null, doneAt: null }]);
    setSelectedId(id);
  }

  function split(block: ScheduleBlock, index: number) {
    const id = crypto.randomUUID();
    const kept = block.stepRefs.slice(0, index), rest = block.stepRefs.slice(index);
    const share = block.estimatedMinutes ? Math.max(5, Math.round(block.estimatedMinutes * kept.length / block.stepRefs.length)) : null;
    const startAt = new Date(Date.parse(block.startAt) + (share ?? 30) * 60_000).toISOString();
    apply([...blocks.map(item => item.id === block.id ? { ...item, stepRefs: kept, estimatedMinutes: share } : item.afterBlockId === block.id ? { ...item, afterBlockId: id } : item),
      { ...block, id, title: null, stepRefs: rest, startAt, estimatedMinutes: block.estimatedMinutes && share ? Math.max(5, block.estimatedMinutes - share) : null, afterBlockId: block.id, minGapMinutes: 0, maxGapMinutes: null, gapSource: "manual", note: null }]);
  }

  function merge(block: ScheduleBlock) {
    const previous = blocks.find(item => item.id === block.afterBlockId);
    if (!previous || previous.kind !== "steps" || block.kind !== "steps") return;
    apply(blocks.filter(item => item.id !== block.id).map(item => item.id === previous.id ? { ...item, stepRefs: [...item.stepRefs, ...block.stepRefs], estimatedMinutes: (item.estimatedMinutes ?? 0) + (block.estimatedMinutes ?? 0) || null }
      : item.afterBlockId === block.id ? { ...item, afterBlockId: previous.id } : item));
    setSelectedId(previous.id);
  }

  function remove(block: ScheduleBlock) {
    apply(blocks.filter(item => item.id !== block.id).map(item => item.afterBlockId === block.id ? { ...item, afterBlockId: block.afterBlockId } : item));
    setSelectedId(null);
  }

  function addToBlock(block: ScheduleBlock, ref: string) {
    const order = new Map(steps.map((step, index) => [step.ref, index]));
    update(block.id, { stepRefs: [...block.stepRefs, ref].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)) });
  }

  const settle = (result: ScheduleSaveResult, keepLocal = false) => {
    if (!result.ok) { setError(result.error); return false; }
    setSaved(current => ({ blocks: result.blocks, token: result.token, startDay: result.startDay ?? current.startDay, days: result.days ?? current.days }));
    if (!keepLocal) setBlocks(result.blocks);
    if (!keepLocal && result.startDay && result.days) { setStart(result.startDay); setLength(result.days); }
    router.refresh();
    return true;
  };
  function save() {
    if (needsReason && !reason.trim()) { setError(zh ? "实验进行中改期，请写一句原因。" : "The experiment is under way: say why the schedule changes."); return; }
    startTransition(async () => {
      const done = settle(await saveSchedule({ experimentId: experiment.id, token: saved.token, blocks, startDay: firstDay, days: dayCount, reason: needsReason ? reason.trim() : undefined }));
      if (done) { setReason(""); setNotice(zh ? "日程已保存。" : "Schedule saved."); }
    });
  }
  function toggleDone(block: ScheduleBlock) {
    const done = !block.doneAt;
    if (!saved.blocks.some(item => item.id === block.id)) { update(block.id, { doneAt: done ? new Date().toISOString() : null }); return; }
    startTransition(async () => {
      const result = await setItemDone({ experimentId: experiment.id, blockId: block.id, done });
      // Other unsaved changes on the page stay; only this item's tick comes from the server.
      if (settle(result, true) && result.ok) setBlocks(current => current.map(item => item.id === block.id ? { ...item, doneAt: result.blocks.find(row => row.id === block.id)?.doneAt ?? null } : item));
    });
  }

  // Connectors between cards, measured after layout and on every resize.
  const trackRef = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [links, setLinks] = useState<Connector[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const base = track.getBoundingClientRect();
    const next: Connector[] = [];
    for (const block of blocks) {
      const from = block.afterBlockId ? cards.current.get(block.afterBlockId) : undefined, to = cards.current.get(block.id);
      if (!from || !to) continue;
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      const warn = Boolean(marks[block.id]?.some(mark => mark.kind === "window" || mark.kind === "order"));
      if (Math.abs(a.left - b.left) < a.width / 2) {
        const x = a.left + a.width / 2 - base.left, y1 = a.bottom - base.top, y2 = b.top - base.top;
        next.push({ id: block.id, d: `M ${x} ${y1} L ${x} ${y2}`, warn });
      } else {
        const x1 = a.right - base.left, y1 = a.top + Math.min(a.height / 2, 32) - base.top, x2 = b.left - base.left, y2 = b.top + Math.min(b.height / 2, 32) - base.top;
        const bend = Math.max(28, Math.abs(x2 - x1) / 2);
        next.push({ id: block.id, d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`, warn });
      }
    }
    setLinks(next);
    setSize({ width: track.scrollWidth, height: track.scrollHeight });
  }, [blocks, marks]);
  useLayoutEffect(() => { if (view === "board") measure(); }, [measure, view]);
  useEffect(() => {
    const track = trackRef.current;
    if (!track || view !== "board") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(track);
    return () => observer.disconnect();
  }, [measure, view]);

  const onDrop = (event: DragEvent<HTMLElement>, dayKey: string) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    const block = blocks.find(item => item.id === id);
    if (!block || labDayKey(block.startAt) === dayKey) return;
    move(id, labInstant(dayKey, labMinuteOfDay(block.startAt)));
  };

  const card = (block: ScheduleBlock) => {
    const state = blockState(block, stepMap);
    const blockMarks = marks[block.id] ?? [];
    const draggable = editable && !locked.has(block.id);
    const gap = block.afterBlockId ? gapLabel(block, stepMap, zh) : null;
    const warn = blockMarks.some(mark => mark.kind === "window" || mark.kind === "order");
    const title = titleOf(block, stepMap, zh);
    return <article key={block.id} ref={element => { if (element) cards.current.set(block.id, element); else cards.current.delete(block.id); }}
      className="ln-schedule-card focus-ring" data-state={state} data-kind={block.kind} aria-current={selectedId === block.id ? "true" : undefined} data-marked={blockMarks.length ? "" : undefined}
      tabIndex={0} role="button" aria-label={title} draggable={draggable} onDragStart={event => { event.dataTransfer.setData("text/plain", block.id); event.dataTransfer.effectAllowed = "move"; }}
      onClick={() => setSelectedId(block.id)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedId(block.id); } }}>
      {gap ? <p className="ln-schedule-wait" data-warn={warn ? "" : undefined} data-i18n-ignore>{zh ? `等待 ${gap}` : `After ${gap}`}</p> : null}
      <div className="ln-schedule-card-top">
        <span className="ln-schedule-time" data-i18n-ignore>{block.allDay ? (zh ? "全天" : "All day") : labClock(block.startAt)}{block.estimatedMinutes ? <small>{formatDuration(block.estimatedMinutes)}</small> : null}</span>
        {blockMarks.length ? <span className="ln-schedule-flag" title={blockMarks.map(mark => markText(mark, zh)).join("\n")} data-i18n-ignore><AlertTriangle aria-hidden />{blockMarks.length}</span> : null}
        {editable ? <span className="ln-schedule-card-actions">
          <button type="button" className="focus-ring" title={zh ? "编辑" : "Edit"} aria-label={zh ? `编辑：${title}` : `Edit ${title}`} onClick={event => { event.stopPropagation(); setSelectedId(block.id); }}><Pencil aria-hidden /></button>
          {!locked.has(block.id) ? <button type="button" className="focus-ring" data-danger="" title={block.kind === "task" ? (zh ? "删除事项" : "Remove item") : (zh ? "移出日程" : "Take off the schedule")} aria-label={zh ? `删除：${title}` : `Remove ${title}`} onClick={event => { event.stopPropagation(); remove(block); }}><Trash2 aria-hidden /></button> : null}
        </span> : null}
      </div>
      <h3 data-i18n-ignore>{block.kind === "task" && block.doneAt ? <Check className="ln-schedule-done-icon" aria-hidden /> : null}<span>{title}</span></h3>
      <p className="ln-schedule-meta" data-i18n-ignore>
        <span className="ln-schedule-pill" data-state={block.kind === "task" ? (block.doneAt ? "done" : "todo") : state}>{block.kind === "task" ? (block.doneAt ? (zh ? "已完成" : "Done") : (zh ? "事项" : "Item")) : stateText(state, zh)}</span>
        {block.kind === "steps" && block.stepRefs.length ? <span>{zh ? `${block.stepRefs.length} 步` : `${block.stepRefs.length} step${block.stepRefs.length === 1 ? "" : "s"}`}</span> : null}
        {block.note ? <span className="ln-schedule-note">{block.note}</span> : null}
      </p>
    </article>;
  };

  const span = `${shortDay(firstDay, zh)} → ${shortDay(lastDay, zh)}`;
  const summary = zh
    ? [span, `${dayCount} 天`, stepBlocks ? `${stepBlocks} 段` : "", openItems ? `${openItems} 项待办` : ""].filter(Boolean).join(" · ")
    : [span, `${dayCount} day${dayCount === 1 ? "" : "s"}`, stepBlocks ? `${stepBlocks} block${stepBlocks === 1 ? "" : "s"}` : "", openItems ? `${openItems} open item${openItems === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");

  return <div className="ln-schedule" data-has-selection={selected ? "" : undefined}>
    <div className="ln-schedule-toolbar">
      <div className="ln-schedule-group">
        {ordered.length ? <div role="group" aria-label="View" className="ln-schedule-tabs">
          <button type="button" aria-pressed={view === "board"} onClick={() => changeView("board")}><Workflow aria-hidden />Flowchart</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => changeView("list")}><List aria-hidden />List</button>
        </div> : null}
      </div>
      <div className="ln-schedule-group ln-schedule-span">
        <label className="ln-schedule-field"><span>Start</span><input type="date" value={firstDay} disabled={!editable} onChange={event => changeStart(event.target.value)} /></label>
        <div className="ln-schedule-field">
          <span id="ln-schedule-days-label">Days</span>
          <div className="ln-schedule-stepper" role="group" aria-labelledby="ln-schedule-days-label">
            <button type="button" className="focus-ring" disabled={!editable || dayCount <= minDays} aria-label={zh ? "少一天" : "One day fewer"} title={dayCount <= minDays && dayCount > 1 ? (zh ? `第 ${dayCount} 天还有事项` : `Day ${dayCount} still has blocks`) : undefined} onClick={() => resize(dayCount - 1)}><Minus aria-hidden /></button>
            <output data-i18n-ignore>{dayCount}</output>
            <button type="button" className="focus-ring" disabled={!editable || dayCount >= MAX_SCHEDULE_DAYS} aria-label={zh ? "多一天" : "One day more"} onClick={() => resize(dayCount + 1)}><Plus aria-hidden /></button>
          </div>
        </div>
      </div>
      <span className="ln-schedule-spacer" />
      <div className="ln-schedule-group">
        {editable && ordered.length ? <label className="ln-schedule-check"><input type="checkbox" checked={chain} onChange={event => setChain(event.target.checked)} />Move the blocks after it too</label> : null}
        {editable ? <button type="button" className="ln-schedule-button" onClick={() => addItem(selected ? labDayKey(selected.startAt) : firstDay)}><Plus aria-hidden />Add item</button> : null}
        {editable && !drafting ? <button type="button" className="ln-schedule-button" onClick={() => setDrafting(true)}><Wand2 aria-hidden />{ordered.length ? "Redraft" : "Draft from the Protocols"}</button> : null}
      </div>
    </div>

    {editable && drafting ? <section className="ln-schedule-draft" aria-label="Draft the schedule">
      <div>
        <h2>{ordered.length ? "Redraft from the Protocols" : "Arrange the days"}</h2>
        <p>Waits of 4 h or more, overnight steps and work that would run past the end of the day start a new block; the next block starts when the wait is over.</p>
      </div>
      <div className="ln-schedule-draft-fields">
        <label>Day 1 starts at<input type="time" value={draftClock} onChange={event => setDraftClock(event.target.value)} /></label>
        <label>Working day<span className="ln-schedule-hours"><input type="time" aria-label="Work starts" value={clockOf(hours.start)} onChange={event => { const value = clockMinutes(event.target.value); if (!Number.isNaN(value)) changeHours({ ...hours, start: value }); }} />–<input type="time" aria-label="Work ends" value={clockOf(hours.end)} onChange={event => { const value = clockMinutes(event.target.value); if (!Number.isNaN(value)) changeHours({ ...hours, end: value }); }} /></span></label>
        <label className="ln-schedule-check"><input type="checkbox" checked={hours.workdays.length === 7} onChange={event => changeHours({ ...hours, workdays: event.target.checked ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5] })} />Weekends are working days</label>
      </div>
      <div className="ln-schedule-draft-actions">
        {ordered.length ? <button type="button" className="ln-schedule-button" onClick={() => setDrafting(false)}>Cancel</button> : null}
        <button type="button" className="ln-schedule-button ln-key-action" disabled={!steps.some(step => !step.completed)} onClick={draft}><Wand2 aria-hidden />Draft from the Protocols</button>
      </div>
      {!steps.length ? <p className="ln-schedule-hint">This experiment has no steps yet. Add items for each day, or add steps to the experiment first.</p> : null}
    </section> : null}

    {notice ? <p role="status" className="ln-schedule-notice">{notice}</p> : null}
    {error ? <p role="alert" className="ln-schedule-error">{error}</p> : null}

    <div className="ln-schedule-layout">
      {view === "board" || !ordered.length ? <div className="ln-schedule-board" aria-label="Schedule flowchart">
        <p className="ln-schedule-summary" data-i18n-ignore>{summary}</p>
        <div className="ln-schedule-track" ref={trackRef}>
          <svg className="ln-schedule-links" width={size.width} height={size.height} aria-hidden>
            <defs><marker id="ln-schedule-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 z" /></marker></defs>
            {links.map(link => <g key={link.id} data-warn={link.warn ? "" : undefined}><path d={link.d} markerEnd="url(#ln-schedule-arrow)" /></g>)}
          </svg>
          {days.map(dayKey => {
            const dayBlocks = ordered.filter(block => labDayKey(block.startAt) === dayKey);
            const off = !hours.workdays.includes(weekday(dayKey));
            const open = opened[dayKey] ?? dayBlocks.length > 0;
            const label = scheduleDayLabel(dayIndex(dayKey), dayKey, zh);
            return <section key={dayKey} className="ln-schedule-day" data-off={off ? "" : undefined} data-today={dayKey === todayKey ? "" : undefined} data-empty={dayBlocks.length ? undefined : ""} data-folded={open ? undefined : ""}
              onDragOver={editable ? event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } : undefined} onDrop={editable ? event => onDrop(event, dayKey) : undefined}>
              <header data-i18n-ignore>
                <button type="button" className="ln-schedule-day-fold focus-ring" aria-expanded={open} onClick={() => setOpened(current => ({ ...current, [dayKey]: !open }))}><ChevronDown aria-hidden /></button>
                <span className="ln-schedule-day-name"><strong>{zh ? `第 ${dayIndex(dayKey)} 天` : `Day ${dayIndex(dayKey)}`}</strong><small>{shortDay(dayKey, zh)}</small></span>
                {dayKey === todayKey ? <span className="ln-schedule-today">{zh ? "今天" : "Today"}</span> : null}
                {!open && dayBlocks.length ? <span className="ln-schedule-count">{dayBlocks.length}</span> : null}
                {editable ? <span className="ln-schedule-day-menu">
                  <button type="button" className="focus-ring" aria-haspopup="menu" aria-expanded={menuDay === dayKey} aria-label={zh ? `${label} 的操作` : `Actions for ${label}`} onClick={() => { setMenuDay(menuDay === dayKey ? null : dayKey); setConfirmDay(null); }}><MoreHorizontal aria-hidden /></button>
                  {menuDay === dayKey ? <span role="menu" className="ln-schedule-menu" onKeyDown={event => { if (event.key === "Escape") setMenuDay(null); }}>
                    <button type="button" role="menuitem" onClick={() => putDay(dayKey)}><CalendarPlus aria-hidden />{zh ? "在前面插入一天" : "Put a day in before"}</button>
                    <button type="button" role="menuitem" onClick={() => putDay(addDays(dayKey, 1))}><CalendarPlus aria-hidden />{zh ? "在后面插入一天" : "Put a day in after"}</button>
                    <button type="button" role="menuitem" data-danger="" disabled={dayCount <= 1} onClick={() => takeDay(dayKey)}><Trash2 aria-hidden />{confirmDay === dayKey
                      ? (zh ? `再点一次：连同 ${dayBlocks.length} 项删除` : `Click again: take out with ${dayBlocks.length} block${dayBlocks.length === 1 ? "" : "s"}`)
                      : (zh ? "删除这一天" : "Take out this day")}</button>
                  </span> : null}
                </span> : null}
              </header>
              <div className="ln-schedule-cards">{dayBlocks.map(card)}</div>
              {editable ? <button type="button" className="ln-schedule-add focus-ring" onClick={() => addItem(dayKey)}><Plus aria-hidden />{zh ? "添加事项" : "Add item"}</button> : null}
            </section>;
          })}
          {editable && dayCount < MAX_SCHEDULE_DAYS ? <button type="button" className="ln-schedule-add-day focus-ring" onClick={() => resize(dayCount + 1)}><CalendarPlus aria-hidden /><span>{zh ? "加一天" : "Add a day"}</span></button> : null}
        </div>
      </div> : <div className="ln-schedule-list-wrap"><table className="ln-schedule-list">
        <thead><tr><th>Day</th><th>Time</th><th>Block</th><th>Waits</th><th>Marks</th></tr></thead>
        <tbody>{ordered.map(block => <tr key={block.id} aria-current={selectedId === block.id ? "true" : undefined} onClick={() => setSelectedId(block.id)}>
          <td data-i18n-ignore>{scheduleDayLabel(dayIndex(labDayKey(block.startAt)), labDayKey(block.startAt), zh)}</td>
          <td data-i18n-ignore>{editable && !locked.has(block.id) && !block.allDay ? <input type="time" aria-label={zh ? "开始时间" : "Start time"} value={labClock(block.startAt)} onClick={event => event.stopPropagation()} onChange={event => { const value = clockMinutes(event.target.value); if (!Number.isNaN(value)) move(block.id, labInstant(labDayKey(block.startAt), value)); }} /> : block.allDay ? (zh ? "全天" : "All day") : labClock(block.startAt)}</td>
          <td data-i18n-ignore><button type="button" className="ln-schedule-link" onClick={() => setSelectedId(block.id)}>{titleOf(block, stepMap, zh)}</button><small>{stateText(blockState(block, stepMap), zh)}{block.estimatedMinutes ? ` · ${formatDuration(block.estimatedMinutes)}` : ""}</small></td>
          <td data-i18n-ignore>{block.afterBlockId ? gapLabel(block, stepMap, zh) ?? "—" : "—"}</td>
          <td data-i18n-ignore>{(marks[block.id] ?? []).map(mark => markText(mark, zh)).join("；") || "—"}</td>
        </tr>)}</tbody>
      </table></div>}

      {selected ? <aside className="ln-schedule-panel" aria-label="Block details">
        <header><strong data-i18n-ignore>{titleOf(selected, stepMap, zh)}</strong><button type="button" className="focus-ring" aria-label="Close" onClick={() => setSelectedId(null)}><X aria-hidden /></button></header>
        <PanelBody block={selected} blocks={blocks} steps={stepMap} editable={editable && !locked.has(selected.id)} done={locked.has(selected.id)} zh={zh} marks={marks[selected.id] ?? []} unscheduled={unscheduled}
          onMove={startAt => move(selected.id, startAt)} onChange={patch => update(selected.id, patch)} onSplit={index => split(selected, index)} onMerge={() => merge(selected)} onRemove={() => remove(selected)}
          onAdd={ref => addToBlock(selected, ref)} onToggleDone={() => toggleDone(selected)} pending={pending} />
      </aside> : null}
    </div>

    {unscheduled.length && ordered.length ? <details className="ln-schedule-tray">
      <summary data-i18n-ignore>{zh ? `未安排的步骤（${unscheduled.length}）` : `Steps not on the schedule (${unscheduled.length})`}</summary>
      <ul>{unscheduled.map(step => <li key={step.ref} data-i18n-ignore>{step.groupTitle} · {zh ? `第 ${step.position} 步` : `step ${step.position}`} · {step.title}</li>)}</ul>
      <p className="ln-schedule-hint">Select a block, then add a step to it from the block’s panel; or redraft.</p>
    </details> : null}

    {editable && dirty ? <div className="ln-schedule-savebar" role="region" aria-label="Unsaved schedule">
      <span>Unsaved changes</span>
      {needsReason ? <input value={reason} onChange={event => setReason(event.target.value)} maxLength={500} placeholder="Why the schedule changes (the experiment is under way)" aria-label="Why the schedule changes" /> : null}
      <button type="button" className="ln-schedule-button" disabled={pending} onClick={() => { apply(saved.blocks); setStart(saved.startDay); setLength(saved.days); setSelectedId(null); }}><Undo2 aria-hidden />Discard changes</button>
      <button type="button" className="ln-schedule-button ln-key-action" disabled={pending} onClick={save}><Check aria-hidden />{pending ? "Saving…" : "Save schedule"}</button>
    </div> : null}
  </div>;
}

function PanelBody({ block, blocks, steps, editable, done, zh, marks, unscheduled, pending, onMove, onChange, onSplit, onMerge, onRemove, onAdd, onToggleDone }: {
  block: ScheduleBlock; blocks: ScheduleBlock[]; steps: ReadonlyMap<string, ScheduleStep>; editable: boolean; done: boolean; zh: boolean; marks: BlockMark[]; unscheduled: ScheduleStep[]; pending: boolean;
  onMove: (startAt: string) => void; onChange: (patch: Partial<ScheduleBlock>) => void; onSplit: (index: number) => void; onMerge: () => void; onRemove: () => void; onAdd: (ref: string) => void; onToggleDone: () => void;
}) {
  const day = labDayKey(block.startAt), clock = labClock(block.startAt);
  const previous = blocks.find(item => item.id === block.afterBlockId);
  const hoursOf = (minutes: number | null) => minutes === null ? "" : String(Math.round((minutes / 60) * 100) / 100);
  const minutesOf = (value: string) => value.trim() === "" ? null : Math.max(0, Math.round(Number(value) * 60));
  return <div className="ln-schedule-panel-body">
    {done ? <p className="ln-schedule-hint">{zh ? "这一段已完成，位置不再改变。" : "This block is done; it stays where it is."}</p> : null}
    {marks.length ? <ul className="ln-schedule-marks" data-i18n-ignore>{marks.map((mark, index) => <li key={index}><AlertTriangle aria-hidden />{markText(mark, zh)}</li>)}</ul> : null}
    <label>Name<input value={block.title ?? ""} disabled={!editable} maxLength={120} placeholder={blockTitle({ ...block, title: null }, steps)} onChange={event => onChange({ title: event.target.value })} /></label>
    <div className="ln-schedule-pair">
      <label>Date<input type="date" value={day} disabled={!editable} onChange={event => { if (event.target.value) onMove(labInstant(event.target.value, labMinuteOfDay(block.startAt))); }} /></label>
      <label>Time<input type="time" value={clock} disabled={!editable || block.allDay} onChange={event => { const value = clockMinutes(event.target.value); if (!Number.isNaN(value)) onMove(labInstant(day, value)); }} /></label>
    </div>
    {block.kind === "task" ? <label className="ln-schedule-check"><input type="checkbox" checked={block.allDay} disabled={!editable} onChange={event => onChange({ allDay: event.target.checked, estimatedMinutes: event.target.checked ? null : block.estimatedMinutes ?? 30 })} />All day</label> : null}
    {!block.allDay ? <label>Expected minutes<input type="number" min={0} max={1440} step={5} value={block.estimatedMinutes ?? ""} disabled={!editable} onChange={event => onChange({ estimatedMinutes: event.target.value === "" ? null : Math.min(1440, Math.max(0, Math.round(Number(event.target.value)))) })} /></label> : null}
    {previous ? <fieldset className="ln-schedule-window" disabled={!editable}>
      <legend data-i18n-ignore>{zh ? `等待：${titleOf(previous, steps, true)}之后` : `Waits for: ${titleOf(previous, steps, false)}`}</legend>
      <div className="ln-schedule-pair">
        <label>At least (h)<input type="number" min={0} step={0.5} value={hoursOf(block.minGapMinutes)} onChange={event => onChange({ minGapMinutes: minutesOf(event.target.value), gapSource: block.gapSource ?? "manual" })} /></label>
        <label>At most (h)<input type="number" min={0} step={0.5} value={hoursOf(block.maxGapMinutes)} onChange={event => onChange({ maxGapMinutes: minutesOf(event.target.value), gapSource: block.gapSource ?? "manual" })} /></label>
      </div>
      {block.gapSource && block.gapSource !== "manual" ? <p className="ln-schedule-hint" data-i18n-ignore>{zh ? `来自${gapLabel(block, steps, true) ?? "规程"}` : `From ${gapLabel(block, steps, false) ?? "the Protocol"}`}</p> : null}
    </fieldset> : null}
    {block.kind === "steps" ? <section className="ln-schedule-steps">
      <h4>Steps</h4>
      <ol>{block.stepRefs.map((ref, index) => { const step = steps.get(ref); return <li key={ref} data-done={step?.completed ? "" : undefined}>
        {editable && index > 0 ? <button type="button" className="ln-schedule-split focus-ring" onClick={() => onSplit(index)} title={zh ? "从这一步拆开" : "Split here"} aria-label={zh ? "从这一步拆开" : "Split here"}><Scissors aria-hidden /></button> : null}
        <span data-i18n-ignore>{step ? `${step.position}. ${step.title}` : ref}{step?.wait ? <small>{step.wait.overnight ? (zh ? " · 过夜" : " · overnight") : ` · ${formatWait(step.wait.seconds)}`}</small> : null}</span>
      </li>; })}</ol>
      {editable && unscheduled.length ? <label>Add a step<select value="" onChange={event => { if (event.target.value) onAdd(event.target.value); }}><option value="">{zh ? "选择未安排的步骤…" : "Choose a step not on the schedule…"}</option>{unscheduled.map(step => <option key={step.ref} value={step.ref}>{`${step.groupTitle} · ${step.position}. ${step.title}`}</option>)}</select></label> : null}
    </section> : <label className="ln-schedule-check"><input type="checkbox" checked={Boolean(block.doneAt)} disabled={pending} onChange={onToggleDone} />Done</label>}
    <label>Note<textarea rows={2} maxLength={1000} value={block.note ?? ""} disabled={!editable} onChange={event => onChange({ note: event.target.value })} /></label>
    {editable ? <div className="ln-schedule-panel-actions">
      {previous && previous.kind === "steps" && block.kind === "steps" ? <button type="button" className="ln-schedule-button" onClick={onMerge}>Merge into the block before</button> : null}
      <button type="button" className="ln-schedule-button ln-schedule-danger" onClick={onRemove}><Trash2 aria-hidden />{block.kind === "task" ? "Remove item" : "Take off the schedule"}</button>
    </div> : null}
  </div>;
}

/** A block's name in the interface's language: its own name, or "<Protocol> · 第 a–b 步". */
function titleOf(block: ScheduleBlock, steps: ReadonlyMap<string, ScheduleStep>, zh: boolean) {
  if (block.kind === "task" && !block.title?.trim()) return zh ? "未命名事项" : "Unnamed item";
  const title = blockTitle(block, steps);
  return block.title?.trim() ? title : localizeBlockTitle(title, zh);
}

/** "11/03 周二", "Tue 11/03": a day in the schedule's summary line. */
function shortDay(dayKey: string, zh: boolean) {
  return scheduleDayLabel(1, dayKey, zh).split(" · ")[1];
}

function stateText(state: "done" | "active" | "todo", zh: boolean) {
  return state === "done" ? (zh ? "已完成" : "Done") : state === "active" ? (zh ? "进行中" : "Under way") : (zh ? "未开始" : "Not started");
}

/** "step 6 · 48 h (24–72 h)", "overnight": what a connector says about the wait it stands for. */
function gapLabel(block: ScheduleBlock, steps: ReadonlyMap<string, ScheduleStep>, zh: boolean) {
  const [kind, ...rest] = (block.gapSource ?? "").split(":");
  const step = steps.get(rest.join(":"));
  const window = block.minGapMinutes !== null && block.maxGapMinutes !== null && block.minGapMinutes !== block.maxGapMinutes
    ? formatWindow(block.minGapMinutes, block.maxGapMinutes)
    : block.minGapMinutes !== null && block.maxGapMinutes === null && block.minGapMinutes > 0 ? `≥ ${waitText(block.minGapMinutes)}` : "";
  if (kind === "overnight") return zh ? `过夜${step ? `（第 ${step.position} 步）` : ""}` : `overnight${step ? ` (step ${step.position})` : ""}`;
  if (kind === "step" && step?.wait) return `${zh ? `第 ${step.position} 步` : `step ${step.position}`} · ${formatWait(step.wait.seconds)}${window ? (zh ? `（${window}）` : ` (${window})`) : ""}`;
  return window || null;
}

function markText(mark: BlockMark, zh: boolean) {
  switch (mark.kind) {
    case "window": {
      const allowed = mark.minGapMinutes !== null && mark.maxGapMinutes !== null ? formatWindow(mark.minGapMinutes, mark.maxGapMinutes) : mark.minGapMinutes !== null ? `≥ ${waitText(mark.minGapMinutes)}` : `≤ ${waitText(mark.maxGapMinutes ?? 0)}`;
      return zh ? `超出时间窗：间隔 ${waitText(mark.gapMinutes)}，应为 ${allowed}` : `Outside its window: ${waitText(mark.gapMinutes)} after, allowed ${allowed}`;
    }
    case "order": return zh ? `比前一段结束早 ${waitText(-mark.gapMinutes)}` : `Starts ${waitText(-mark.gapMinutes)} before the block it waits for ends`;
    case "weekend": return zh ? "非工作日" : "Not a working day";
    case "hours": return zh ? "在工作时间以外" : "Outside working hours";
    case "overlap": return zh ? `与 ${localizeBlockTitle(mark.with, true)} 时间重叠` : `Overlaps ${mark.with}`;
  }
}
