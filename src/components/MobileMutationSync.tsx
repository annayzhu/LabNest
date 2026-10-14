"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { listMobileMutations, orderMobileMutations, mobileSyncRequestedEvent, removeMobileMutation, updateMobileMutation } from "@/lib/mobile-mutation-queue";

let syncInProgress = false;

export function MobileMutationSync() {
  const router = useRouter();
  useEffect(() => {
    async function sync() {
      if (!navigator.onLine || syncInProgress) return;
      syncInProgress = true;
      try {
        const mutations = orderMobileMutations(await listMobileMutations());
        let changed = false;
        for (const mutation of mutations.filter((item) => item.state !== "conflict" && item.state !== "synced")) {
          await updateMobileMutation({ ...mutation, state: "syncing" });
          try {
            let response: Response;
            if (mutation.actionType === "entry.create") {
              const formData = new FormData();
              Object.entries(mutation.payload.fields).forEach(([key, value]) => formData.set(key, value));
              formData.set("clientMutationId", mutation.clientMutationId);
              formData.set("deviceCreatedAt", mutation.deviceCreatedAt);
              formData.set("newFileIds", mutation.payload.newFileIds);
              formData.set("mediaOrder", mutation.payload.mediaOrder);
              mutation.payload.files.forEach(({ name, file }) => formData.append("files", file, name));
              response = await fetch("/api/entries", { method: "POST", body: formData });
            } else if (mutation.actionType === "run.material") {
              response = await fetch(`/api/experiments/${mutation.payload.experimentId}/materials`, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(mutation.payload.row)});
            } else if (mutation.actionType === "inventory.transaction") {
              response = await fetch("/api/mobile/inventory-transactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...mutation.payload, clientMutationId: mutation.clientMutationId, deviceCreatedAt: mutation.deviceCreatedAt }) });
            } else if (mutation.actionType === "measurement.create") {
              response = await fetch("/api/mobile/measurements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...mutation.payload, clientMutationId: mutation.clientMutationId, deviceCreatedAt: mutation.deviceCreatedAt }) });
            } else if (mutation.actionType === "step.record") {
              response = await fetch("/api/mobile/step-records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...mutation.payload, clientMutationId: mutation.clientMutationId, deviceCreatedAt: mutation.deviceCreatedAt }) });
            } else if (mutation.actionType === "step.complete") {
              response = await fetch("/api/mobile/step-completions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...mutation.payload, clientMutationId: mutation.clientMutationId, deviceCreatedAt: mutation.deviceCreatedAt }) });
            } else if (mutation.actionType === "calculation.create") {
              response = await fetch("/api/mobile/calculations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...mutation.payload, clientMutationId: mutation.clientMutationId, deviceCreatedAt: mutation.deviceCreatedAt }) });
            } else {
              const formData = new FormData();
              formData.set("file", mutation.payload.file, mutation.payload.file.name);
              formData.set("targetType", mutation.payload.targetType);
              formData.set("targetId", mutation.payload.targetId);
              formData.set("linkType", mutation.payload.linkType);
              if (mutation.payload.order) formData.set("order", mutation.payload.order);
              formData.set("clientMutationId", mutation.clientMutationId);
              formData.set("deviceCreatedAt", mutation.deviceCreatedAt);
              response = await fetch("/api/attachments", { method: "POST", body: formData });
            }
            if (!response.ok) {
              const result = await response.json().catch(() => ({})) as { error?: string };
              const requiresReview = [400, 401, 403, 404, 409, 422].includes(response.status);
              await updateMobileMutation({ ...mutation, state: requiresReview ? "conflict" : "pending", retryCount: mutation.retryCount + 1, lastError: result.error ?? `Sync failed (${response.status}).` });
              continue;
            }
            await removeMobileMutation(mutation.clientMutationId);
            changed = true;
          } catch (error) {
            await updateMobileMutation({ ...mutation, state: "pending", retryCount: mutation.retryCount + 1, lastError: error instanceof Error ? error.message : "Network unavailable." });
          }
        }
        if (changed) router.refresh();
      } catch (error) {
        window.dispatchEvent(new CustomEvent("labnest:mobile-storage-error", { detail: error instanceof Error ? error.message : "本机存储不可用" }));
      } finally {
        syncInProgress = false;
      }
    }
    void sync();
    const foreground = () => { if (document.visibilityState === "visible") void sync(); };
    window.addEventListener("focus", foreground);
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("online", sync);
    window.addEventListener(mobileSyncRequestedEvent, sync);
    return () => {
      window.removeEventListener("focus", foreground);
      document.removeEventListener("visibilitychange", foreground);
      window.removeEventListener("online", sync);
      window.removeEventListener(mobileSyncRequestedEvent, sync);
    };
  }, [router]);
  return null;
}
