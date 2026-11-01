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
  ai: "#a5441b"
  ai-fg: "#ffffff"
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
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
  document:
    fontFamily: "Times New Roman, Source Han Serif SC, Songti SC, serif"
    fontSize: "10pt"
    fontWeight: 400
    lineHeight: 1.6
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
  button-ai:
    backgroundColor: "{colors.ai}"
    textColor: "{colors.ai-fg}"
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

LabNest is a calm, precise operating surface for laboratory work. Its moon-white canvas, ink-dark typography, restrained dai-cyan actions, white instrument-like panels, system-sans headings with a serif A4 record, and compact data typography make dense scientific tasks legible without making them feel administrative or clinical.

Calculator extends this world with a deliberate sequence: discover a narrowly named tool, enter values with visible units, calculate, inspect the result and method, then explicitly save or send it onward. Visual emphasis follows scientific responsibility rather than novelty.

**Key Characteristics:**

- Moon-white and blue-green neutrals with a restrained dai-cyan accent for actions and the style's second color for AI; color otherwise only carries status.
- Flat, bordered panels and compact controls optimized for repeated work.
- Editorial headings paired with utilitarian UI copy and monospaced measurements.
- State changes expressed through color, text, icons, and explicit confirmation.

## Colors

The palette is quiet and cool; white and near-white surfaces carry most of the interface, while the primary color is reserved for actions, active states, and trusted emphasis.

### Primary

- **Dai Cyan:** Use the primary family for the main action, active selections, links, and focused control borders. The lighter surfaces support selected chips and low-intensity hover states.

### AI

- **Second color:** Each system style pairs its accent with a second color, the third swatch in the style picker (韎韐 red in 月白黛青, coral in 法蓝赪霞, gold in 靛青缃绮). It marks AI and nothing else: buttons that hand work to a model are filled with it and carry the Sparkles icon, a small filled "AI" tag marks text a model wrote, and the 启用 AI switch takes it when on. Its label color `--ai-fg` is contrast-tested on the fill and on the hover fill in every style and mode; the hover moves away from the label color rather than always darkening. Never use it as text or icon color on a light surface: in the coral, gold and yellow styles it is too light to read.
- **AI not ready:** While the switch is off or the default service is incomplete, every AI action turns gray (stone fill, muted label, gray icon) but stays focusable; pressing it opens the AI 助手 setup guide and never sends anything. Entries into tools that also work without AI (整理说明书或非模板规程, 按目标设计) turn gray the same way but still open. One server read per page seeds this state, so buttons never flash between colors.

### Secondary

- **Instrument Blue-Gray:** Use the info pair for plate context, method-adjacent notices, and other neutral scientific guidance.

### Neutral

- **Lab Paper:** Use paper as the page canvas, surface for cards, and warm or stone for subtle input and hover fills. Table headers carry no fill.
- **Ink Stack:** Use ink for titles and results, graphite for working copy, muted for metadata, and disabled only for unavailable controls.
- **Hairline Structure:** Hairline is the default divider and card border; border-strong is reserved for hover or stronger separation.

### Named Rules

**The One-Action Rule.** A panel has one visually filled primary action; an AI action may sit beside it filled with the second color, because it is a different path rather than a competing emphasis; other secondary actions remain bordered, quiet, or textual.

**The Two-Color Rule.** Each system theme has exactly two colors: its dai-cyan (moss/action) family and its second color for AI. Decisive actions are filled with the accent, links, tabs, selection, and focus use it quietly, AI actions and AI-written text are marked with the second color, and nothing else is colored except semantic status. Destructive actions keep the semantic error family and live in the page's More menu.

**The Quiet Status Rule.** Settled states (completed, active, pass, valid, reviewed, running, archived) read as plain muted text. Only states that ask for attention (draft, planned, submitted, warning, failed) keep a tinted pill, so a table row carries at most one pill.

**The Semantic Pair Rule.** Success, warning, error, and info foregrounds always travel with their matching pale surface and a textual or iconic cue.

### Selectable system styles

Settings also offers Light, Dark, and System modes. Dark mode remaps the same semantic roles per style (each style has its own dark accent and selection pair); A4 document paper, print, exported figures, and chart palettes always stay light. It is an appearance preference, not the dark dashboard aesthetic ruled out below.

Settings exposes four browser-local system styles. Each style remaps the same semantic roles rather than changing component behavior: 月白黛青 is the restrained default; 法蓝赪霞 is the brighter cyan-coral option; 青瓷松石 is a soft green work surface; 藕荷砚墨 is a warmer editorial option. Theme selection applies immediately, persists in the current browser, and never changes scientific chart palettes or exported figure colors.

Traditional motifs are a small identity layer, not a replacement for functional iconography. The LabNest brand mark uses an authored 回纹-style geometry; theme previews may use 回纹、祥云、莲瓣 or linked-diamond motifs in one consistent monoline SVG grammar. Navigation, saving, deleting, search, status, and scientific actions retain familiar Lucide icons so cultural character never weakens operational clarity.

## Typography

Typography is user-configurable by role from Settings. Interface text, document body copy, and headings remain separate roles. The interface defaults to the device's system fonts (SF Pro + PingFang on macOS, Segoe UI + Microsoft YaHei on Windows) at weight 400. The A4 record defaults to Times New Roman with Source Han Serif/Songti, the convention of Chinese research writing and of the Word exports. Imported WOFF2, TTF, and OTF fonts remain browser-local; the fixed monospace data role is never changed by typography preferences.

**Display Font:** System sans at 600 for page and card titles
**Body Font:** System sans for product UI; the document-body role for A4 reading
**Label/Mono Font:** IBM Plex Mono with technical monospace fallbacks

**Character:** The workspace is sans throughout; serif belongs to the record, so `font-serif` resolves to the document heading font only inside the A4 paper. Dates, times and quantities use the interface font with even-width figures (`tabular-nums`). Monospace is reserved for codes people copy or match character by character (catalogue numbers, barcodes, CAS, lot and container codes) and for sequences.

**Label case.** Interface labels and section titles use normal case; uppercase with letter-spacing is reserved for the A4 record's own typography (kickers, facts, captions) and calendar weekday initials. A section never carries a small label above a heading that says the same thing.

**Type scale.** Interface text uses six sizes only: 12, 13, 14, 16, 20, 24px. Nothing in the chrome is smaller than 12px; hierarchy below that comes from weight and color, not smaller type.

### Hierarchy

- **Display:** Medium-weight serif for calculator names and page-level identity; it steps from a compact mobile size to the desktop display token.
- **Title:** Medium-weight serif for the catalog introduction; card headings use a compact semibold sans-serif style.
- **Body:** Regular sans-serif for descriptions and instructions, normally at the body token or the smaller label scale.
- **Label:** Medium sans-serif for fields, controls, and section-level microcopy.
- **Data:** Even-width figures in the interface font for quantities, dates and times; units stay adjacent to their values.
- **Working page title:** 20px semibold (`--ln-page-title-size`, compact scale); section and card titles are 14px semibold (`--ln-ui-section-title-font-size`), two steps below it.

### Interface size

Settings exposes Compact, Standard, and Comfortable interface scales. Compact is the default working density. Each choice remaps the shared `--ln-*` hierarchy for navigation, global search, local search, table text, labels, controls, and operational titles; feature pages must not hard-code a competing scale. Global search remains one step more prominent than in-page search, navigation remains more prominent than table rows, and labels remain quieter than the values they describe. Interface scaling never changes A4 document typography, physical page dimensions, exports, or print output.

### Named Rules

**The Data Is Data Rule.** Do not use monospace decoratively; use it only for codes and sequences, where comparing character by character matters. Numbers line up through tabular figures, not a code font.

**The Active Label Rule.** Selected navigation items, document tabs, filters, and palette choices emphasize the label in the primary (moss) family, with only a low-dose tint or a thin underline or leading bar behind it. Do not rely on a large rounded color block as the primary selected-state signal.

## Layout

The application shell constrains content to a wide working canvas with 16–20px page padding. Calculator uses a 16px panel gap and collapses naturally to a single column: field pairs begin stacking on small screens, catalog shortcuts split at large screens, and the input/result workbench becomes asymmetric only at extra-wide widths. Primary submit actions become full-width on mobile.

Cards own local grouping. Within a card, use a compact header separated by a hairline and a 16px body inset; use 12px gaps inside forms and 16px between major task regions. Preserve `min-width: 0`, truncation, wrapping, and scroll containers for bilingual labels, long methods, tables, and data values.

Document creation and editing keeps the A4 paper at its true screen measure by default. Every Protocol, Experiment, Result, Research Plan, Entry, and Report editor uses the same Document and Metadata navigation; modules with managed relations add Relevant items. The document title is always editable in place, while Metadata provides the complete record controls. On desktop, the otherwise-unused left margin carries a lightweight sticky outline. Selecting a table, image, timer, callout, result template, or embedded tool opens a contextual drawer over the right edge; experiment and record information use the same animated overlay pattern. Drawers never participate in canvas sizing, so opening one cannot resize or reflow the paper. The active document toolbar stays directly below the navigation, beneath the global search bar. Save and other state-changing actions remain available without creating a detached card hierarchy. Metadata and related-record panels share the A4 width and leading edge, use hairlines rather than nested cards, and remain left-aligned. The screen view offers a user-defined 80–160% zoom and a stable fit-width mode; Fit is calculated only from the unscaled document viewport and fills its available width without observer feedback or horizontal overflow. Paragraph line spacing is stored on the paragraph box so every value, including values below the 1.6 default, changes the visible layout and survives serialization. Printing always resets to true size. Drawers and the outline are absent from print, while mobile preserves a single content-first reading order with overlay information on demand.

**The Task-Order Rule.** Responsive collapse must preserve input → validation → result → method → reuse/history order; do not rearrange for visual symmetry.

## Elevation & Depth

Calculator is flat by default. Hierarchy comes from white surfaces, hairline borders, pale tonal fills, and sticky table headers—not decorative shadows. The global soft and paper shadows are available only for genuinely floating or sticky layers elsewhere in LabNest.

**The Flat-Workbench Rule.** Static task panels remain border-defined at rest; elevation indicates overlay, stickiness, or interaction, never mere importance.

## Shapes

The shape language is gently technical: 8px outer panels, 6px inputs and primary controls, and 4–5px compact actions. Full pills are limited to tags, presets, and small categorical states. Borders are one-pixel hairlines; dashed borders indicate upload or empty drop zones.

## Components

### Buttons

- **Primary:** Filled primary color, high-contrast label, 36–40px height, and 6px corners. Use for Calculate, Confirm, Detect, or Send.
- **AI:** Filled with the second color, its tested label color, and the Sparkles icon. Use only for actions that send work to a model (用 AI 整理, 归纳为方法卡, Propose with AI) and for entries into AI tools (整理说明书或非模板规程, 按目标设计, Manual AI). Settings diagnostics such as a connection test stay secondary.
- **Secondary:** White or transparent with a hairline or primary border; use for Save, Pin, Reset, Back, and other reversible actions.
- **States:** Hover shifts either the fill or pale surface; active controls may move by one pixel. Disabled controls retain their label and reduce opacity. Every keyboard-operable button uses the shared visible focus treatment.
- **Motion:** Decisive buttons change fill on hover and show a bottom progress tracer only while a real action is pending. Dropdown icons use a short, directional micro-motion. Tool cards may expand into a focused preview modal; routine content never animates merely for decoration. All spatial motion is removed by `prefers-reduced-motion`.
- **Shared motion grammar:** Dialogs use one 340ms card-and-backdrop entrance; selection surfaces use a 220ms trigger-connected reveal; disclosures use a 240ms spring response; and the sidebar icon crossfades while the rail changes width. These patterns preserve focus, document flow, and reduced-motion preferences.

### AI 助手

A sparkle button in the top bar, filled with the second color when AI is ready and gray otherwise, opens the AI 助手: a floating card under the top bar, like a popover. It never dims or blocks the page, and closes on Escape, its close button, or a press outside. From top to bottom it shows a pill title with a gear to AI 设置, a greeting that says whether AI is ready and which service answers, the quick entries whose AI suggestions wait for 采纳 or 忽略 (the trigger carries their count; each row opens the entry at its suggestions), a setup card in the concierge style while AI is not ready (three steps with what is still missing, and one filled 去 AI 设置 action), a list of the places that use AI with the current page first, and a footer reminding that AI output needs checking and that text is sent only when an AI button is pressed. There is no chat box: LabNest has no general assistant.

### Chips

- **Style:** Pale primary or info surfaces with compact 10–12px labels. Pills identify presets or plate-aware status; segmented modes use 7px rounded rectangles. Free Plate uses one calculation card and one drawer: established liquid modules appear first, followed by only the non-duplicative plate-aware additions.
- **State:** Selection changes both surface and text color. Do not rely on color alone when the action changes scientific meaning.

### Cards / Containers

- **One level:** A page has one level of bordered containers. Inside a panel, rows are divided by hairlines, never by another bordered box; a table inside a panel reaches its border. Summary rows of stat tiles are not used: a detail page states its few key facts in one line under the title, and attention gets its own line only when something needs it.
- **Corner Style:** Gently rounded outer panel with tighter inner wells.
- **Background:** White at the panel level; near-white fills separate inputs, upload zones and result summaries.
- **Shadow Strategy:** None for static Calculator cards.
- **Border:** Hairline outer border and lighter internal dividers.
- **Internal Padding:** 16px by default, with 12px for compact shortcut groups.

### Inputs / Fields

- **Style:** 40px controls, 6px corners, hairline border, near-white fill, explicit label, and unit aligned opposite the label.
- **Focus:** Border changes to the primary color; standalone controls also use the shared focus outline and halo.
- **Error / Disabled:** Errors use the semantic error pair and `role="alert"`; disabled actions remain visible with reduced opacity.

### Tables

`ui/DataTable.tsx` is the one table. Headers are 12px muted labels at weight 500 on no fill, with a hairline below; rows are divided by hairlines. A `numeric` column aligns right with even-width figures. A column given `empty` is left out when every row is empty, so a table never shows a column of dashes. Quantity changes read by their sign (+/−) in plain ink, never bold red and green; color in a table is for status that asks for attention.

### File Uploads

A file input is a quiet secondary button that names what was chosen (`ui/FilePicker.tsx`), never the browser's own "Choose File / No file chosen", which ignores the interface language. Inputs not yet moved to it get the same button look from a global `::file-selector-button` style.

### Few Questions per Panel

A form or properties panel opens on what it needs to save: one primary question (the purpose, the title, the project) and one primary action. Everything optional sits in a `Disclosure` (`ui/Disclosure.tsx`): one row with the group's title and its current value ("RP-003 · Draft"), open by default only when it already holds content. A required field inside a closed group opens it when the browser rejects the form. Consent is a sentence beside the action, not a checkbox; a field that already lives on the page (the title in the document header) is not repeated in the panel.

### Page Actions

A page header shows at most its primary action, Edit, and one More (⋯) menu. Print, copy, export, secondary links, and Delete/archive live in the menu as plain text rows, with the destructive row last and separated by a hairline.

### Collection Toolbars

List pages share one toolbar row: search (applies on Enter), a Filters disclosure whose badge counts active filters, and sort. Filters apply as soon as a value changes, so there is no Apply button; active filters show as chips beneath with Clear all. On the right sit the record count, one Import / Export menu, and the single primary New action.

### Side Panels

A detail page's right column is one surface with a hairline border; its sections are separated by single hairlines, never by gaps or nested cards, and section headers carry no divider of their own.

### Navigation

Back, catalog, favorites, and history links remain compact and understated. Icon-only actions require an accessible name; current context is shown with label text or selected-state styling rather than icon color alone.

The desktop Overview opens with a Today panel (active run beside today's plan) above the month calendar; quick actions and active plans sit in a narrow right panel. Quick actions are unboxed rows with line icons whose label reveals once per pointer hover rather than animating on page load. Offline status appears only when the browser reports a lost connection and offers a small keyboard-operable dinosaur diversion without blocking locally available work.

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
- **Do** treat submitted and reviewed Experiments and Entries as read-only: hide editing, disable Run controls, and route changes through the record-status control, where reopening requires a logged reason.

### Don't:

- **Don't** import a dark laboratory dashboard aesthetic, saturated green skin, heavy gradients, or decorative scientific imagery into the workspace.
- **Don't** use shadows on every card, multiple filled actions in one panel, or color as the only status signal.
- **Don't** detach a unit from its field or value, hide the method behind an interaction, or imply an automated count is ground truth.
- **Don't** introduce arbitrary radii, spacing, or one-off colors when an existing LabNest token covers the role.
