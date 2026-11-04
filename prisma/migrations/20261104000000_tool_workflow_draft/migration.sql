-- The record-bound draft now serves every embedded tool, not only qPCR.
ALTER TABLE "QpcrWorkflowDraft" RENAME TO "ToolWorkflowDraft";
ALTER TABLE "ToolWorkflowDraft" RENAME CONSTRAINT "QpcrWorkflowDraft_pkey" TO "ToolWorkflowDraft_pkey";
