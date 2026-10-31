INSERT INTO "Entity" (id, name, type, "metadataJson", "updatedAt") VALUES ('ent_pls', 'pX330', 'plasmid', '{}', now());
INSERT INTO "InventoryItem" (id, name, category, brand, vendor, "catalogNumber", "lotNumber", unit, "currentQuantity", "lowThreshold", "entityId", "createdAt", "updatedAt") VALUES
 ('it1','Anti-CD3','antibody','BioLegend',NULL,'100202','A1','µL',50,10,NULL, now() - interval '9 day', now()),
 ('it2','Anti-CD3 (new lot)','antibody','biolegend',NULL,' 100202 ','A2','µL',100,NULL,NULL, now() - interval '8 day', now()),
 ('it3','RNeasy Mini','kit',NULL,'Qiagen','74104','K1','box',2,NULL,NULL, now() - interval '7 day', now()),
 ('it4','NaCl','chemical',NULL,NULL,NULL,NULL,'g',500,NULL,NULL, now() - interval '6 day', now()),
 ('it5','Pipette tip box','instrument_accessory',NULL,NULL,NULL,NULL,'box',3,NULL,NULL, now() - interval '5 day', now()),
 ('it6','Serum sample S1','biological_sample',NULL,NULL,NULL,NULL,'tube',4,NULL,NULL, now() - interval '4 day', now()),
 ('it7','Misc','other',NULL,NULL,NULL,NULL,'piece',1,NULL,NULL, now() - interval '3 day', now()),
 ('it8','50 mL tubes','consumable',NULL,NULL,NULL,NULL,'pack',6,2,NULL, now() - interval '2 day', now()),
 ('it9','pX330 glycerol','reagent',NULL,NULL,NULL,NULL,'tube',1,NULL,'ent_pls', now() - interval '1 day', now()),
 ('it10','pX330 DNA','reagent',NULL,NULL,NULL,NULL,'tube',1,NULL,'ent_pls', now(), now());
INSERT INTO "Attachment" (id, filename, "originalFilename", "mimeType", size, "storagePath") VALUES ('att_m1','m1.pdf','CD3 datasheet.pdf','application/pdf',10,'x/m1.pdf');
INSERT INTO "AttachmentLink" (id, "attachmentId", "targetType", "targetId", "linkType") VALUES ('lnk_m1','att_m1','inventory_item','it2','product_manual');
