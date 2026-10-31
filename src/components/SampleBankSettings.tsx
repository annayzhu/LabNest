"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteSampleBankTypeMap, newSampleBankPushToken, saveSampleBankConnection, testSampleBankConnection } from "@/app/samples/bank/actions";
import { CopyTextButton } from "@/components/CopyTextButton";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import type { FormActionState } from "@/lib/form-actions";

export type SampleBankConnectionView = {
  name: string; baseUrl: string; source: string; callbackUrl: string; enabled: boolean;
  tokenHint: string | null; pushTokenSince: string | null; sourceLocked: boolean;
};

function Message({ state }: { state: FormActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-error">{state.error}</p>;
  if (state.success) return <p role="status" className="text-sm text-moss">{state.success}</p>;
  return null;
}

/**
 * The connection to the external sample bank (S17–S19, S27): where it is, the short name its samples carry, where it
 * pushes results, the two tokens, a test search and the type pairs remembered for it. Off until switched on.
 */
export function SampleBankSettings({ connection, defaultCallbackUrl, typePairs }: { connection: SampleBankConnectionView | null; defaultCallbackUrl: string; typePairs: Array<{ id: string; bankType: string; typeLabel: string }> }) {
  const [saved, save, saving] = useActionState<FormActionState, FormData>(saveSampleBankConnection, {});
  const [pushToken, makePushToken, making] = useActionState(newSampleBankPushToken, {});
  const [test, runTest, testing] = useActionState(testSampleBankConnection, {});
  const [removed, removePair, removing] = useActionState<FormActionState, FormData>(deleteSampleBankTypeMap, {});
  return (
    <div className="space-y-5">
      <form action={save} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm"><span className={formLabelClass}>Name</span><input name="name" required maxLength={120} defaultValue={connection?.name ?? ""} placeholder="Hospital biobank" className={formInputClass} /></label>
        <label className="text-sm">
          <span className={formLabelClass}>Short name</span>
          <input name="source" required defaultValue={connection?.source ?? ""} readOnly={connection?.sourceLocked} placeholder="hospital-biobank" className={formInputClass} />
          <span className="mt-1 block text-xs text-muted">{connection?.sourceLocked ? "Samples already carry this name, so it stays." : "Written on every sample from this bank: lower-case letters, digits, . _ -"}</span>
        </label>
        <label className="text-sm sm:col-span-2"><span className={formLabelClass}>Sample bank address</span><input name="baseUrl" type="url" required defaultValue={connection?.baseUrl ?? ""} placeholder="https://biobank.lab.local/api" className={formInputClass} /><span className="mt-1 block text-xs text-muted">LabNest sends searches to this address followed by /searches.</span></label>
        <label className="text-sm sm:col-span-2"><span className={formLabelClass}>Address the bank pushes results to</span><input name="callbackUrl" type="url" required defaultValue={connection?.callbackUrl ?? defaultCallbackUrl} className={formInputClass} /><span className="mt-1 block text-xs text-muted">This LabNest as the sample bank reaches it, followed by /api/sample-bank/results.</span></label>
        <label className="text-sm">
          <span className={formLabelClass}>The bank&apos;s token</span>
          <input name="token" type="password" autoComplete="off" placeholder={connection?.tokenHint ? `Saved, ends in ${connection.tokenHint}` : "Given by the sample bank"} className={formInputClass} />
          <span className="mt-1 block text-xs text-muted">Sent with every search. Leave empty to keep the saved one.</span>
        </label>
        <label className="flex items-center gap-2 self-center text-sm"><input type="checkbox" name="enabled" defaultChecked={connection?.enabled ?? false} /><span>Turned on</span></label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Button type="submit" disabled={saving}>Save connection</Button><Message state={saved} /></div>
      </form>

      {connection ? (
        <div className="space-y-2 border-t border-hairline pt-4">
          <h3 className="text-sm font-semibold text-ink">LabNest&apos;s push token</h3>
          <p className="text-sm text-graphite">{connection.pushTokenSince ? <><span>The sample bank sends it with every push and signs the push with it. Made</span> {connection.pushTokenSince}.</> : "Not made yet. The sample bank needs it before it can push results."}</p>
          <form action={makePushToken} className="flex flex-wrap items-center gap-3"><Button type="submit" variant="secondary" disabled={making}>Make a new push token</Button><Message state={pushToken} /></form>
          {pushToken.token ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm/40 px-3 py-2">
              <code className="min-w-0 break-all font-mono text-xs text-ink">{pushToken.token}</code>
              <CopyTextButton text={pushToken.token} label="Copy" />
            </div>
          ) : null}
        </div>
      ) : null}

      {connection ? (
        <div className="space-y-2 border-t border-hairline pt-4">
          <h3 className="text-sm font-semibold text-ink">Test the connection</h3>
          <p className="text-sm text-graphite">Sends a search for one record. The bank&apos;s answer shows here; whether its pushed results reach LabNest shows on the search&apos;s page.</p>
          <form action={runTest} className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="secondary" disabled={testing || !connection.enabled}>Send a test search</Button>
            {!connection.enabled ? <span className="text-xs text-muted">Turn the connection on first.</span> : null}
            <Message state={test} />
            {test.searchId ? <Link href={`/samples/bank/${test.searchId}`} className="text-sm font-medium text-moss hover:underline">Open the test search</Link> : null}
          </form>
        </div>
      ) : null}

      {typePairs.length ? (
        <div className="space-y-2 border-t border-hairline pt-4">
          <h3 className="text-sm font-semibold text-ink">Type pairs</h3>
          <p className="text-sm text-graphite">Words this sample bank uses for a type, and the LabNest sample type each means.</p>
          <ul className="divide-y divide-hairline rounded-[var(--ln-radius-panel-inner)] border border-hairline">
            {typePairs.map((pair) => (
              <li key={pair.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-mono text-xs text-ink">{pair.bankType}</span><span aria-hidden className="text-muted">→</span><span className="text-ink">{pair.typeLabel}</span>
                <form action={removePair} className="ml-auto"><input type="hidden" name="id" value={pair.id} /><Button type="submit" size="sm" variant="ghost" disabled={removing}>Remove</Button></form>
              </li>
            ))}
          </ul>
          <Message state={removed} />
        </div>
      ) : null}
    </div>
  );
}
