INSERT INTO "InventoryLocation" (id, name, type, temperature) VALUES ('loc_f20','Freezer A (-20 °C)','freezer','-20 °C'),('loc_f80','Freezer B (-80 °C)','freezer','-80 °C'),('loc_rt','Reagent shelf 2','shelf','RT'),('loc_gas','Gas cylinder rack','other',NULL);
INSERT INTO "InventoryProduct" (id,name,brand,"catalogNumber","casNumber","groupKey","typeId","fieldValues","controlLevels","lowThreshold","lowThresholdUnit","updatedAt") VALUES
 ('p_cd3','Anti-human CD3','BioLegend','300438',NULL,'reagent','schema_antibody','{"target":"CD3","clone":"OKT3","host":"Mouse","class":"Primary"}','{}',50,'µL',now()),
 ('p_rneasy','RNeasy Mini Kit','Qiagen','74104',NULL,'reagent','schema_inv_kit','{"reactionsPerKit":"50"}','{}',1,'box',now()),
 ('p_azide','Sodium azide','Sigma-Aldrich','S2002','26628-22-8','reagent','schema_inv_chemical','{"purity":"≥99.5%","grade":"ReagentPlus"}','{hazardous,highly_toxic}',NULL,NULL,now()),
 ('p_co2','CO2 cylinder',NULL,NULL,NULL,'reagent','schema_inv_gas','{"gas":"CO2","purity":"99.99%","rental":"Rental"}','{hazardous}',1,'cylinder',now()),
 ('p_px330','pX330',NULL,NULL,NULL,'biological','schema_plasmid','{"backbone":"pUC","selectionMarker":"Ampicillin"}','{}',NULL,NULL,now()),
 ('p_pbs','PBS 10x',NULL,NULL,NULL,'reagent','schema_inv_solution','{"ph":"7.4"}','{}',NULL,NULL,now()),
 ('p_tips','200 µL filter tips','Axygen','TF-200-R-S',NULL,'consumable',NULL,'{}','{}',2,'box',now());
INSERT INTO "InventoryKitComponent" (id,"productId",name,spec,"storageCondition","sortOrder","updatedAt") VALUES
 ('kc1','p_rneasy','Buffer RLT','45 mL','RT',1,now()),('kc2','p_rneasy','Buffer RW1','45 mL','RT',2,now()),('kc3','p_rneasy','Buffer RPE','11 mL','RT',3,now()),('kc4','p_rneasy','RNase-free water','10 mL','RT',4,now()),('kc5','p_rneasy','RNeasy spin columns','50','4 °C',5,now());
INSERT INTO "InventoryItem" (id,"productId",name,brand,"catalogNumber","casNumber",category,"lotNumber",vendor,"managementMode","quantityRecorded","currentQuantity",unit,"locationId","positionCode","expiryDate","principalInvestigator","updatedAt") VALUES
 ('i_cd3a','p_cd3','Anti-human CD3','BioLegend','300438',NULL,'antibody','B312451','BioLegend','precise',true,10,'µL','loc_f20','Box 3 · A1','2026-11-20','Zhang Lab',now()),
 ('i_cd3b','p_cd3','Anti-human CD3','BioLegend','300438',NULL,'antibody','B335120','BioLegend','precise',true,15,'µL','loc_f20','Box 3 · A2','2027-06-30','Zhang Lab',now()),
 ('i_rneasy','p_rneasy','RNeasy Mini Kit','Qiagen','74104',NULL,'kit','172041235','Qiagen','package',true,2,'box','loc_rt',NULL,'2027-03-31','Zhang Lab',now()),
 ('i_azide','p_azide','Sodium azide','Sigma-Aldrich','S2002','26628-22-8','chemical','MKCQ1234','Sigma-Aldrich','precise',true,25,'g','loc_rt','Locked cabinet',NULL,'Zhang Lab',now()),
 ('i_co2','p_co2','CO2 cylinder',NULL,NULL,NULL,'gas',NULL,'Huayuan Gas','package',true,1,'cylinder','loc_gas',NULL,NULL,NULL,now()),
 ('i_pxg','p_px330','pX330',NULL,NULL,NULL,'plasmid',NULL,NULL,'information',false,0,'tube','loc_f80','Glycerol box 1 · C4',NULL,'Zhang Lab',now()),
 ('i_pbs','p_pbs','PBS 10x',NULL,NULL,NULL,'solution',NULL,NULL,'information',false,0,'未指定','loc_rt',NULL,NULL,NULL,now()),
 ('i_tips','p_tips','200 µL filter tips','Axygen','TF-200-R-S',NULL,'consumable','NA','Axygen','package',true,3,'box','loc_rt','Drawer 4',NULL,NULL,now());
INSERT INTO "InventoryTransaction" (id,"inventoryItemId",type,"quantityChange",unit,notes) VALUES
 ('t1','i_cd3a','receive',10,'µL','Opening balance recorded when the item was registered.'),('t2','i_cd3b','receive',15,'µL','Opening balance recorded when the item was registered.'),
 ('t3','i_rneasy','receive',2,'box','Opening balance recorded when the item was registered.'),('t4','i_azide','receive',25,'g','Opening balance recorded when the item was registered.'),
 ('t5','i_co2','receive',2,'cylinder','Opening balance recorded when the item was registered.'),('t6','i_tips','receive',3,'box','Opening balance recorded when the item was registered.');
INSERT INTO "InventoryTransaction" (id,"inventoryItemId",type,"quantityChange",unit,"performedBy",notes,"createdAt") VALUES ('t7','i_cd3b','consume',-5,'µL','Li Wei','Flow staining',now() - interval '1 day');
UPDATE "InventoryItem" SET "currentQuantity" = 10 WHERE id = 'i_cd3b';
UPDATE "InventoryTransaction" SET "quantityChange" = 15 WHERE id = 't2';
INSERT INTO "InventoryContainer" (id,"inventoryItemId",state,label,location,"componentStates","updatedAt") VALUES
 ('c_k1','i_rneasy','warehouse','Kit 1','Reagent shelf 2','{}',now()),
 ('c_k2','i_rneasy','warehouse','Kit 2','Reagent shelf 2','{"kc3":{"state":"used_up"}}',now()),
 ('c_g1','i_co2','held','CO2-07','Incubator 2','{}',now()),
 ('c_g2','i_co2','warehouse','CO2-08','Gas cylinder rack','{}',now()),
 ('c_t1','i_tips','warehouse',NULL,'Drawer 4','{}',now()),('c_t2','i_tips','warehouse',NULL,'Drawer 4','{}',now()),('c_t3','i_tips','warehouse',NULL,'Drawer 4','{}',now());
UPDATE "InventoryContainer" SET holder = 'Cell room' WHERE id = 'c_g1';
INSERT INTO "InventoryContainerEvent" (id,"containerId",action,"performedBy","snapshotJson","clientMutationId") VALUES ('e1','c_g1','issue','Li Wei','{}','11111111-1111-4111-8111-111111111111');
INSERT INTO "InventoryObservation" (id,"containerId",remaining,unit,quality,"performedBy") VALUES ('o1','c_g1',6.5,'MPa','measured','Li Wei');
