-- An open purchase on the 3002 acceptance clone (labnest_inventory_20261030) only, for reading its invoice.
INSERT INTO "PurchaseRequest" ("id", "title", "status", "vendor", "catalogNumber", "quantity", "unit", "updatedAt")
VALUES ('pur_rneasy', 'RNeasy Mini Kit', 'ordered', 'Qiagen', '74104', 3, 'box', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
