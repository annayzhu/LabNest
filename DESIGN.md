---
name: LabNest
description: A restrained scientific editorial workspace for trustworthy laboratory operations.
colors:
  paper: "#f5f7f4"
  warm: "#fafbf8"
  stone: "#eef1ec"
  surface: "#ffffff"
  ink: "#202825"
  graphite: "#4d5955"
  muted: "#6f7a76"
  disabled: "#a5ada9"
  primary: "#3f625d"
  primary-hover: "#34534f"
  primary-surface: "#eaf1ef"
  primary-surface-hover: "#e1ebe8"
  primary-border: "#cadbd6"
  info: "#526d73"
  info-surface: "#eaf1f2"
  success: "#526f60"
  success-surface: "#e8f1ec"
  warning: "#805b24"
  warning-surface: "#faf0dc"
  error: "#8f4e52"
  error-surface: "#f7e7e7"
  hairline: "#dfe5e1"
  border-strong: "#c8d2cd"
typography:
  display:
    fontFamily: "Source Serif 4, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.25
  title:
    fontFamily: "Source Serif 4, Iowan Old Style, Palatino Linotype, Georgia, serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: "Source Sans 3, IBM Plex Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Source Sans 3, IBM Plex Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
  caption:
    fontFamily: "Source Sans 3, IBM Plex Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
  micro:
    fontFamily: "IBM Plex Mono, JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.4
  data:
    fontFamily: "IBM Plex Mono, JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  control-sm: "4px"
  control-md: "5px"
  control-lg: "6px"
  panel-inner: "6px"
  panel: "8px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control-lg}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control-lg}"
    padding: "0 12px"
    height: "36px"
  input:
    backgroundColor: "{colors.warm}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control-lg}"
    padding: "0 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
---

# Design System: LabNest

## Overview

**Creative North Star: "The Scientific Workbench"**

LabNest is a calm, precise operating surface for laboratory work. Its moon-white canvas, ink-dark typography, restrained dai-cyan actions, white instrument-like panels, editorial serif headings, and compact data typography make dense scientific tasks legible without making them feel administrative or clinical.

Calculator extends this world with a deliberate sequence: discover a narrowly named tool, enter values with visible units, calculate, inspect the result and method, then explicitly save or send it onward. Visual emphasis follows scientific responsibility rather than novelty.

**Key Characteristics:**

- Moon-white and blue-green neutrals with one restrained dai-cyan action color and low-dose cinnabar semantics.
- Flat, bordered panels and compact controls optimized for repeated work.
- Editorial headings paired with utilitarian UI copy and monospaced measurements.
- State changes expressed through color, text, icons, and explicit confirmation.

## Colors

The palette is quiet and cool; white and near-white surfaces carry most of the interface, while the primary color is reserved for actions, active states, and trusted emphasis.

### Primary

- **Dai Cyan:** Use the primary family for the main action, active selections, links, and focused control borders. The lighter surfaces support selected chips and low-intensity hover states.

### Secondary

- **Instrument Blue-Gray:** Use the info pair for plate context, method-adjacent notices, and other neutral scientific guidance.

### Neutral

- **Lab Paper:** Use paper as the page canvas, surface for cards, and warm or stone for subtle input, table-header, hover, and nested-panel separation.
- **Ink Stack:** Use ink for titles and results, graphite for working copy, muted for metadata, and disabled only for unavailable controls.
- **Hairline Structure:** Hairline is the default divider and card border; border-strong is reserved for hover or stronger separation.

### Named Rules

**The One-Action Rule.** A panel has one visually filled primary action; secondary actions remain bordered, quiet, or textual.

**The Semantic Pair Rule.** Success, warning, error, and info foregrounds always travel with their matching pale surface and a textual or iconic cue.

### Selectable system styles

Settings exposes four browser-local system styles. Each style remaps the same semantic roles rather than changing component behavior: 月白黛青 is the restrained default; 法蓝赪霞 is the brighter cyan-coral option; 青瓷松石 is a soft green work surface; 藕荷砚墨 is a warmer editorial option. Theme selection applies immediately, persists in the current browser, and never changes scientific chart palettes or exported figure colors.

Traditional motifs are a small identity layer, not a replacement for functional iconography. The LabNest brand mark uses an authored 回纹-style geometry; theme previews may use 回纹、祥云、莲瓣 or linked-diamond motifs in one consistent monoline SVG grammar. Navigation, saving, deleting, search, status, and scientific actions retain familiar Lucide icons so cultural character never weakens operational clarity.

## Typography

Typography is user-configurable by role from Settings. Interface text, document body copy, and headings remain separate roles so a researcher can lighten Chinese body text without weakening navigation or data scanning. The defaults are Source Han Sans SC for interface text and Source Han Serif SC for document body and headings, with system-safe Chinese fallbacks. Imported WOFF2, TTF, and OTF fonts remain browser-local; the fixed monospace data role is never changed by typography preferences.

**Display Font:** The selected heading role, defaulting to Source Han Serif SC with Chinese serif fallbacks
**Body Font:** The selected interface role for product UI and the selected document-body role for A4 reading, defaulting to Source Han Sans SC and Source Han Serif SC respectively
**Label/Mono Font:** IBM Plex Mono with technical monospace fallbacks

**Character:** Serif type marks page and tool identity; sans-serif carries interaction and explanation; monospace is reserved for values, units, method versions, timestamps, and other exact data.

### Hierarchy

- **Display:** Medium-weight serif for calculator names and page-level identity; it steps from a compact mobile size to the desktop display token.
- **Title:** Medium-weight serif for the catalog introduction; card headings use a compact semibold sans-serif style.
- **Body:** Regular sans-serif for descriptions and instructions, normally at the body token or the smaller label scale.
- **Label:** Medium sans-serif for fields, controls, and section-level microcopy.
- **Data:** Monospace for numeric results and provenance metadata; units may be smaller but remain adjacent to their values.
- **Working page title:** Repeated operational pages use the 20px title token at every viewport; reserve the 24px display token for true module identity or editorial reading surfaces.

### Named Rules

**The Data Is Data Rule.** Do not use monospace decoratively; use it only where fixed-width scanning improves scientific interpretation or provenance.

**The Active Label Rule.** Selected navigation items, document tabs, filters, and palette choices emphasize the label in the current theme action color, with only a low-dose tint or a thin underline behind it. Do not rely on a large rounded color block as the primary selected-state signal.

## Layout

The application shell constrains content to a wide working canvas with 16–20px page padding. Calculator uses a 16px panel gap and collapses naturally to a single column: field pairs begin stacking on small screens, catalog shortcuts split at large screens, and the input/result workbench becomes asymmetric only at extra-wide widths. Primary submit actions become full-width on mobile.

Cards own local grouping. Within a card, use a compact header separated by a hairline and a 16px body inset; use 12px gaps inside forms and 16px between major task regions. Preserve `min-width: 0`, truncation, wrapping, and scroll containers for bilingual labels, long methods, tables, and data values.

Document creation and editing keeps the A4 paper at its true screen measure instead of stretching it to fill the application. On desktop, the otherwise-unused left margin carries a lightweight sticky outline; selecting a table, image, timer, callout, result template, or embedded tool reveals a contextual settings rail in the right margin. Metadata and relevant items remain explicit tabs rather than permanent sidebars. The screen view offers 100%, 110%, and fit-width modes, defaults to 100%, and resets to true size for printing. Both side rails are absent from print and hidden below desktop width so mobile preserves a single content-first reading order.

**The Task-Order Rule.** Responsive collapse must preserve input → validation → result → method → reuse/history order; do not rearrange for visual symmetry.

## Elevation & Depth

Calculator is flat by default. Hierarchy comes from white surfaces, hairline borders, pale tonal fills, and sticky table headers—not decorative shadows. The global soft and paper shadows are available only for genuinely floating or sticky layers elsewhere in LabNest.

**The Flat-Workbench Rule.** Static task panels remain border-defined at rest; elevation indicates overlay, stickiness, or interaction, never mere importance.

## Shapes

The shape language is gently technical: 12px outer panels, 8px inputs and primary controls, 6–7px compact actions, and occasional 9–10px feature wells. Full pills are limited to tags, presets, and small categorical states. Borders are one-pixel hairlines; dashed borders indicate upload or empty drop zones.

## Components

### Buttons

- **Primary:** Filled primary color, high-contrast label, 36–40px height, and 8px corners. Use for Calculate, Confirm, Detect, or Send.
- **Secondary:** White or transparent with a hairline or primary border; use for Save, Pin, Reset, Back, and other reversible actions.
- **States:** Hover shifts either the fill or pale surface; active controls may move by one pixel. Disabled controls retain their label and reduce opacity. Every keyboard-operable button uses the shared visible focus treatment.

### Chips

- **Style:** Pale primary or info surfaces with compact 10–12px labels. Pills identify presets or plate-aware status; segmented modes use 7px rounded rectangles. Free Plate uses one calculation card and one drawer: established liquid modules appear first, followed by only the non-duplicative plate-aware additions.
- **State:** Selection changes both surface and text color. Do not rely on color alone when the action changes scientific meaning.

### Cards / Containers

- **Corner Style:** Gently rounded outer panel with tighter inner wells.
- **Background:** White at the panel level; near-white fills separate inputs, upload zones, result summaries, and table headers.
- **Shadow Strategy:** None for static Calculator cards.
- **Border:** Hairline outer border and lighter internal dividers.
- **Internal Padding:** 16px by default, with 12px for compact shortcut groups.

### Inputs / Fields

- **Style:** 40px controls, 8px corners, hairline border, near-white fill, explicit label, and unit aligned opposite the label.
- **Focus:** Border changes to the primary color; standalone controls also use the shared focus outline and halo.
- **Error / Disabled:** Errors use the semantic error pair and `role="alert"`; disabled actions remain visible with reduced opacity.

### Navigation

Back, catalog, favorites, and history links remain compact and understated. Icon-only actions require an accessible name; current context is shown with label text or selected-state styling rather than icon color alone.

### Result & Method Panels

Results pair muted labels with right-aligned monospaced values and adjacent units. Warnings sit immediately below outputs. Method text and its version remain visible in a neighboring or following card, and saving is always an explicit user action.

### Image-Assisted Counting

The upload canvas is a large dashed work area with visible detection overlays. Automatic and reviewed counts are visually separated, and confirmation is required before persistence; the image itself is never represented as saved state.

## Do's and Don'ts

### Do:

- **Do** reuse the global color, typography, control, and panel tokens before adding a surface-specific value.
- **Do** keep units, method version, warnings, and persistence state visible near the result they qualify.
- **Do** preserve semantic labels, `role="alert"`, keyboard focus, touch-friendly primary controls, and bilingual wrapping at 390px.
- **Do** use explicit confirmation for reviewed or persisted scientific outputs.

### Don't:

- **Don't** import a dark laboratory dashboard aesthetic, saturated green skin, heavy gradients, or decorative scientific imagery into the workspace.
- **Don't** use shadows on every card, multiple filled actions in one panel, or color as the only status signal.
- **Don't** detach a unit from its field or value, hide the method behind an interaction, or imply an automated count is ground truth.
- **Don't** introduce arbitrary radii, spacing, or one-off colors when an existing LabNest token covers the role.
