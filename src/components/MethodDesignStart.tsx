'use client';
import { useActionState } from 'react';
import { saveMethodSearchSettings, startDesignSession, type DesignActionState } from '@/app/protocols/design/actions';
import type { MethodSearchSettingsView } from '@/lib/method-sources/index.server';
import { methodSourceIds, methodSourceLabels } from '@/lib/method-sources/types';
import { Button } from './ui/Button';
import './method-design.css';

/** The start of a design: the goal, the sample and the conditions; searching begins on submit. */
export function MethodDesignStart() {
  const [state, action, pending] = useActionState<DesignActionState, FormData>(startDesignSession, {});
  return <form action={action} className="ln-design-form" aria-busy={pending}>
    <label>实验目标<textarea name="goal" required maxLength={600} placeholder="例如：验证 siRNA 转染 KYSE150 后 LRP1 的敲低效率（qPCR）" /></label>
    <label>样本类型<input name="sampleType" maxLength={200} placeholder="例如：贴壁细胞、小鼠肝组织、血浆" /></label>
    <label>实验条件<input name="conditions" maxLength={1000} placeholder="例如：20 µL 反应体系、起始量 500 ng RNA、已有 TRIzol 法" /></label>
    {state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : null}
    <div><Button type="submit" variant="primary" disabled={pending}>{pending ? '正在检索…' : '检索方法'}</Button></div>
    <p className="ln-design-note">课题组规程库总会检索；开放数据库只在“检索设置”打开后、并且你点击检索时才联网。发送出去的只有目标、样本与条件。</p>
  </form>;
}

/** 检索设置: off by default; the protocols.io token is the user's own and is stored encrypted. */
export function MethodSearchSettingsForm({ settings }: { settings: MethodSearchSettingsView }) {
  const [state, action, pending] = useActionState<DesignActionState, FormData>(saveMethodSearchSettings, {});
  return <form action={action} className="ln-design-settings" aria-busy={pending} aria-label="检索设置">
    <strong>检索设置</strong>
    <label className="is-check"><input type="checkbox" name="enabled" defaultChecked={settings.enabled} />允许外部方法检索（关闭时只搜课题组规程库）</label>
    {methodSourceIds.filter(id => id !== 'local').map(id => <label key={id} className="is-check"><input type="checkbox" name="sources" value={id} defaultChecked={settings.sources.includes(id)} />{methodSourceLabels[id]}</label>)}
    <label>protocols.io 开发者令牌{settings.hasProtocolsIoToken ? '（已保存，留空则不变）' : ''}<input type="password" name="protocolsIoToken" autoComplete="off" placeholder="在 protocols.io → Settings → Developer 申请" /></label>
    {settings.hasProtocolsIoToken ? <label className="is-check"><input type="checkbox" name="clearToken" />清除已保存的令牌</label> : null}
    <p className="ln-design-note">每次外部检索与抓取都会记入活动日志（来源、查询词、结果数）。</p>
    {state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : null}{state.message ? <p role="status" className="text-sm text-success">{state.message}</p> : null}
    <div><Button type="submit" size="sm" disabled={pending}>{pending ? '保存中…' : '保存设置'}</Button></div>
  </form>;
}
