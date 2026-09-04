"use client";

import { useEffect } from "react";
import { listMobileMutations, removeMobileMutation, updateMobileMutation } from "@/lib/mobile-mutation-queue";

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
            } else {
              response = await fetch("/api/mobile/measurements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...mutation.payload, clientMutationId: mutation.clientMutationId, deviceCreatedAt: mutation.deviceCreatedAt }) });
            }
            if (!response.ok) {
              const result = await response.json().catch(() => ({})) as { error?: string };
              await updateMobileMutation({ ...mutation, state: response.status === 409 ? "conflict" : "pending", retryCount: mutation.retryCount + 1, lastError: result.error ?? `Sync failed (${response.status}).` });
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
    return () => window.removeEventListener("online", sync);
  }, []);
  return null;
}
