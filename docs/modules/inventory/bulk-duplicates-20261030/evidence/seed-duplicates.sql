-- Duplicates for the 3002 acceptance clone (labnest_inventory_20261030) only; never the formal database.
-- An old product with the same brand and a hyphenated catalogue number, a Chinese-named product sharing a CAS number,
-- and a second registration of CD3 lot B312451 in the same freezer.
INSERT INTO "InventoryProduct" ("id", "name", "brand", "catalogNumber", "casNumber", "typeId", "groupKey", "lowThreshold", "lowThresholdUnit", "notes", "updatedAt")
VALUES ('p_cd3_old', 'anti CD3 (old entry)', 'biolegend', '300-438', NULL, 'schema_antibody', 'reagent', 2, 'vial', 'Registered before the product list was cleaned.', CURRENT_TIMESTAMP),
       ('p_azide_zh', '叠氮化钠', 'Aladdin', 'S101101', '26628-22-8', 'schema_inv_chemical', 'reagent', NULL, NULL, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "InventoryItem" ("id", "name", "brand", "catalogNumber", "category", "productId", "lotNumber", "locationId", "currentQuantity", "unit", "managementMode", "quantityRecorded", "status", "updatedAt")
VALUES ('i_cd3_old', 'anti CD3 (old entry)', 'biolegend', '300-438', 'antibody', 'p_cd3_old', 'A100200', 'loc_f20', 1, 'vial', 'package', true, 'active', CURRENT_TIMESTAMP),
       ('i_cd3_twin', 'Anti-human CD3 (OKT3)', 'BioLegend', '300438', 'antibody', 'p_cd3', 'B312451', 'loc_f20', 50, 'µL', 'precise', true, 'active', CURRENT_TIMESTAMP),
       ('i_azide_zh', '叠氮化钠', 'Aladdin', 'S101101', 'chemical', 'p_azide_zh', 'L2210', 'loc_rt', 100, 'g', 'precise', true, 'active', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "InventoryContainer" ("id", "inventoryItemId", "state", "location", "updatedAt")
VALUES ('c_cd3_old', 'i_cd3_old', 'warehouse', 'Freezer A', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
