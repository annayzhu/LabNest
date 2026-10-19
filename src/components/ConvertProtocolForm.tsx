'use client';
import { useActionState } from 'react';
import { convertProtocolVersion, type ConvertState } from '@/app/protocols/[id]/versions/[versionId]/convert/actions';
import { Button } from './ui/Button';

export function ConvertProtocolForm({ versionId, nextVersion }: { versionId: string; nextVersion: string }) {
  const [state, action, pending] = useActionState<ConvertState, FormData>(convertProtocolVersion, {});
  return <form action={action} className="flex flex-wrap items-center gap-3" aria-busy={pending}>
    <input type="hidden" name="versionId" value={versionId} />
    <Button type="submit" variant="primary" disabled={pending}>{pending ? '正在转换…' : `生成草稿 v${nextVersion} 并打开编辑器`}</Button>
    <span className="text-xs text-muted">原版本和用过它的实验都不变。</span>
    {state.error ? <p role="alert" className="w-full text-sm text-error">{state.error}</p> : null}
  </form>;
}
