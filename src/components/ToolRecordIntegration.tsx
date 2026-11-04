'use client';
import { newClientMutationId } from '@/lib/client-mutation-id';
import { plateLayoutsToPlannerBackup } from '@/lib/plate-layout';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from './I18nProvider';
import { ToolEditContext, type ToolOpener } from './ToolOutput';
import { Button } from './ui/Button';
import type { ScientificDocument } from '@/lib/scientific-document';
import { toolEmbed, toolFrameSource, type EmbeddedToolId } from '@/lib/tool-embeds';
import { freshToolDraft, type ToolOutputBlock, type ToolOwner } from '@/lib/tool-workflow';
type Launch = {
    mappingConfirmed?: boolean;
    submissionId: string;
    owner: ToolOwner;
    forkFromId?: string;
    id: string;
    artifactId: string;
    baseRevision: number;
    toolId: EmbeddedToolId;
    state?: unknown;
    anchorId?: string;
    insertionSection?: string;
    replacePlateId?: string;
    samples: unknown[];
    layouts: ToolOutputBlock[];
    planLayouts: Array<ToolOutputBlock & {
        ownerId: string;
    }>;
    source?: ToolOutputBlock["source"];
};
/** Where an output goes when it was not placed at the cursor. */
const defaultSection = (ownerType: ToolOwner['ownerType'], toolId: EmbeddedToolId) => ownerType === 'result' || ownerType === 'entry' ? 'analysis' : ownerType === 'experiment' ? 'setup' : ownerType === 'report' ? (toolId.endsWith('-analysis') ? 'results' : 'methods') : 'material_methods';
export function ToolRecordIntegration({ owner, title, document, onChange, onOutput, children }: {
    owner: ToolOwner;
    title?: string | null;
    document: ScientificDocument;
    onChange: (document: ScientificDocument) => void;
    /** For a record that saves its own text (Entry): it places the output itself, and nothing is drafted on the server. */
    onOutput?: (block: ToolOutputBlock, replacePlateId?: string) => void;
    children: ReactNode;
}) {
    const { locale } = useI18n();
    const tr = (zh: string, en: string) => locale === 'zh' ? zh : en;
    const host = useRef<HTMLDivElement>(null);
    const iframe = useRef<HTMLIFrameElement>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const latest = useRef({ owner, document, onChange, onOutput });
    latest.current = { owner, document, onChange, onOutput };
    const detached = Boolean(onOutput);
    const base = useRef(document);
    const [draftId, setDraftId] = useState('');
    const [launch, setLaunch] = useState<Launch | null>(null);
    const [ready, setReady] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [recordRevision, setRecordRevision] = useState('');
    const [conflict, setConflict] = useState(false);
    const sessions = useRef<Record<string, unknown>>({});
    const returnFocus = useRef<HTMLElement | null>(null);
    const closing = useRef(false);
    const [pendingApply, setPendingApply] = useState(false);
    const [newRecordKey,setNewRecordKey]=useState('');
    const [restored, setRestored] = useState(false);
    const edited = useRef(false);
    const draftContext=useRef('');
    useEffect(()=>{
        if(owner.ownerId)return;
        if(detached){setNewRecordKey(key=>key||newClientMutationId());return;}
        const context=JSON.stringify(owner);
        const query=new URLSearchParams(location.search);
        const key=(!draftContext.current || draftContext.current===context)?query.get('toolDraft') || newClientMutationId():newClientMutationId();
        draftContext.current=context;query.set('toolDraft',key);history.replaceState(null,'',location.pathname+'?'+query);setNewRecordKey(key);setDraftId('');
    },[owner.ownerId,owner.ownerType,owner.experimentId,owner.researchPlanId,detached]);
    const storageKey = `labnest:tool-record:${owner.ownerType}:${owner.ownerId ?? newRecordKey}`;
    const formValues = useCallback(() => {const data=new FormData(host.current?.closest('form') ?? undefined);return Object.fromEntries([...new Set(data.keys())].map(key=>[key,data.getAll(key).length>1?data.getAll(key):data.get(key)]));}, []);
    useEffect(() => {
        if(!owner.ownerId && !newRecordKey)return;
        if(detached){setDraftId(id=>id||newClientMutationId());return;}
        let saved: {
            id?: string;
            document?: ScientificDocument;
            sessions?: Record<string, unknown>;
            form?: Record<string, string>;
        } = {};
        try {
            saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
        }
        catch { }
        const id = saved.id ?? (owner.ownerId?newClientMutationId():newRecordKey);
        setDraftId(id);
        const revision = formValues().expectedUpdatedAt;
        if (!freshToolDraft(saved, revision ? String(revision) : undefined, Boolean(owner.ownerId))) {
            // The record has moved on since this draft: what is saved wins. A tool session still open keeps its own conflict check.
            sessions.current = saved.sessions ?? {};
            saved = { id };
        }
        else if (saved.document) {
            sessions.current = saved.sessions ?? {};
            if (JSON.stringify(saved.document) !== JSON.stringify(latest.current.document)) {
                latest.current.onChange(saved.document);
                edited.current = true;
                setRestored(true);
            }
        }
        else if (saved.id)
            void fetch(`/api/tool-workflow?draftId=${saved.id}`).then(response => response.json()).then(({ draft }) => { if (draft?.documentJson && !draft.boundRecordId) {
                latest.current.onChange(draft.documentJson);
                sessions.current = draft.sessionsJson ?? {};
            } }).catch(() => setStatus('草稿暂未同步，请重试'));
        try {
            localStorage.setItem(storageKey, JSON.stringify({ ...saved, id }));
        }
        catch {
            setStatus('本机草稿空间不足');
        }
        // Restore ordinary form inputs through their native events, preserving React-controlled fields.
        if (saved.form)
            for (const [name, value] of Object.entries(saved.form)) {
                if (['contentJson', 'id', 'expectedUpdatedAt', 'toolDraftId'].includes(name))
                    continue;
                const control = host.current?.closest('form')?.elements.namedItem(name);
                if (control instanceof HTMLInputElement && control.type !== 'hidden' || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
                    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value')?.set;
                    setter?.call(control, value);
                    control.dispatchEvent(new Event('input', { bubbles: true }));
                    control.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
    }, [storageKey,newRecordKey,owner.ownerId,detached]);
    const persist = useCallback(async (state?: unknown, sessionId?: string) => {
        if (!draftId)
            return;
        if (sessionId)
            sessions.current[sessionId] = state;
        if (detached)
            return;
        // Nothing to keep until something changed: a draft of an untouched record could only ever turn stale.
        if (!sessionId && !edited.current && latest.current.document === base.current && !Object.keys(sessions.current).length)
            return;
        const current = latest.current;
        const form = formValues();
        let localSaved = true;
        try {
            localStorage.setItem(storageKey, JSON.stringify({ id: draftId, document: current.document, form, sessions: sessions.current }));
        }
        catch {
            localSaved = false;
            try {
                localStorage.setItem(storageKey, JSON.stringify({ id: draftId, form, serverOnly: true }));
            }
            catch { }
        }
        setStatus(localSaved ? '已保存草稿' : '正在保存草稿');
        const response = await fetch('/api/tool-workflow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId, owner: current.owner, document: current.document, form, sessionId, session: state }) });
        if (!response.ok) {
            setStatus('待同步');
            if (!localSaved)
                throw new Error('草稿尚未保存');
        }
        else
            setStatus('已保存草稿');
    }, [draftId, storageKey, formValues, detached]);
    useEffect(() => { if (!draftId)
        return; const timer = setTimeout(() => void persist().catch(() => setStatus('待同步')), 1000); return () => clearTimeout(timer); }, [document, draftId, persist]);
    useEffect(() => { const form = host.current?.closest('form'); let timer: ReturnType<typeof setTimeout>; const changed = () => { edited.current = true; clearTimeout(timer); timer = setTimeout(() => void persist().catch(() => setStatus('待同步')), 1000); }; form?.addEventListener('input', changed); return () => { clearTimeout(timer); form?.removeEventListener('input', changed); }; }, [persist]);
    const open = useCallback<ToolOpener>(async (block, anchorId, insertionSection, toolId, plate) => {
        setError('');
        setStatus('正在打开');
        try {
            await persist();
            const current = latest.current;
            const query = new URLSearchParams();
            if (current.owner.experimentId)
                query.set('experimentId', current.owner.experimentId);
            else if (current.owner.ownerType === 'experiment' && current.owner.ownerId)
                query.set('experimentId', current.owner.ownerId);
            if (current.owner.researchPlanId)
                query.set('researchPlanId', current.owner.researchPlanId);
            const response = await fetch(`/api/tool-workflow?${query}`);
            if (!response.ok)
                throw new Error('无法读取实验样本，请重试');
            const context = await response.json();
            const desiredTool=block?.toolId ?? toolId ?? (current.owner.ownerType==='result'?'qpcr-analysis':'qpcr-plate-layout');
            const pendingEntry = plate ? undefined : Object.entries(sessions.current).find(([,value])=>{const pending=value as {artifactId?:string;toolId?:string};return pending.toolId===desiredTool && (block?pending.artifactId===block.id:!current.document.sections.some(section=>section.blocks.some(item=>item.id===pending.artifactId)));});
            const pending = pendingEntry?.[1] as {
                state?: unknown;
                artifactId?: string;
                baseRevision?: number;
                submissionId?: string;
                toolId?: ToolOutputBlock["toolId"];
            } | undefined;

            returnFocus.current = window.document.activeElement as HTMLElement;
            const state = pending?.state && (!block || pending.artifactId === block.id) ? pending.state : block ? await fetch(`/api/attachments/${block.sessionAttachmentId}`).then(r => { if (!r.ok)
                throw new Error('方案读取失败，请重试'); return r.json(); }).then(r => r.state) : pending?.state;
            setReady(false);
            setConflict(false);
            setLaunch({ submissionId: pending?.submissionId ?? newClientMutationId(), owner: { ...current.owner }, id: pendingEntry?.[0] ?? newClientMutationId(), artifactId: block?.id ?? pending?.artifactId ?? newClientMutationId(), baseRevision: pending?.baseRevision ?? block?.revision ?? 0, toolId: desiredTool, state: plate ? plateLayoutsToPlannerBackup([plate], plate.name) : state, replacePlateId: plate?.id, anchorId, insertionSection, samples: context.samples, layouts: context.layouts, planLayouts: context.planLayouts ?? [] });
        }
        catch (e) {
            setError(e instanceof Error ? e.message : '尚未打开，请重试');
        }
    }, [persist]);
    useEffect(() => { if (launch) { dialog.current?.showModal(); iframe.current?.focus(); } }, [launch]);
    useEffect(() => { if (!busy && (!launch || ready || toolEmbed(launch.toolId)?.mode !== 'bridged'))
        return; const timer = setTimeout(() => { setBusy(false); setError('工具暂未响应，请重试；当前草稿已保留'); }, 15000); return () => clearTimeout(timer); }, [busy, launch, ready]);
    useEffect(() => {
        if (!launch)
            return;
        const receive = async (event: MessageEvent) => {
            if (event.origin !== location.origin || event.source !== iframe.current?.contentWindow || event.data?.protocol !== 'labnest-tool-v1')
                return;
            const message = event.data;
            if (message.type === 'TOOL_READY') {
                iframe.current!.contentWindow!.postMessage({ protocol: 'labnest-tool-v1', type: 'CONTEXT_INIT', sessionId: launch.id, state: launch.state, samples: launch.samples, layouts: launch.layouts, title, language: locale }, location.origin);
                setStatus('');
                return;
            }
            if (message.sessionId !== launch.id)
                return;
            if (message.type === 'CONTEXT_READY') {
                setReady(true);
                return;
            }
            if (message.type === 'DRAFT_FLUSH') {
                try {
                    await persist({ state: message.state, artifactId: launch.artifactId, baseRevision: launch.baseRevision, submissionId: launch.submissionId, toolId: launch.toolId }, launch.id);
                    dialog.current?.close();
                    setLaunch(null);
                    setError('');
                    returnFocus.current?.focus();
                }
                catch {
                    setError('草稿尚未保存，请重试返回');
                }
                finally {
                    closing.current = false;
                    setBusy(false);
                }
                return;
            }
            if (message.type === 'DRAFT_CHANGED') {
                setPendingApply(Boolean(message.pendingApply));
                setError('');
                try {
                    await persist({ state: message.state, artifactId: launch.artifactId, baseRevision: launch.baseRevision, submissionId: launch.submissionId, toolId: launch.toolId }, launch.id);
                }
                catch {
                    setStatus('待同步');
                }
                return;
            }
            if (message.type === 'SAVE_ERROR') {
                setError(message.error);
                setBusy(false);
                return;
            }
            if (message.type !== 'OUTPUT_SUBMIT')
                return;
            setBusy(true);
            setError('');
            try {
                const current = latest.current;
                const response = await fetch('/api/tool-workflow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId, owner: launch.owner, forkFromId: launch.forkFromId, document: current.document, baseDocument: base.current, form: formValues(), sessionId: launch.id, session: message.state, output: { ...message.output, id: launch.artifactId, baseRevision: launch.baseRevision, submissionId: launch.submissionId, toolId: launch.toolId, sectionKey: defaultSection(launch.owner.ownerType, launch.toolId), replacePlateId: launch.replacePlateId, anchorId: launch.anchorId, insertionSection: launch.insertionSection, source: launch.source } }) });
                const result = await response.json();
                if (!response.ok)
                    throw new Error(result.error);
                if (current.onOutput)
                    current.onOutput(result.block, launch.replacePlateId);
                else {
                    current.onChange(result.document);
                    base.current = result.document;
                }
                if (result.updatedAt) {
                    const input = host.current?.closest('form')?.elements.namedItem('expectedUpdatedAt');
                    if (input instanceof HTMLInputElement)
                        input.disabled = true;
                    setRecordRevision(result.updatedAt);
                }
                delete sessions.current[launch.id];
                if (!current.onOutput) try {
                    localStorage.setItem(storageKey, JSON.stringify({ id: draftId, document: result.document, form: formValues(), sessions: sessions.current }));
                }
                catch {
                    try {
                        localStorage.setItem(storageKey, JSON.stringify({ id: draftId, form: formValues(), serverOnly: true }));
                    }
                    catch { }
                }
                iframe.current?.contentWindow?.postMessage({ protocol: 'labnest-tool-v1', type: 'SAVE_ACK', sessionId: launch.id }, location.origin);
                delete sessions.current[launch.id];
                setLaunch(null);
                setStatus(current.onOutput ? '' : current.owner.ownerId ? '已保存到当前记录' : '已保存到草稿');
                requestAnimationFrame(() => host.current?.querySelector(`[data-tool-artifact="${launch.artifactId}"]`)?.scrollIntoView({ block: 'center' }));
            }
            catch (e) {
                const text = e instanceof Error ? e.message : '尚未保存，请重试';
                setError(text);
                setConflict(text.includes('新版本'));
            }
            finally {
                setBusy(false);
            }
        };
        window.addEventListener('message', receive);
        return () => window.removeEventListener('message', receive);
    }, [launch, draftId, formValues, persist, storageKey, title, locale]);
    const saveLabel = (tool: EmbeddedToolId, ownerType: ToolOwner['ownerType']) => tool === 'plasmid-workbench' ? tr('插入图谱', 'Insert map') : ['qpcr-analysis', 'cnv-analysis', 'calculator'].includes(tool) ? (pendingApply ? tr('应用并插入', 'Apply and insert') : tr('插入结果', 'Insert results')) : ownerType === 'result' ? tr('保存到结果', 'Save to result') : ownerType === 'report' ? tr('保存到报告', 'Save to report') : ownerType === 'entry' ? tr('插入记录', 'Insert into entry') : tr('保存到计划', 'Save to plan');
    const embed = launch ? toolEmbed(launch.toolId) : undefined;
    const bridged = embed?.mode === 'bridged';
    function close() { if (!launch || busy)
        return; if (!ready || !bridged) {
        dialog.current?.close();
        setLaunch(null);
        return;
    } closing.current = true; setBusy(true); iframe.current?.contentWindow?.postMessage({ protocol: 'labnest-tool-v1', type: 'REQUEST_DRAFT', sessionId: launch.id }, location.origin); }
    return <ToolEditContext.Provider value={open}><div ref={host}>
    <input type="hidden" name="toolDraftId" value={draftId}/>{recordRevision ? <input type="hidden" name="expectedUpdatedAt" value={recordRevision}/> : null}
    {children}
    {status && !launch ? <p className="text-xs text-muted" role="status" data-print-hidden>{status}</p> : null}
    {restored && !launch ? <p className="flex flex-wrap items-center gap-2 text-sm" role="status" data-print-hidden>{tr('已恢复这台设备上未保存的修改。', 'Restored unsaved changes from this device.')}<Button type="button" size="sm" onClick={() => { try { localStorage.removeItem(storageKey); } catch { } location.reload(); }}>{tr('放弃这些修改', 'Discard them')}</Button></p> : null}
    {error && !launch ? <p role="alert" className="text-sm text-error">{error}</p> : null}
  </div>{launch ? createPortal(<dialog ref={dialog} className="tool-record-workspace" onCancel={event => { event.preventDefault(); close(); }}>
    <header><Button type="button" onClick={close}>{tr('返回记录', 'Back to record')}</Button><span className="min-w-0 flex-1 truncate">{title || tr('未命名记录', 'Untitled record')}</span>{launch.toolId === 'qpcr-plate-layout' && !launch.baseRevision && launch.planLayouts.length ? <select aria-label={tr('选用研究计划布局', 'Use a research plan layout')} defaultValue="" onChange={async (event) => { const choice = launch.planLayouts.find(item => item.id === event.target.value); if (!choice)
            return; try {
            const state = await fetch(`/api/attachments/${choice.sessionAttachmentId}`).then(r => r.json()).then(r => r.state);
            setLaunch({ ...launch, state, mappingConfirmed: !launch.samples.length, source: { ownerId: choice.ownerId, artifactId: choice.id, revision: choice.revision } });
            iframe.current?.contentWindow?.postMessage({ protocol: 'labnest-tool-v1', type: 'CONTEXT_INIT', sessionId: launch.id, state, samples: launch.samples, title, language: locale }, location.origin);
        }
        catch {
            setError('布局读取失败，请重试');
        } }}><option value="">{tr('选用研究计划布局', 'Use a research plan layout')}</option>{launch.planLayouts.map((item, index) => <option key={item.id} value={item.id}>{tr('布局', 'Layout')} {index + 1} · {tr('修订', 'rev')} {item.revision}</option>)}</select> : null}<span role="status" className="text-xs text-muted">{bridged ? status : tr('暂不能存回这条记录', 'Not saved to this record yet')}</span>{launch.mappingConfirmed === false ? <label className="text-xs"><input type="checkbox" onChange={() => setLaunch({ ...launch, mappingConfirmed: true })}/> {tr('已核对左侧样本与当前实验一致', 'Samples on the left match this experiment')}</label> : null}{bridged ? <Button type="button" variant="primary" disabled={!ready || busy || launch.mappingConfirmed === false} onClick={() => { setBusy(true); iframe.current?.contentWindow?.postMessage({ protocol: 'labnest-tool-v1', type: 'REQUEST_OUTPUT', sessionId: launch.id }, location.origin); }}>{busy ? tr('正在保存…', 'Saving…') : saveLabel(launch.toolId, launch.owner.ownerType)}</Button> : null}</header>
    {error ? <div role="alert" className="tool-save-error">{error}{conflict ? <Button type="button" onClick={() => { setLaunch({ ...launch, forkFromId: launch.artifactId, artifactId: newClientMutationId(), baseRevision: 0, submissionId: newClientMutationId() }); setConflict(false); setError(''); }}>{tr('另存为新版本', 'Save as a new version')}</Button> : null}</div> : null}
    <iframe ref={iframe} title={embed?.label ?? launch.toolId} src={embed ? toolFrameSource(embed, launch.id, locale) : undefined} allow="clipboard-write"/>
  </dialog>, window.document.body) : null}</ToolEditContext.Provider>;
}
