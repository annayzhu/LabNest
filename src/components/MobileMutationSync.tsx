"use client";

import { useEffect } from "react";
import { listMobileMutations, mobileSyncRequestedEvent, removeMobileMutation, updateMobileMutation } from "@/lib/mobile-mutation-queue";

let syncInProgress = false;

export function MobileMutationSync() {
  useEffect(() => {
    async function sync() {
      if (!navigator.onLine || syncInProgress) return;
      syncInProgress = true;
      try {
        const mutations = await listMobileMutations();
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
            } else if (mutation.actionType === "inventory.transaction") {
              response = await fetch("/api/mobile/inventory-transactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...mutation.payload, clientMutationId: mutation.clientMutationId, deviceCreatedAt: mutation.deviceCreatedAt }) });
            } else if (mutation.actionType === "measurement.create") {
              response = await fetch("/api/mobile/measurements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...mutation.payload, clientMutationId: mutation.clientMutationId, deviceCreatedAt: mutation.deviceCreatedAt }) });
            } else if (mutation.actionType === "step.complete") {
              response = await fetch("/api/mobile/step-completions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...mutation.payload, clientMutationId: mutation.clientMutationId, deviceCreatedAt: mutation.deviceCreatedAt }) });
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
              const requiresReview = [400, 404, 409, 422].includes(response.status);
              await updateMobileMutation({ ...mutation, state: requiresReview ? "conflict" : "pending", retryCount: mutation.retryCount + 1, lastError: result.error ?? `Sync failed (${response.status}).` });
              continue;
            }
            await removeMobileMutation(mutation.clientMutationId);
          } catch (error) {
            await updateMobileMutation({ ...mutation, state: "pending", retryCount: mutation.retryCount + 1, lastError: error instanceof Error ? error.message : "Network unavailable." });
          }
        }
      } finally {
        syncInProgress = false;
      }
    }
    void sync();
    window.addEventListener("online", sync);
    window.addEventListener(mobileSyncRequestedEvent, sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener(mobileSyncRequestedEvent, sync);
    };
  }, []);
  return null;
}
