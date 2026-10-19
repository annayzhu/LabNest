import sharp from "sharp";
import { fileURLToPath } from "node:url";

// Export the existing vector logo; keep a full square so each OS applies its own mask.
const source = new URL("../native/Branding/labnest-app-icon.svg", import.meta.url);
const output = new URL("../native/SharedAssets.xcassets/AppIcon.appiconset/LabNest-1024.png", import.meta.url);
await sharp(fileURLToPath(source))
  .resize(1024, 1024)
  .removeAlpha()
  .toColourspace("srgb")
  .png()
  .toFile(fileURLToPath(output));
console.log(fileURLToPath(output));
