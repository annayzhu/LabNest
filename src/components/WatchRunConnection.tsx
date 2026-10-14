'use client';
import { useActionState } from 'react';
import { connectWatchRun, disconnectWatchRun } from '@/app/experiments/[id]/run/actions';
import { Button } from './ui/Button';
export function WatchRunConnection({experimentId}:{experimentId:string}) {
 const [state,action,pending]=useActionState(connectWatchRun,{});
 const [revoked,revoke,revoking]=useActionState(disconnectWatchRun,{});
 return <details className="rounded-[var(--ln-radius-panel)] border border-hairline p-3"><summary className="min-h-11 cursor-pointer font-medium text-moss">Apple Watch 执行端 · 预览</summary><p className="text-sm">需先在手表安装 LabNest Watch。仅连接本次实验；体系选择、必填实际值和复杂编辑请在手机完成。网页链接本身不会安装手表应用。</p><form action={action} className="mt-3 flex flex-wrap items-center gap-3"><input type="hidden" name="experimentId" value={experimentId}/><Button type="submit" disabled={pending}>生成手表配对码</Button>{state.code ? <p role="status">配对码 <strong className="font-mono tracking-wider">{state.code}</strong> · 10 分钟内有效，仅用一次。</p> : null}{state.error ? <p role="alert">{state.error}</p> : null}</form><form action={revoke}><input type="hidden" name="experimentId" value={experimentId}/><Button type="submit" variant="ghost" disabled={revoking}>断开本实验的手表连接</Button>{revoked.message ? <p role="status">{revoked.message}</p> : null}{revoked.error ? <p role="alert">{revoked.error}</p> : null}</form><p className="text-xs text-muted">安装、断连恢复和锁屏提醒尚需你的真机验收。局域网地址需手表能访问；电脑 localhost 不能直接用于手表。</p></details>;
}
