'use client';
import { newClientMutationId } from '@/lib/client-mutation-id';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { QpcrEditContext } from './QpcrOutput';
import { Button } from './ui/Button';
import type { ScientificDocument } from '@/lib/scientific-document';
import type { QpcrOutputBlock, QpcrOwner } from '@/lib/qpcr-workflow';
type Launch = {
    mappingConfirmed?: boolean;
    submissionId: string;
    owner: QpcrOwner;
    forkFromId?: string;
    id: string;
    artifactId: string;
    baseRevision: number;
    toolId: QpcrOutputBlock['toolId'];
    state?: unknown;
    anchorId?: string;
    samples: unknown[];
    layouts: QpcrOutputBlock[];
    planLayouts: Array<QpcrOutputBlock & {
        ownerId: string;
    }>;
    source?: QpcrOutputBlock["source"];
};
export function QpcrRecordIntegration({ owner, title, document, onChange, children }: {
    owner: QpcrOwner;
    title?: string | null;
    document: ScientificDocument;
    onChange: (document: ScientificDocument) => void;
    children: ReactNode;
}) {
    const host = useRef<HTMLDivElement>(null);
    const iframe = useRef<HTMLIFrameElement>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const latest = useRef({ owner, document, onChange });
    latest.current = { owner, document, onChange };
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
    const draftContext=useRef('');
    useEffect(()=>{
        if(owner.ownerId)return;
        const context=JSON.stringify(owner);
        const query=new URLSearchParams(location.search);
        const key=(!draftContext.current || draftContext.current===context)?query.get('qpcrDraft') || newClientMutationId():newClientMutationId();
        draftContext.current=context;query.set('qpcrDraft',key);history.replaceState(null,'',location.pathname+'?'+query);setNewRecordKey(key);setDraftId('');
    },[owner.ownerId,owner.ownerType,owner.experimentId,owner.researchPlanId]);
    const storageKey = `labnest:qpcr-record:${owner.ownerType}:${owner.ownerId ?? newRecordKey}`;
    const formValues = useCallback(() => {const data=new FormData(host.current?.closest('form') ?? undefined);return Object.fromEntries([...new Set(data.keys())].map(key=>[key,data.getAll(key).length>1?data.getAll(key):data.get(key)]));}, []);
    useEffect(() => {
        if(!owner.ownerId && !newRecordKey)return;
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
        if (saved.document) {
            latest.current.onChange(saved.document);
            sessions.current = saved.sessions ?? {};
        }
        else if (saved.id)
            void fetch(`/api/qpcr-workflow?draftId=${saved.id}`).then(response => response.json()).then(({ draft }) => { if (draft?.documentJson && !draft.boundRecordId) {
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
                if (['contentJson', 'id', 'expectedUpdatedAt', 'qpcrDraftId'].includes(name))
                    continue;
                const control = host.current?.closest('form')?.elements.namedItem(name);
                if (control instanceof HTMLInputElement && control.type !== 'hidden' || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
                    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value')?.set;
                    setter?.call(control, value);
                    control.dispatchEvent(new Event('input', { bubbles: true }));
                    control.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
    }, [storageKey,newRecordKey,owner.ownerId]);
    const persist = useCallback(async (state?: unknown, sessionId?: string) => {
        if (!draftId)
            return;
        if (sessionId)
            sessions.current[sessionId] = state;
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
        const response = await fetch('/api/qpcr-workflow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId, owner: current.owner, document: current.document, form, sessionId, session: state }) });
        if (!response.ok) {
            setStatus('待同步');
            if (!localSaved)
                throw new Error('草稿尚未保存');
        }
        else
            setStatus('已保存草稿');
    }, [draftId, storageKey, formValues]);
    useEffect(() => { if (!draftId)
        return; const timer = setTimeout(() => void persist().catch(() => setStatus('待同步')), 1000); return () => clearTimeout(timer); }, [document, draftId, persist]);
    useEffect(() => { const form = host.current?.closest('form'); let timer: ReturnType<typeof setTimeout>; const changed = () => { clearTimeout(timer); timer = setTimeout(() => void persist().catch(() => setStatus('待同步')), 1000); }; form?.addEventListener('input', changed); return () => { clearTimeout(timer); form?.removeEventListener('input', changed); }; }, [persist]);
    const open = useCallback(async (block?: QpcrOutputBlock, anchorId?: string) => {
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
            const response = await fetch(`/api/qpcr-workflow?${query}`);
            if (!response.ok)
                throw new Error('无法读取实验样本，请重试');
            const context = await response.json();
            const desiredTool=block?.toolId ?? (current.owner.ownerType==='result'?'qpcr-analysis':'qpcr-plate-layout');
            const pendingEntry = Object.entries(sessions.current).find(([,value])=>{const pending=value as {artifactId?:string;toolId?:string};return pending.toolId===desiredTool && (block?pending.artifactId===block.id:!current.document.sections.some(section=>section.blocks.some(item=>item.id===pending.artifactId)));});
            const pending = pendingEntry?.[1] as {
                state?: unknown;
                artifactId?: string;
                baseRevision?: number;
                submissionId?: string;
                toolId?: QpcrOutputBlock["toolId"];
            } | undefined;

            returnFocus.current = window.document.activeElement as HTMLElement;
            const state = pending?.state && (!block || pending.artifactId === block.id) ? pending.state : block ? await fetch(`/api/attachments/${block.sessionAttachmentId}`).then(r => { if (!r.ok)
                throw new Error('方案读取失败，请重试'); return r.json(); }).then(r => r.state) : pending?.state;
            setReady(false);
            setConflict(false);
            setLaunch({ submissionId: pending?.submissionId ?? newClientMutationId(), owner: { ...current.owner }, id: pendingEntry?.[0] ?? newClientMutationId(), artifactId: block?.id ?? pending?.artifactId ?? newClientMutationId(), baseRevision: pending?.baseRevision ?? block?.revision ?? 0, toolId: block?.toolId ?? (current.owner.ownerType === 'result' ? 'qpcr-analysis' : 'qpcr-plate-layout'), state, anchorId, samples: context.samples, layouts: context.layouts, planLayouts: context.planLayouts ?? [] });
        }
        catch (e) {
            setError(e instanceof Error ? e.message : '尚未打开，请重试');
        }
    }, [persist]);
    useEffect(() => { if (launch)
        dialog.current?.showModal(); }, [launch]);
    useEffect(() => { if (!busy && (!launch || ready))
        return; const timer = setTimeout(() => { setBusy(false); setError('工具暂未响应，请重试；当前草稿已保留'); }, 15000); return () => clearTimeout(timer); }, [busy, launch, ready]);
    useEffect(() => {
        if (!launch)
            return;
        const receive = async (event: MessageEvent) => {
            if (event.origin !== location.origin || event.source !== iframe.current?.contentWindow || event.data?.protocol !== 'labnest-qpcr-v1')
                return;
            const message = event.data;
            if (message.type === 'TOOL_READY') {
                iframe.current!.contentWindow!.postMessage({ protocol: 'labnest-qpcr-v1', type: 'CONTEXT_INIT', sessionId: launch.id, state: launch.state, samples: launch.samples, layouts: launch.layouts, title }, location.origin);
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
                const response = await fetch('/api/qpcr-workflow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draftId, owner: launch.owner, forkFromId: launch.forkFromId, document: current.document, baseDocument: base.current, form: formValues(), sessionId: launch.id, session: message.state, output: { ...message.output, id: launch.artifactId, baseRevision: launch.baseRevision, submissionId: launch.submissionId, toolId: launch.toolId, sectionKey: launch.owner.ownerType === 'result' ? 'analysis' : launch.owner.ownerType === 'experiment' ? 'setup' : 'material_methods', anchorId: launch.anchorId, source: launch.source } }) });
                const result = await response.json();
                if (!response.ok)
                    throw new Error(result.error);
                current.onChange(result.document);
                base.current = result.document;
                if (result.updatedAt) {
                    const input = host.current?.closest('form')?.elements.namedItem('expectedUpdatedAt');
                    if (input instanceof HTMLInputElement)
                        input.disabled = true;
                    setRecordRevision(result.updatedAt);
                }
                delete sessions.current[launch.id];
                try {
                    localStorage.setItem(storageKey, JSON.stringify({ id: draftId, document: result.document, form: formValues(), sessions: sessions.current }));
                }
                catch {
                    try {
                        localStorage.setItem(storageKey, JSON.stringify({ id: draftId, form: formValues(), serverOnly: true }));
                    }
                    catch { }
                }
                iframe.current?.contentWindow?.postMessage({ protocol: 'labnest-qpcr-v1', type: 'SAVE_ACK', sessionId: launch.id }, location.origin);
                delete sessions.current[launch.id];
                setLaunch(null);
                setStatus(current.owner.ownerId ? '已保存到当前记录' : '已保存到草稿');
                requestAnimationFrame(() => host.current?.querySelector(`[data-qpcr-artifact="${launch.artifactId}"]`)?.scrollIntoView({ block: 'center' }));
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
    }, [launch, draftId, formValues, persist, storageKey, title]);
    function close() { if (!launch || busy)
        return; if (!ready) {
        dialog.current?.close();
        setLaunch(null);
        return;
    } closing.current = true; setBusy(true); iframe.current?.contentWindow?.postMessage({ protocol: 'labnest-qpcr-v1', type: 'REQUEST_DRAFT', sessionId: launch.id }, location.origin); }
    return <QpcrEditContext.Provider value={open}><div ref={host}>
    <input type="hidden" name="qpcrDraftId" value={draftId}/>{recordRevision ? <input type="hidden" name="expectedUpdatedAt" value={recordRevision}/> : null}
    {children}
    {status && !launch ? <p className="text-xs text-muted" role="status" data-print-hidden>{status}</p> : null}
    {error && !launch ? <p role="alert" className="text-sm text-error">{error}</p> : null}
  </div>{launch ? createPortal(<dialog ref={dialog} className="qpcr-record-workspace" onCancel={event => { event.preventDefault(); close(); }}>
    <header><Button type="button" onClick={close}>返回记录</Button><span className="min-w-0 flex-1 truncate">{title || '未命名记录'}</span>{launch.toolId === 'qpcr-plate-layout' && !launch.baseRevision && launch.planLayouts.length ? <select aria-label="选用研究计划布局" defaultValue="" onChange={async (event) => { const choice = launch.planLayouts.find(item => item.id === event.target.value); if (!choice)
            return; try {
            const state = await fetch(`/api/attachments/${choice.sessionAttachmentId}`).then(r => r.json()).then(r => r.state);
            setLaunch({ ...launch, state, mappingConfirmed: !launch.samples.length, source: { ownerId: choice.ownerId, artifactId: choice.id, revision: choice.revision } });
            iframe.current?.contentWindow?.postMessage({ protocol: 'labnest-qpcr-v1', type: 'CONTEXT_INIT', sessionId: launch.id, state, samples: launch.samples, title }, location.origin);
        }
        catch {
            setError('布局读取失败，请重试');
        } }}><option value="">选用研究计划布局</option>{launch.planLayouts.map((item, index) => <option key={item.id} value={item.id}>布局 {index + 1} · 修订 {item.revision}</option>)}</select> : null}<span role="status" className="text-xs text-muted">{status}</span>{launch.mappingConfirmed === false ? <label className="text-xs"><input type="checkbox" onChange={() => setLaunch({ ...launch, mappingConfirmed: true })}/> 已核对左侧样本与当前实验一致</label> : null}<Button type="button" variant="primary" disabled={!ready || busy || launch.mappingConfirmed === false} onClick={() => { setBusy(true); iframe.current?.contentWindow?.postMessage({ protocol: 'labnest-qpcr-v1', type: 'REQUEST_OUTPUT', sessionId: launch.id }, location.origin); }}>{busy ? '正在保存…' : launch.toolId === 'qpcr-analysis' ? (pendingApply ? '应用并插入' : '插入结果') : '保存到计划'}</Button></header>
    {error ? <div role="alert" className="qpcr-save-error">{error}{conflict ? <Button type="button" onClick={() => { setLaunch({ ...launch, forkFromId: launch.artifactId, artifactId: newClientMutationId(), baseRevision: 0, submissionId: newClientMutationId() }); setConflict(false); setError(''); }}>另存为新版本</Button> : null}</div> : null}
    <iframe ref={iframe} title={launch.toolId === 'qpcr-analysis' ? 'qPCR 分析' : 'qPCR 板布局'} src={`/tools/${launch.toolId}/index.html?embedded=1&session=${launch.id}`} allow="clipboard-write"/>
  </dialog>, window.document.body) : null}</QpcrEditContext.Provider>;
}
