\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE demo_project_ids ON COMMIT DROP AS
SELECT id
FROM "Project"
WHERE name = 'GFP transfection optimization'
  AND description = 'Personal notebook project for optimizing HEK293T transient transfection while tracking protocol versions and inventory consumption.';

CREATE TEMP TABLE demo_protocol_ids ON COMMIT DROP AS
SELECT DISTINCT p.id
FROM "Protocol" p
JOIN "ProtocolVersion" v ON v."protocolId" = p.id
WHERE p."humanCode" = ANY (ARRAY[
  'PRT-100001', 'PRT-100002', 'PRT-100003', 'PRT-100004',
  'PRT-100005', 'PRT-100006', 'PRT-100007'
])
  AND v."changeSummary" = 'Initial seeded protocol version.';

CREATE TEMP TABLE demo_protocol_version_ids ON COMMIT DROP AS
SELECT id
FROM "ProtocolVersion"
WHERE "protocolId" IN (SELECT id FROM demo_protocol_ids);

CREATE TEMP TABLE demo_research_plan_ids ON COMMIT DROP AS
SELECT id
FROM "ResearchPlan"
WHERE "projectId" IN (SELECT id FROM demo_project_ids)
  AND code = 'RP-001';

CREATE TEMP TABLE demo_experiment_ids ON COMMIT DROP AS
SELECT id
FROM "Experiment"
WHERE "projectId" IN (SELECT id FROM demo_project_ids)
  AND "runCode" = 'EXP-001'
  AND title = 'GFP transfection pilot - 2 well scale'
  AND tags @> ARRAY['demo']::text[];

CREATE TEMP TABLE demo_protocol_run_ids ON COMMIT DROP AS
SELECT id
FROM "ProtocolRun"
WHERE "experimentId" IN (SELECT id FROM demo_experiment_ids);

CREATE TEMP TABLE demo_result_ids ON COMMIT DROP AS
SELECT id
FROM "Result"
WHERE "experimentId" IN (SELECT id FROM demo_experiment_ids)
  AND title = '24 h GFP expression placeholder';

CREATE TEMP TABLE demo_entity_ids ON COMMIT DROP AS
SELECT id
FROM "Entity"
WHERE "projectId" IN (SELECT id FROM demo_project_ids)
  AND code = ANY (ARRAY[
    'CL-HEK293T', 'PL-GFP-001', 'SMP-HEK-WCB-001',
    'PR-GAPDH-001', 'AB-GFP-001'
  ]);

CREATE TEMP TABLE demo_sequence_ids ON COMMIT DROP AS
SELECT id
FROM "Sequence"
WHERE name = 'GFP insert demo'
  AND "metadataJson" ->> 'source' = 'demo';

CREATE TEMP TABLE demo_inventory_item_ids ON COMMIT DROP AS
SELECT id
FROM "InventoryItem"
WHERE ("lotNumber" = ANY (ARRAY['LIPO-DEMO-24', 'DMEM-DEMO-07', 'AGR-DEMO-01', 'WCB-DEMO-01']))
  AND name = ANY (ARRAY[
    'Lipofectamine 3000', 'Complete DMEM', 'Agarose',
    'HEK293T working cell bank A01', 'HEK293T working cell bank A02'
  ]);

CREATE TEMP TABLE demo_inventory_location_ids ON COMMIT DROP AS
SELECT DISTINCT "locationId" AS id
FROM "InventoryItem"
WHERE id IN (SELECT id FROM demo_inventory_item_ids)
  AND "locationId" IS NOT NULL
UNION
SELECT DISTINCT l."parentLocationId" AS id
FROM "InventoryLocation" l
WHERE l.id IN (
  SELECT "locationId"
  FROM "InventoryItem"
  WHERE id IN (SELECT id FROM demo_inventory_item_ids)
)
  AND l."parentLocationId" IS NOT NULL;

CREATE TEMP TABLE demo_procurement_inquiry_ids ON COMMIT DROP AS
SELECT id
FROM "ProcurementInquiry"
WHERE "projectId" IN (SELECT id FROM demo_project_ids)
  AND title = 'July reagent and consumable inquiry'
  AND "importedFileName" = '2026-07-self-purchase-quotes.xlsx';

CREATE TEMP TABLE demo_procurement_quote_line_ids ON COMMIT DROP AS
SELECT id
FROM "ProcurementQuoteLine"
WHERE "inquiryId" IN (SELECT id FROM demo_procurement_inquiry_ids);

CREATE TEMP TABLE demo_purchase_request_ids ON COMMIT DROP AS
SELECT id
FROM "PurchaseRequest"
WHERE "procurementQuoteLineId" IN (SELECT id FROM demo_procurement_quote_line_ids)
  AND title = ANY (ARRAY['Agarose refill', 'Filtered P20 tip reloads']);

CREATE TEMP TABLE demo_entry_ids ON COMMIT DROP AS
SELECT id
FROM "Entry"
WHERE (
  "projectId" IN (SELECT id FROM demo_project_ids)
  AND title = 'Adjusted seeding density before GFP transfection'
  AND body = 'Cells looked slightly over-confluent in two wells. Plan to reduce seeding density by 15% and document whether expression improves at 24 h.'
)
OR (
  "projectId" IS NULL
  AND title = 'Invasion assay demo'
  AND body = 'Invasion assay of A549'
  AND "sourceType" = 'photo'
);

CREATE TEMP TABLE demo_ai_provider_ids ON COMMIT DROP AS
SELECT id
FROM "AIProvider"
WHERE "apiKeyEncrypted" IS NULL
  AND (
    (name = 'Manual copy-paste mode' AND type = 'manual_copy_paste')
    OR (name = 'OpenAI API placeholder' AND type = 'openai' AND enabled = false)
  );

CREATE TEMP TABLE demo_reference_connector_ids ON COMMIT DROP AS
SELECT id
FROM "ReferenceConnector"
WHERE enabled = false
  AND (
    (provider = 'zotero' AND "displayName" = 'Zotero local library')
    OR (provider = 'endnote' AND "displayName" = 'EndNote RIS import')
  );

DO $$
BEGIN
  IF (SELECT count(*) FROM demo_project_ids) <> 1 THEN
    RAISE EXCEPTION 'Safety check failed: expected 1 seeded project.';
  END IF;
  IF (SELECT count(*) FROM demo_protocol_ids) <> 7 THEN
    RAISE EXCEPTION 'Safety check failed: expected 7 seeded protocols.';
  END IF;
  IF (SELECT count(*) FROM demo_research_plan_ids) <> 1 THEN
    RAISE EXCEPTION 'Safety check failed: expected 1 seeded research plan.';
  END IF;
  IF (SELECT count(*) FROM demo_experiment_ids) <> 1 THEN
    RAISE EXCEPTION 'Safety check failed: expected 1 seeded experiment.';
  END IF;
  IF (SELECT count(*) FROM demo_result_ids) <> 1 THEN
    RAISE EXCEPTION 'Safety check failed: expected 1 seeded result.';
  END IF;
  IF (SELECT count(*) FROM demo_entity_ids) <> 5 THEN
    RAISE EXCEPTION 'Safety check failed: expected 5 seeded entities.';
  END IF;
  IF (SELECT count(*) FROM demo_sequence_ids) <> 1 THEN
    RAISE EXCEPTION 'Safety check failed: expected 1 seeded sequence.';
  END IF;
  IF (SELECT count(*) FROM demo_inventory_item_ids) <> 5 THEN
    RAISE EXCEPTION 'Safety check failed: expected 5 seeded inventory items.';
  END IF;
  IF (SELECT count(*) FROM demo_inventory_location_ids) <> 4 THEN
    RAISE EXCEPTION 'Safety check failed: expected 4 seeded inventory locations.';
  END IF;
  IF (SELECT count(*) FROM demo_procurement_inquiry_ids) <> 1 THEN
    RAISE EXCEPTION 'Safety check failed: expected 1 seeded procurement inquiry.';
  END IF;
  IF (SELECT count(*) FROM demo_procurement_quote_line_ids) <> 4 THEN
    RAISE EXCEPTION 'Safety check failed: expected 4 seeded quote lines.';
  END IF;
  IF (SELECT count(*) FROM demo_purchase_request_ids) <> 2 THEN
    RAISE EXCEPTION 'Safety check failed: expected 2 seeded purchase requests.';
  END IF;
  IF (SELECT count(*) FROM demo_entry_ids) <> 2 THEN
    RAISE EXCEPTION 'Safety check failed: expected the seeded note and explicit demo entry.';
  END IF;
  IF (SELECT count(*) FROM demo_ai_provider_ids) <> 2 THEN
    RAISE EXCEPTION 'Safety check failed: expected 2 unconfigured seeded AI providers.';
  END IF;
  IF (SELECT count(*) FROM demo_reference_connector_ids) <> 2 THEN
    RAISE EXCEPTION 'Safety check failed: expected 2 disabled seeded reference connectors.';
  END IF;
END $$;

CREATE TEMP TABLE demo_target_ids (
  target_type text NOT NULL,
  target_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO demo_target_ids
SELECT 'project', id FROM demo_project_ids
UNION ALL SELECT 'research_plan', id FROM demo_research_plan_ids
UNION ALL SELECT 'protocol', id FROM demo_protocol_ids
UNION ALL SELECT 'protocol_version', id FROM demo_protocol_version_ids
UNION ALL SELECT 'experiment', id FROM demo_experiment_ids
UNION ALL SELECT 'protocol_run', id FROM demo_protocol_run_ids
UNION ALL SELECT 'result', id FROM demo_result_ids
UNION ALL SELECT 'entity', id FROM demo_entity_ids
UNION ALL SELECT 'sequence', id FROM demo_sequence_ids
UNION ALL SELECT 'inventory_item', id FROM demo_inventory_item_ids
UNION ALL SELECT 'inventory_location', id FROM demo_inventory_location_ids
UNION ALL SELECT 'procurement_inquiry', id FROM demo_procurement_inquiry_ids
UNION ALL SELECT 'procurement_quote_line', id FROM demo_procurement_quote_line_ids
UNION ALL SELECT 'purchase_request', id FROM demo_purchase_request_ids
UNION ALL SELECT 'entry', id FROM demo_entry_ids
UNION ALL SELECT 'ai_provider', id FROM demo_ai_provider_ids
UNION ALL SELECT 'reference_connector', id FROM demo_reference_connector_ids;

CREATE TEMP TABLE demo_attachment_ids ON COMMIT DROP AS
SELECT DISTINCT al."attachmentId" AS id
FROM "AttachmentLink" al
WHERE al."targetId" IN (SELECT target_id FROM demo_target_ids);

DELETE FROM "ActivityLog"
WHERE "targetId" IN (SELECT target_id FROM demo_target_ids);

DELETE FROM "DeletedRecord"
WHERE "targetId" IN (SELECT target_id FROM demo_target_ids)
   OR ("targetType" = 'result' AND title = '24 h GFP expression placeholder');

DELETE FROM "ReportSource"
WHERE "sourceId" IN (SELECT target_id FROM demo_target_ids);

DELETE FROM "ItemLink"
WHERE "sourceId" IN (SELECT target_id FROM demo_target_ids)
   OR "targetId" IN (SELECT target_id FROM demo_target_ids);

DELETE FROM "AttachmentLink"
WHERE "targetId" IN (SELECT target_id FROM demo_target_ids);

DELETE FROM "Attachment" a
WHERE a.id IN (SELECT id FROM demo_attachment_ids)
  AND NOT EXISTS (SELECT 1 FROM "AttachmentLink" al WHERE al."attachmentId" = a.id)
  AND NOT EXISTS (SELECT 1 FROM "Attachment" child WHERE child."derivedFromId" = a.id);

DELETE FROM "ProposedAction"
WHERE "sourceId" IN (SELECT id FROM demo_protocol_run_ids)
   OR reason = ANY (ARRAY[
     'Protocol rule calculated Lipofectamine consumption from well_count * 4.',
     'Protocol rule calculated medium consumption from well_count * 2.',
     'Manual review queue example: entry can become a follow-up experiment draft.'
   ]);

DELETE FROM "Result"
WHERE id IN (SELECT id FROM demo_result_ids);

DELETE FROM "Experiment"
WHERE id IN (SELECT id FROM demo_experiment_ids);

DELETE FROM "PurchaseRequest"
WHERE id IN (SELECT id FROM demo_purchase_request_ids);

DELETE FROM "ProcurementInquiry"
WHERE id IN (SELECT id FROM demo_procurement_inquiry_ids);

DELETE FROM "InventoryItem"
WHERE id IN (SELECT id FROM demo_inventory_item_ids);

DELETE FROM "Entity"
WHERE id IN (SELECT id FROM demo_entity_ids);

DELETE FROM "Sequence"
WHERE id IN (SELECT id FROM demo_sequence_ids);

DELETE FROM "InventoryLocation"
WHERE id IN (SELECT id FROM demo_inventory_location_ids)
  AND "parentLocationId" IS NOT NULL;

DELETE FROM "InventoryLocation"
WHERE id IN (SELECT id FROM demo_inventory_location_ids);

DELETE FROM "Entry"
WHERE id IN (SELECT id FROM demo_entry_ids);

DELETE FROM "ResearchPlan"
WHERE id IN (SELECT id FROM demo_research_plan_ids);

DELETE FROM "Protocol"
WHERE id IN (SELECT id FROM demo_protocol_ids);

DELETE FROM "ReferenceConnector"
WHERE id IN (SELECT id FROM demo_reference_connector_ids);

DELETE FROM "AIProvider"
WHERE id IN (SELECT id FROM demo_ai_provider_ids);

DELETE FROM "Project"
WHERE id IN (SELECT id FROM demo_project_ids);

DELETE FROM "RecordCodeCounter"
WHERE key = 'experiment'
  AND NOT EXISTS (SELECT 1 FROM "Experiment");

COMMIT;

SELECT 'Project' AS table_name, count(*) AS remaining FROM "Project"
UNION ALL SELECT 'ResearchPlan', count(*) FROM "ResearchPlan"
UNION ALL SELECT 'Protocol', count(*) FROM "Protocol"
UNION ALL SELECT 'Entry', count(*) FROM "Entry"
UNION ALL SELECT 'Experiment', count(*) FROM "Experiment"
UNION ALL SELECT 'InventoryItem', count(*) FROM "InventoryItem"
UNION ALL SELECT 'Entity', count(*) FROM "Entity"
UNION ALL SELECT 'Sequence', count(*) FROM "Sequence"
UNION ALL SELECT 'PurchaseRequest', count(*) FROM "PurchaseRequest"
UNION ALL SELECT 'ProcurementInquiry', count(*) FROM "ProcurementInquiry"
UNION ALL SELECT 'ProposedAction', count(*) FROM "ProposedAction"
ORDER BY table_name;
