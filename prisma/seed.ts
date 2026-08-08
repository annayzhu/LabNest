import { prisma } from "../src/lib/db";

const protocolTemplates = [
  {
    title: "Cell transfection",
    description: "Plate-based transient transfection with explicit consumption proposals.",
    tags: ["cell-culture", "transfection"],
    parameters: [
      { name: "well_count", type: "number", default: 2, required: true },
      { name: "cell_line", type: "entity", entity_type: "cell_line", required: true },
      { name: "plasmid", type: "entity", entity_type: "plasmid", required: true },
    ],
    materials: [
      { name: "Lipofectamine 3000", unit: "uL", role: "transfection reagent" },
      { name: "Opti-MEM", unit: "mL", role: "complex formation" },
      { name: "Complete DMEM", unit: "mL", role: "culture medium" },
    ],
    equipment: [
      { name: "CO2 incubator", setting: "37 C, 5% CO2" },
      { name: "Fluorescence microscope", setting: "GFP channel" },
    ],
    steps: [
      {
        order: 1,
        title: "Seed cells",
        description: "Seed {{cell_line}} into {{well_count}} wells at the planned density.",
        requires_confirmation: true,
        allows_deviation: true,
      },
      {
        order: 2,
        title: "Prepare DNA-lipid complexes",
        description: "Prepare complexes for {{plasmid}} using scaled reagent volumes.",
        requires_confirmation: true,
        allows_deviation: true,
      },
      {
        order: 3,
        title: "Add complexes and incubate",
        description: "Add complexes dropwise, return plate to incubator, and record any toxicity.",
        requires_confirmation: true,
        allows_deviation: true,
      },
      {
        order: 4,
        title: "Capture expression readout",
        description: "Image representative wells and record GFP expression at the selected timepoint.",
        requires_confirmation: false,
        allows_deviation: true,
      },
    ],
    consumptionRules: [
      {
        material_name: "Lipofectamine 3000",
        formula: "well_count * 4",
        unit: "uL",
        requires_inventory_selection: true,
      },
      {
        material_name: "Complete DMEM",
        formula: "well_count * 2",
        unit: "mL",
        requires_inventory_selection: true,
      },
    ],
    resultTemplates: [
      {
        result_type: "fluorescence_expression",
        fields: [
          { name: "timepoint", type: "number", unit: "h", required: true },
          {
            name: "gfp_expression",
            type: "select",
            options: ["positive", "weak", "negative"],
            required: true,
          },
          { name: "transfection_efficiency", type: "number", unit: "%", required: false },
          { name: "microscopy_images", type: "attachment[]", required: false },
        ],
      },
    ],
  },
  {
    title: "PCR",
    description: "Endpoint PCR template with primer, cycle, and gel check placeholders.",
    tags: ["molecular", "PCR"],
    parameters: [
      { name: "reaction_count", type: "number", default: 8, required: true },
      { name: "annealing_temp", type: "number", unit: "C", default: 60, required: true },
    ],
  },
  {
    title: "qPCR",
    description: "qPCR setup with result template for Ct and delta Ct capture.",
    tags: ["molecular", "qPCR"],
    parameters: [
      { name: "sample_count", type: "number", default: 12, required: true },
      { name: "technical_replicates", type: "number", default: 3, required: true },
    ],
  },
  {
    title: "Western blot",
    description: "Protein blot workflow with sample loading and antibody tracking.",
    tags: ["protein", "western-blot"],
    parameters: [{ name: "sample_count", type: "number", default: 6, required: true }],
  },
  {
    title: "Colony PCR",
    description: "Colony screening workflow for bacterial transformants.",
    tags: ["cloning", "screening"],
    parameters: [{ name: "colony_count", type: "number", default: 12, required: true }],
  },
  {
    title: "Gel electrophoresis",
    description: "Agarose gel run with lane map and imaging result capture.",
    tags: ["molecular", "gel"],
    parameters: [{ name: "gel_percent", type: "number", default: 1, required: true }],
  },
  {
    title: "Cell passage",
    description: "Routine passage record with split ratio and confluence.",
    tags: ["cell-culture", "maintenance"],
    parameters: [
      { name: "split_ratio", type: "text", default: "1:4", required: true },
      { name: "confluence", type: "number", unit: "%", default: 80, required: true },
    ],
  },
];

async function resetDatabase() {
  await prisma.activityLog.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.proposedAction.deleteMany();
  await prisma.itemLink.deleteMany();
  await prisma.attachmentLink.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.sampleLifecycleEvent.deleteMany();
  await prisma.sampleProfile.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.procurementQuoteLine.deleteMany();
  await prisma.procurementInquiry.deleteMany();
  await prisma.result.deleteMany();
  await prisma.experimentStep.deleteMany();
  await prisma.protocolRun.deleteMany();
  await prisma.experimentProtocolVersion.deleteMany();
  await prisma.experiment.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.inventoryLocation.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.sequenceFeature.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.protocolVersion.deleteMany();
  await prisma.researchPlanProtocol.deleteMany();
  await prisma.protocol.deleteMany();
  await prisma.entry.deleteMany();
  await prisma.researchPlan.deleteMany();
  await prisma.referenceConnector.deleteMany();
  await prisma.aISettings.deleteMany();
  await prisma.aIProvider.deleteMany();
  await prisma.project.deleteMany();
}

async function main() {
  await resetDatabase();

  const project = await prisma.project.create({
    data: {
      name: "GFP transfection optimization",
      description:
        "Personal notebook project for optimizing HEK293T transient transfection while tracking protocol versions and inventory consumption.",
      tags: ["HEK293T", "GFP", "optimization"],
    },
  });

  const researchPlan = await prisma.researchPlan.create({
    data: {
      projectId: project.id,
      code: "RP-001",
      title: "Optimize GFP transient transfection conditions",
      objective: "Identify a reproducible transfection setup for HEK293T pilot experiments.",
      hypothesis: "Cell confluence and reagent scaling influence transfection performance and toxicity.",
      rationale: "Seed data demonstrates the Project → Research Plan → Protocol → Experiment backbone; it is not biological evidence.",
      design: "Repeat the same reviewed protocol version while varying one documented condition at a time.",
      status: "active",
      tags: ["HEK293T", "GFP", "optimization"],
    },
  });

  const sequence = await prisma.sequence.create({
    data: {
      name: "GFP insert demo",
      type: "DNA",
      sequence:
        "ATGGTGAGCAAGGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGACGGCGACGTAAACGGCCACAAGTTCAGCGTGTCCGGCGAGGGCGAG",
      description: "Short demo coding sequence fragment used for sequence utility tests and entity linking.",
      metadataJson: { source: "demo" },
      features: {
        create: [{ name: "GFP coding fragment", type: "CDS", start: 1, end: 120, strand: "+" }],
      },
    },
  });

  const hek = await prisma.entity.create({
    data: {
      name: "HEK293T",
      type: "cell_line",
      code: "CL-HEK293T",
      projectId: project.id,
      description: "Demo mammalian cell line for transfection protocol runs.",
      metadataJson: { biosafety: "BSL-2", mycoplasma: "unknown in demo seed" },
    },
  });

  const plasmid = await prisma.entity.create({
    data: {
      name: "pLenti-GFP",
      type: "plasmid",
      code: "PL-GFP-001",
      projectId: project.id,
      sequenceId: sequence.id,
      description: "Demo GFP plasmid linked to the sequence library.",
      metadataJson: { resistance: "Ampicillin", promoter: "CMV" },
    },
  });

  const hekWorkingCellBank = await prisma.entity.create({
    data: {
      name: "HEK293T working cell bank",
      type: "sample",
      code: "SMP-HEK-WCB-001",
      projectId: project.id,
      parentEntityId: hek.id,
      description: "Demo sample identity record separated from vial-level aliquot inventory.",
      metadataJson: { source: "HEK293T master culture P18", biosafety: "BSL-2" },
    },
  });

  await prisma.entity.createMany({
    data: [
      {
        name: "GAPDH primer pair",
        type: "primer",
        code: "PR-GAPDH-001",
        projectId: project.id,
        description: "Demo qPCR housekeeping primer pair.",
        metadataJson: { forward: "demo", reverse: "demo" },
      },
      {
        name: "Anti-GFP antibody",
        type: "antibody",
        code: "AB-GFP-001",
        projectId: project.id,
        description: "Demo antibody for protein readout tracking.",
        metadataJson: { host: "rabbit", application: ["WB", "IF"] },
      },
    ],
  });

  const protocolVersions = [];
  for (const [templateIndex, template] of protocolTemplates.entries()) {
    const protocol = await prisma.protocol.create({
      data: {
        humanCode: `PRT-${String(100001 + templateIndex).padStart(6, "0")}`,
        title: template.title,
        canonicalTitle: template.title,
        description: template.description,
        scope: template.title === "Cell transfection" ? "project" : "general",
        availability: "active",
        recordStatus: "reviewed",
        projectId: template.title === "Cell transfection" ? project.id : null,
        tags: template.tags,
        versions: {
          create: {
            revision: 1,
            displayVersion: "0.1",
            reviewStage: "reviewed",
            recordStatus: "reviewed",
            changeSummary: "Initial seeded protocol version.",
            title: `${template.title} v0.1`,
            purpose: template.description,
            background: "Seeded V1 protocol template. Review locally before production use.",
            scope: "Personal and small-lab use; not a regulated GxP workflow.",
            notes: "Protocol calculations create proposed actions only.",
            parametersJson: template.parameters ?? [],
            materialsJson: template.materials ?? [],
            equipmentJson: template.equipment ?? [],
            stepsJson:
              template.steps ??
              [
                {
                  order: 1,
                  title: "Prepare setup",
                  description: "Confirm materials, parameters, and sample identifiers.",
                  requires_confirmation: true,
                  allows_deviation: true,
                },
                {
                  order: 2,
                  title: "Run protocol",
                  description: "Execute the method and record observations.",
                  requires_confirmation: true,
                  allows_deviation: true,
                },
              ],
            consumptionRulesJson: template.consumptionRules ?? [],
            resultTemplatesJson: template.resultTemplates ?? [],
          },
        },
      },
      include: { versions: true },
    });
    protocolVersions.push(protocol.versions[0]);
  }

  const cellTransfectionVersion = protocolVersions[0];

  await prisma.researchPlanProtocol.create({
    data: {
      researchPlanId: researchPlan.id,
      protocolId: cellTransfectionVersion.protocolId,
      isPrimary: true,
      note: "Project-adapted protocol for the initial research plan.",
    },
  });

  const room = await prisma.inventoryLocation.create({
    data: { name: "Tissue culture room", type: "room", description: "Demo room location" },
  });
  const fridge = await prisma.inventoryLocation.create({
    data: {
      name: "4C fridge A",
      type: "fridge",
      parentLocationId: room.id,
      temperature: "4 C",
    },
  });
  const minus80Freezer = await prisma.inventoryLocation.create({
    data: {
      name: "-80C freezer A",
      type: "freezer",
      parentLocationId: room.id,
      temperature: "-80 C",
    },
  });
  const roomShelf = await prisma.inventoryLocation.create({
    data: {
      name: "Room shelf 2",
      type: "shelf",
      parentLocationId: room.id,
    },
  });

  const lipo = await prisma.inventoryItem.create({
    data: {
      name: "Lipofectamine 3000",
      entityId: null,
      containerType: "tube",
      lotNumber: "LIPO-DEMO-24",
      vendor: "Thermo Fisher",
      catalogNumber: "L3000008",
      currentQuantity: 120,
      unit: "uL",
      locationId: fridge.id,
      expiryDate: new Date("2026-10-01T00:00:00Z"),
      storageCondition: "4 C, protect from light",
      notes: "Seeded quantity came from receive transaction.",
    },
  });

  const dmem = await prisma.inventoryItem.create({
    data: {
      name: "Complete DMEM",
      containerType: "bottle",
      lotNumber: "DMEM-DEMO-07",
      vendor: "Gibco",
      currentQuantity: 38,
      unit: "mL",
      locationId: fridge.id,
      expiryDate: new Date("2026-07-25T00:00:00Z"),
      storageCondition: "4 C",
      notes: "Flagged by the demo UI as expiring soon.",
    },
  });

  const agarose = await prisma.inventoryItem.create({
    data: {
      name: "Agarose",
      containerType: "bottle",
      lotNumber: "AGR-DEMO-01",
      vendor: "Bio-Rad",
      currentQuantity: 9,
      unit: "g",
      locationId: roomShelf.id,
      expiryDate: new Date("2027-02-01T00:00:00Z"),
      notes: "Low stock example.",
    },
  });

  const hekWcbA01 = await prisma.inventoryItem.create({
    data: {
      entityId: hekWorkingCellBank.id,
      name: "HEK293T working cell bank A01",
      containerType: "cryovial",
      barcode: "LN-SMP-HEK-WCB-A01",
      aliquotCode: "HEK-WCB-A01",
      lotNumber: "WCB-DEMO-01",
      currentQuantity: 0,
      unit: "vial",
      concentration: "1.2e6 cells/vial",
      locationId: minus80Freezer.id,
      positionCode: "A01",
      expiryDate: new Date("2027-01-15T00:00:00Z"),
      storageCondition: "-80 C",
      freezeThawCount: 1,
      status: "archived",
      notes: "Thawed to seed the transfection pilot; retained as an audit record.",
    },
  });

  const hekWcbA02 = await prisma.inventoryItem.create({
    data: {
      entityId: hekWorkingCellBank.id,
      name: "HEK293T working cell bank A02",
      containerType: "cryovial",
      barcode: "LN-SMP-HEK-WCB-A02",
      aliquotCode: "HEK-WCB-A02",
      lotNumber: "WCB-DEMO-01",
      currentQuantity: 1,
      unit: "vial",
      concentration: "1.2e6 cells/vial",
      locationId: minus80Freezer.id,
      positionCode: "A02",
      expiryDate: new Date("2027-01-15T00:00:00Z"),
      storageCondition: "-80 C",
      freezeThawCount: 0,
      status: "active",
      notes: "Reserve aliquot from the same working cell bank preparation.",
    },
  });

  await prisma.inventoryTransaction.createMany({
    data: [
      {
        inventoryItemId: lipo.id,
        type: "receive",
        quantityChange: 120,
        unit: "uL",
        toLocationId: fridge.id,
        notes: "Initial demo receive transaction.",
      },
      {
        inventoryItemId: dmem.id,
        type: "receive",
        quantityChange: 38,
        unit: "mL",
        toLocationId: fridge.id,
        notes: "Initial demo receive transaction.",
      },
      {
        inventoryItemId: agarose.id,
        type: "receive",
        quantityChange: 9,
        unit: "g",
        toLocationId: roomShelf.id,
        notes: "Initial demo receive transaction.",
      },
      {
        inventoryItemId: hekWcbA01.id,
        type: "aliquot",
        quantityChange: 1,
        unit: "vial",
        toLocationId: minus80Freezer.id,
        notes: "Created cryovial aliquot A01 from the working cell bank preparation.",
      },
      {
        inventoryItemId: hekWcbA02.id,
        type: "aliquot",
        quantityChange: 1,
        unit: "vial",
        toLocationId: minus80Freezer.id,
        notes: "Created reserve cryovial aliquot A02 from the same preparation.",
      },
    ],
  });

  await prisma.entry.create({
    data: {
      title: "Adjusted seeding density before GFP transfection",
      body:
        "Cells looked slightly over-confluent in two wells. Plan to reduce seeding density by 15% and document whether expression improves at 24 h.",
      projectId: project.id,
      researchPlanId: researchPlan.id,
      tags: ["observation", "transfection"],
      moodStatus: "needs follow-up",
      sourceType: "text",
      recordStatus: "recorded",
    },
  });

  const experiment = await prisma.experiment.create({
    data: {
      title: "GFP transfection pilot - 2 well scale",
      projectId: project.id,
      researchPlanId: researchPlan.id,
      status: "running",
      recordStatus: "recorded",
      purpose: "Pilot a 2-well HEK293T transfection and confirm that protocol-derived consumption remains reviewable.",
      background:
        "This seeded experiment demonstrates the V1 protocol-to-experiment workflow. It should not be treated as biological evidence.",
      materialsText: "HEK293T, pLenti-GFP, Lipofectamine 3000, Complete DMEM.",
      observations: "No observations recorded yet.",
      primaryProtocolVersionId: cellTransfectionVersion.id,
      tags: ["demo", "protocol-run"],
      protocolVersions: {
        create: { protocolVersionId: cellTransfectionVersion.id, role: "primary", order: 0 },
      },
    },
  });

  const run = await prisma.protocolRun.create({
    data: {
      protocolVersionId: cellTransfectionVersion.id,
      experimentId: experiment.id,
      parametersJson: {
        well_count: 2,
        cell_line: hek.id,
        plasmid: plasmid.id,
      },
      calculatedConsumptionJson: [
        { material_name: "Lipofectamine 3000", quantity: 8, unit: "uL" },
        { material_name: "Complete DMEM", quantity: 4, unit: "mL" },
      ],
      status: "running",
    },
  });

  await prisma.inventoryTransaction.create({
    data: {
      inventoryItemId: hekWcbA01.id,
      type: "thaw",
      quantityChange: -1,
      unit: "vial",
      fromLocationId: minus80Freezer.id,
      experimentId: experiment.id,
      notes: "Thawed for the GFP transfection pilot; vial-level stock closed.",
    },
  });

  await prisma.experimentStep.createMany({
    data: [
      {
        experimentId: experiment.id,
        protocolStepRef: "1",
        order: 1,
        title: "Seed cells",
        description: "Seed HEK293T into 2 wells at the planned density.",
        completed: true,
        completedAt: new Date(),
      },
      {
        experimentId: experiment.id,
        protocolStepRef: "2",
        order: 2,
        title: "Prepare DNA-lipid complexes",
        description: "Prepare pLenti-GFP complexes using calculated reagent volumes.",
      },
      {
        experimentId: experiment.id,
        protocolStepRef: "3",
        order: 3,
        title: "Add complexes and incubate",
        description: "Add complexes dropwise and record toxicity.",
      },
    ],
  });

  const sampleProfile = await prisma.sampleProfile.create({
    data: {
      entityId: hekWorkingCellBank.id,
      sampleCode: "SMP-HEK-WCB-001",
      sampleType: "cell_line_bank",
      sourceLabel: "HEK293T master culture P18",
      sourceType: "cell_culture",
      collectedAt: new Date("2026-07-06T07:30:00Z"),
      preparedAt: new Date("2026-07-06T08:50:00Z"),
      status: "stocked",
      biosafetyLevel: "BSL-2",
      storageRequirement: "-80 C cryovial storage",
      freezeThawCount: 1,
      notes: "Sample-level identity is separated from vial-level aliquots so experiments can cite the same biological source.",
      metadataJson: {
        primary_location: "-80C freezer A",
        active_aliquot_count: 1,
        related_experiment_ids: [experiment.id],
      },
    },
  });

  await prisma.sampleLifecycleEvent.createMany({
    data: [
      {
        sampleProfileId: sampleProfile.id,
        type: "register",
        title: "Registered working cell bank profile",
        occurredAt: new Date("2026-07-06T07:30:00Z"),
        notes: "Created as a sample profile linked to the GFP optimization project.",
      },
      {
        sampleProfileId: sampleProfile.id,
        type: "aliquot",
        title: "Created cryovial aliquot A01",
        occurredAt: new Date("2026-07-06T09:00:00Z"),
        inventoryItemId: hekWcbA01.id,
        toLocationId: minus80Freezer.id,
        quantityChange: 1,
        unit: "vial",
        metadataJson: { aliquot_code: "HEK-WCB-A01" },
      },
      {
        sampleProfileId: sampleProfile.id,
        type: "aliquot",
        title: "Created cryovial aliquot A02",
        occurredAt: new Date("2026-07-06T09:02:00Z"),
        inventoryItemId: hekWcbA02.id,
        toLocationId: minus80Freezer.id,
        quantityChange: 1,
        unit: "vial",
        metadataJson: { aliquot_code: "HEK-WCB-A02" },
      },
      {
        sampleProfileId: sampleProfile.id,
        type: "thaw",
        title: "Thawed aliquot A01 for transfection setup",
        occurredAt: new Date("2026-07-07T05:20:00Z"),
        experimentId: experiment.id,
        inventoryItemId: hekWcbA01.id,
        fromLocationId: minus80Freezer.id,
        quantityChange: -1,
        unit: "vial",
        notes: "Lifecycle event mirrors the inventory transaction and keeps the sample lineage visible.",
        metadataJson: { aliquot_code: "HEK-WCB-A01" },
      },
      {
        sampleProfileId: sampleProfile.id,
        type: "result_link",
        title: "Linked to pending 24 h fluorescence readout",
        occurredAt: new Date("2026-07-07T06:00:00Z"),
        experimentId: experiment.id,
        notes: "No biological conclusion is recorded yet; this only preserves provenance.",
      },
    ],
  });

  await prisma.proposedAction.createMany({
    data: [
      {
        sourceType: "protocol",
        sourceId: run.id,
        actionType: "consume_inventory",
        status: "pending",
        confidence: 1,
        reason: "Protocol rule calculated Lipofectamine consumption from well_count * 4.",
        payloadJson: {
          inventory_item_id: lipo.id,
          inventory_item_name: lipo.name,
          quantity_change: -8,
          unit: "uL",
          experiment_id: experiment.id,
        },
      },
      {
        sourceType: "protocol",
        sourceId: run.id,
        actionType: "consume_inventory",
        status: "pending",
        confidence: 1,
        reason: "Protocol rule calculated medium consumption from well_count * 2.",
        payloadJson: {
          inventory_item_id: dmem.id,
          inventory_item_name: dmem.name,
          quantity_change: -4,
          unit: "mL",
          experiment_id: experiment.id,
        },
      },
      {
        sourceType: "entry",
        sourceId: null,
        actionType: "create_experiment",
        status: "pending",
        confidence: 0.74,
        reason: "Manual review queue example: entry can become a follow-up experiment draft.",
        payloadJson: {
          title: "Compare 85% vs 70% confluence at transfection",
          project_id: project.id,
        },
      },
    ],
  });

  await prisma.result.create({
    data: {
      experimentId: experiment.id,
      entityId: plasmid.id,
      projectId: project.id,
      resultType: "fluorescence_expression",
      title: "24 h GFP expression placeholder",
      status: "active",
      notes: "Result form seeded from protocol result template; no real measurement yet.",
      metadataJson: { timepoint_h: 24, gfp_expression: "pending" },
    },
  });

  const procurementInquiry = await prisma.procurementInquiry.create({
    data: {
      title: "July reagent and consumable inquiry",
      status: "selected",
      sourceType: "excel",
      projectId: project.id,
      importedFileName: "2026-07-self-purchase-quotes.xlsx",
      supplierScope: "multi_supplier",
      quotedAt: new Date("2026-07-08T01:10:00Z"),
      notes: "Seeded inquiry sheet: selected rows become purchase requests; unselected rows remain useful price evidence.",
    },
  });

  const agaroseQuote = await prisma.procurementQuoteLine.create({
    data: {
      inquiryId: procurementInquiry.id,
      status: "selected",
      supplierName: "Bio-Rad",
      productCategory: "化学试剂",
      productName: "Agarose",
      casNumber: "9012-36-6",
      specification: "100 g",
      quantity: 1,
      packageUnit: "瓶",
      amountExclTax: 88,
      taxAmount: 11.44,
      unitPriceExclTax: 88,
      capacity: 100,
      capacityUnit: "g",
      brand: "Bio-Rad",
      catalogNumber: "1613100",
      decisionReason: "Selected for valid chemical fields and existing supplier reliability.",
      selectedAt: new Date("2026-07-08T02:00:00Z"),
    },
  });

  await prisma.procurementQuoteLine.create({
    data: {
      inquiryId: procurementInquiry.id,
      status: "not_selected",
      supplierName: "Reagent Supplier B",
      productCategory: "化学试剂",
      productName: "Agarose",
      casNumber: "9012-36-6",
      specification: "100 g",
      quantity: 1,
      packageUnit: "瓶",
      amountExclTax: 126,
      taxAmount: 16.38,
      unitPriceExclTax: 126,
      capacity: 100,
      capacityUnit: "g",
      brand: "Supplier B",
      catalogNumber: "AG-100",
      decisionReason: "Not selected: higher total price for the same specification.",
    },
  });

  const tipsQuote = await prisma.procurementQuoteLine.create({
    data: {
      inquiryId: procurementInquiry.id,
      status: "selected",
      supplierName: "Rainin",
      productCategory: "实验材料",
      productName: "Filtered P20 tip reloads",
      specification: "10 racks",
      quantity: 10,
      packageUnit: "盒",
      amountExclTax: 620,
      taxAmount: 80.6,
      unitPriceExclTax: 62,
      brand: "Rainin",
      catalogNumber: "RT-L10F",
      decisionReason: "Selected because it matches the pipette platform already in use.",
      selectedAt: new Date("2026-07-08T02:05:00Z"),
    },
  });

  await prisma.procurementQuoteLine.create({
    data: {
      inquiryId: procurementInquiry.id,
      status: "future_candidate",
      supplierName: "Consumable Supplier C",
      productCategory: "实验材料",
      productName: "Filtered P20 tip reloads",
      specification: "10 racks",
      quantity: 10,
      packageUnit: "盒",
      amountExclTax: 460,
      taxAmount: 59.8,
      unitPriceExclTax: 46,
      brand: "Supplier C",
      catalogNumber: "P20-F-10",
      decisionReason: "Lower price, but compatibility should be checked before switching.",
    },
  });

  await prisma.purchaseRequest.create({
    data: {
      title: "Agarose refill",
      status: "planned",
      vendor: "Bio-Rad",
      catalogNumber: "1613100",
      procurementQuoteLineId: agaroseQuote.id,
      quantity: 1,
      unit: "瓶",
      price: 99.44,
      notes: "Selected from the July inquiry sheet; receive into inventory as 100 g after purchase.",
    },
  });

  await prisma.purchaseRequest.create({
    data: {
      title: "Filtered P20 tip reloads",
      status: "ordered",
      vendor: "Rainin",
      catalogNumber: "RT-L10F",
      procurementQuoteLineId: tipsQuote.id,
      quantity: 10,
      unit: "盒",
      price: 700.6,
      orderDate: new Date("2026-07-05T00:00:00Z"),
    },
  });

  await prisma.itemLink.createMany({
    data: [
      {
        sourceType: "experiment",
        sourceId: experiment.id,
        targetType: "protocol_version",
        targetId: cellTransfectionVersion.id,
        linkType: "derived_from",
        createdBy: "system",
        note: "Experiment created from protocol version.",
      },
      {
        sourceType: "experiment",
        sourceId: experiment.id,
        targetType: "entity",
        targetId: hek.id,
        linkType: "uses",
        createdBy: "user",
      },
      {
        sourceType: "experiment",
        sourceId: experiment.id,
        targetType: "entity",
        targetId: plasmid.id,
        linkType: "uses",
        createdBy: "user",
      },
    ],
  });

  const manualProvider = await prisma.aIProvider.create({
    data: {
      name: "Manual copy-paste mode",
      type: "manual_copy_paste",
      enabled: true,
      defaultModel: "external-web-subscription",
      capabilitiesJson: ["text", "structured_output"],
    },
  });
  await prisma.aIProvider.create({
    data: {
      name: "OpenAI API placeholder",
      type: "openai",
      enabled: false,
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "provider-model-to-configure",
      capabilitiesJson: ["text", "structured_output", "vision", "embeddings"],
    },
  });
  await prisma.aISettings.create({
    data: {
      id: "default",
      enabled: false,
      defaultProviderId: manualProvider.id,
      externalDataPolicy: "explicit_context",
      attachmentsEnabled: false,
    },
  });

  await prisma.referenceConnector.createMany({
    data: [
      {
        provider: "zotero",
        displayName: "Zotero local library",
        libraryScope: "Personal methods and protocol references",
        baseUrl: "http://127.0.0.1:23119",
        enabled: false,
        notes: "Connector placeholder only; LabNest should link citations without embedding the full literature manager.",
      },
      {
        provider: "endnote",
        displayName: "EndNote RIS import",
        libraryScope: "Collaborator-shared reference exports",
        enabled: false,
        notes: "Import/export adapter placeholder for future reference links.",
      },
    ],
  });

  await prisma.activityLog.createMany({
    data: [
      {
        action: "seed_project",
        targetType: "project",
        targetId: project.id,
        metadataJson: { note: "Created demo project and core records." },
      },
      {
        action: "create_protocol_run",
        targetType: "protocol_run",
        targetId: run.id,
        metadataJson: { experiment_id: experiment.id },
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
