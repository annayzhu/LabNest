import { createRoot } from "react-dom/client";

import { CnvPlanner } from "@cnv-planner-entry";
import "@cnv-planner-style";

const root = document.getElementById("root");

if (!root) {
  throw new Error("CNV Plate Planner mount element was not found.");
}

createRoot(root).render(<CnvPlanner />);
