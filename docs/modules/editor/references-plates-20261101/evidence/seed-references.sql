-- Test data for the editor references and plate layout batch (Q248–Q258).
-- Applied only to labnest_references_20261101 (a clone of labnest_inventory_20261030). Never run it on the formal database.
BEGIN;

INSERT INTO "InventoryLocation" (id, name, type, status, "parentLocationId", temperature, "gridRows", "gridColumns")
VALUES ('loc_ref_box3', '盒 3（RNA）', 'box', 'active', 'loc_f80', '-80 °C', 9, 9);

INSERT INTO "Sample" (id, code, name, "typeId", origin, "parentId", "locationId", position, amount, "amountUnit", concentration, "concentrationUnit", status, notes, "updatedAt") VALUES
  ('smp_ref_rna1', 'RNA-0001', 'KYSE150 NC RNA', 'schema_sample_rna', 'KYSE150 NC', NULL, 'loc_ref_box3', 'A1', 18, 'µL', 412, 'ng/µL', 'available', NULL, now()),
  ('smp_ref_rna2', 'RNA-0002', 'KYSE150 siRNA-1 RNA', 'schema_sample_rna', 'KYSE150 siRNA-1', NULL, 'loc_ref_box3', 'A2', 20, 'µL', 388, 'ng/µL', 'available', NULL, now()),
  ('smp_ref_rna3', 'RNA-0003', 'KYSE150 siRNA-2 RNA', 'schema_sample_rna', 'KYSE150 siRNA-2', NULL, 'loc_ref_box3', 'A3', 20, 'µL', 405, 'ng/µL', 'available', NULL, now()),
  ('smp_ref_rna4', 'RNA-0004', 'KYSE150 siRNA-3 RNA', 'schema_sample_rna', 'KYSE150 siRNA-3', NULL, 'loc_ref_box3', 'A4', 19, 'µL', 397, 'ng/µL', 'available', NULL, now()),
  ('smp_ref_rna5', 'RNA-0005', 'HeLa RNA', 'schema_sample_rna', 'HeLa', NULL, NULL, NULL, 0, 'µL', NULL, NULL, 'depleted', 'Used up in an earlier RT.', now()),
  ('smp_ref_rna6', 'RNA-0006', 'HeLa RNA', 'schema_sample_rna', 'HeLa', NULL, 'loc_ref_box3', 'A5', 25, 'µL', 510, 'ng/µL', 'available', NULL, now()),
  ('smp_ref_cdna1', 'CDNA-0001', 'KYSE150 NC cDNA', 'schema_sample_cdna', 'KYSE150 NC', 'smp_ref_rna1', 'loc_ref_box3', 'B1', 40, 'µL', NULL, NULL, 'available', NULL, now()),
  ('smp_ref_cel1', 'CEL-0001', 'KYSE150', 'schema_sample_cells', 'KYSE150', NULL, 'loc_f80', NULL, NULL, NULL, NULL, NULL, 'available', 'P12 frozen stock.', now()),
  ('smp_ref_cel2', 'CEL-0002', 'HeLa', 'schema_sample_cells', 'HeLa', NULL, 'loc_f80', NULL, NULL, NULL, NULL, NULL, 'available', NULL, now()),
  ('smp_ref_tis1', 'TIS-0001', 'ESCC 肿瘤 P01', 'schema_sample_tissue', 'P01', NULL, 'loc_f80', NULL, NULL, NULL, NULL, NULL, 'available', NULL, now()),
  ('smp_ref_tis2', 'TIS-0002', 'ESCC 癌旁 P01', 'schema_sample_tissue', 'P01', NULL, 'loc_f80', NULL, NULL, NULL, NULL, NULL, 'available', NULL, now()),
  ('smp_ref_dna1', 'DNA-0001', 'P01 gDNA', 'schema_sample_dna', 'P01', 'smp_ref_tis1', NULL, NULL, NULL, NULL, NULL, NULL, 'discarded', NULL, now());

-- EXP-007 (KYSE150 transfection pilot, RNA extraction) takes the four KYSE150 RNAs in two groups.
INSERT INTO "ExperimentSampleGroup" (id, "experimentId", label, "sortOrder") VALUES
  ('esg_ref_nc', 'cmuxftwkn000eleoe5k1q2udf', 'NC', 0),
  ('esg_ref_si', 'cmuxftwkn000eleoe5k1q2udf', 'siRNA', 1);
INSERT INTO "ExperimentSample" (id, "experimentId", "sampleId", role, "groupId", "sortOrder") VALUES
  ('es_ref_1', 'cmuxftwkn000eleoe5k1q2udf', 'smp_ref_rna1', 'input', 'esg_ref_nc', 0),
  ('es_ref_2', 'cmuxftwkn000eleoe5k1q2udf', 'smp_ref_rna2', 'input', 'esg_ref_si', 1),
  ('es_ref_3', 'cmuxftwkn000eleoe5k1q2udf', 'smp_ref_rna3', 'input', 'esg_ref_si', 2),
  ('es_ref_4', 'cmuxftwkn000eleoe5k1q2udf', 'smp_ref_rna4', 'input', 'esg_ref_si', 3);

COMMIT;
