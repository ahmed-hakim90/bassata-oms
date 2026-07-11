# Meridian Design System

**Version:** 1.0.0  
**Status:** Production Source of Truth  
**Owner:** Design Systems & Frontend Architecture  
**Applies to:** ERP · POS · OMS · CRM · HR · Inventory · Manufacturing · E-commerce · SaaS · Dashboards · Admin Panels · Mobile-Responsive Web Apps  
**Last reviewed:** 2026-07-11  

---

## How to use this document

This file is the single source of truth for visual design, interaction design, accessibility, and UI engineering across every product surface. If a pull request introduces UI that contradicts this document, the PR is incomplete until aligned or until this document is updated intentionally with a version bump and changelog note.

**Rules of engagement**

1. Prefer tokens over hardcoded values. Never ship hex colors, raw pixel spacing, or ad-hoc type sizes in product UI.
2. Prefer existing components over new ones. Extend the library; do not fork patterns.
3. Prefer clarity over decoration. Motion, color, and density serve tasks—not portfolios.
4. Prefer accessibility by default. WCAG 2.2 AA is the floor; AAA is encouraged for critical financial and safety states.
5. Prefer RTL as a first-class layout mode, not a post-hoc mirror.
6. Prefer dark mode as a first-class theme, not an inverted afterthought.
7. Prefer keyboard-first workflows for enterprise operators who live in the product all day.
8. Prefer mobile-first structure with progressive enhancement to dense desktop layouts.
9. Prefer enterprise density that remains humane—never crush readability for “power user” aesthetics.
10. Prefer documentation updates in the same change that introduces a new pattern.

**Naming**

The design language is called **Meridian**. Component prefixes in code may use `mds` (Meridian Design System). CSS custom properties use `--mds-*`. Design tokens in TypeScript live under `tokens/mds` or the project’s established token module—never scatter magic numbers.

---

# 1. Design Philosophy

## 1.1 Vision

Meridian exists so operators can move through complex operational work with calm certainty. Our products manage money, inventory, people, production, and customer trust. The interface must feel like a precise instrument: quiet when things are fine, unmistakable when attention is required, and never theatrical.

We design for the person who opens the same screen two hundred times a week. Novelty is expensive. Consistency is kindness. Speed without clarity is negligence. Clarity without speed is friction. Meridian balances both.

**North star:** Every screen should answer three questions in under three seconds:

1. Where am I?
2. What needs my attention?
3. What is the next correct action?

## 1.2 Principles

### Clarity over cleverness
If a pattern requires explanation, it is unfinished. Labels beat icons alone. Explicit states beat inferred states. One primary action beats five equal buttons.

### Consistency over novelty
Operators learn once. Buttons, tables, filters, modals, and forms behave the same in POS, ERP, CRM, and HR. New patterns require a design-system review.

### Density with dignity
Enterprise software needs information density. Density must never destroy scanability, touch targets, or contrast. Compact is allowed; cramped is forbidden.

### Progressive disclosure
Show what is needed now. Hide advanced controls behind clear entry points. Wizards, drawers, and expandable rows exist to reduce cognitive load—not to bury critical actions.

### Trust through honesty
Never fake data, never hide errors, never animate away failure. Empty, loading, error, and permission-denied states are first-class UI.

### Accessibility is non-negotiable
Keyboard, screen reader, contrast, reduced motion, and touch targets are part of Definition of Done—not a later pass.

### RTL and bilingual by design
Arabic and English are both first-class. Layout, typography, numerals, and icons are designed for `dir="rtl"` and `dir="ltr"` without bolted-on exceptions.

### Performance is UX
Slow paint, layout shift, and janky tables destroy trust as surely as bad copy. Performance budgets are product requirements.

### Tokens are law
Visual decisions live in tokens. Components consume tokens. Themes remap tokens. Product screens never invent local color systems.

### Composition over configuration explosion
Prefer small composable primitives with clear contracts over mega-components with twenty boolean props.

## 1.3 User Experience Philosophy

Meridian UX is task-shaped. We design jobs-to-be-done, not screens-for-screens’-sake.

**Operator empathy**

- Cashiers need large targets, short paths, and forgiveness for mis-taps.
- Managers need overview, exception handling, and auditability.
- Accountants need precision, exportability, and immutable trail clarity.
- Warehouse staff need scan-friendly flows, offline resilience, and unambiguous quantities.
- Admins need predictable settings architecture and permission clarity.

**Interaction contract**

- Primary actions are obvious and singular per region.
- Destructive actions require confirmation and are visually distinct.
- Forms preserve input on soft failures.
- Search and filters are sticky and shareable via URL where appropriate.
- Success feedback is calm; errors are specific and recoverable.

**Cognitive load budget**

Each view should have one job. Secondary jobs are reachable without competing for the same visual weight. Dashboards summarize; detail pages decide; wizards sequence.

## 1.4 Visual Language

Meridian’s visual language is **calm precision**.

- Surfaces are quiet: soft neutrals, restrained borders, elevation used sparingly.
- Color is semantic first, decorative never.
- Typography carries hierarchy more than boxes do.
- Radius is approachable but not playful; corners communicate modernity without consumer-app cuteness.
- Shadows express elevation, not drama.
- Charts and tables prefer data ink over chrome.
- Icons are outline-first, geometrically consistent, optically balanced.

**Material metaphor**

Think of the UI as stacked operational surfaces on a stable canvas:

- Canvas = application background
- Surface = cards, panels, table shells
- Overlay = modals, drawers, popovers
- Focus ring = the one non-negotiable accent of attention

Avoid skeuomorphism, neon glow, glassmorphism as default, and purple-gradient “AI default” aesthetics.

## 1.5 Product Thinking

Before shipping UI, answer:

1. Why does this surface exist?
2. Who uses it under what time pressure?
3. What is the costly mistake we must prevent?
4. What happens when data is empty, late, or wrong?
5. Can we remove a field, click, or decision?

Product thinking in Meridian means deleting until the remaining structure is inevitable.

## 1.6 Enterprise UX Principles

1. **Auditability:** Critical actions leave a trail the UI can explain.
2. **Role awareness:** UI respects permissions; denied states are explicit.
3. **Bulk competence:** Selection, bulk edit, import/export are first-class.
4. **Exception-first:** Surfaces highlight what is wrong or overdue before vanity KPIs.
5. **Keyboard velocity:** Power users never need the mouse for core loops.
6. **Multi-entity clarity:** Org, store, warehouse, and period context are always visible when relevant.
7. **Financial honesty:** Money formatting, rounding, and currency context are consistent and explicit.
8. **Operational forgiveness:** Undo, draft, and confirm patterns protect against irreversible mistakes.
9. **Cross-surface continuity:** POS receipt language matches order detail language matches report language.
10. **Long-session comfort:** Contrast, spacing, and motion respect eight-hour operator days.

---

# 2. Brand Foundation

## 2.1 Brand Personality

Meridian is:

- **Reliable** — never flashy for its own sake
- **Precise** — numbers, labels, and states are exact
- **Calm** — urgency is reserved for true urgency
- **Human** — operational Arabic/English copy feels spoken by a competent colleague
- **Modern** — clean geometry, contemporary type, no legacy ERP gloom
- **Authoritative** — confident hierarchy without arrogance

Meridian is not playful, not startup-chaotic, not luxury-fashion, not neon cyberpunk, not academic-dense.

## 2.2 Voice

Write like a senior operator explaining the next step.

- Active voice
- Concrete verbs
- Short sentences for errors and toasts
- Domain words users already know (order, session, transfer, invoice)
- No marketing fluff inside product UI

**Examples**

- Good: “Session closed. Cash difference recorded.”
- Bad: “Awesome! You’re all set on your journey.”
- Good: “Cannot approve: stock count still open.”
- Bad: “Oopsie! Something went wrong.”

## 2.3 Tone

Tone shifts by severity, not by whimsy.

| Context | Tone |
|---|---|
| Default UI | Neutral, clear, respectful |
| Success | Brief confirmation |
| Warning | Direct, non-alarmist |
| Error | Specific, actionable, non-blaming |
| Destructive confirm | Serious, consequence-aware |
| Empty state | Helpful, forward-moving |
| Permissions denied | Respectful, no fake emptiness |

## 2.4 Emotional Design

Emotion in enterprise software is mostly relief and confidence.

- Reduce anxiety before irreversible actions with previews and summaries.
- Celebrate completion lightly (toast, check icon)—never confetti for payroll or inventory adjustments.
- Use color sparingly so red still means stop.
- Prefer progress clarity over cheerful distraction during long jobs.

## 2.5 Trust

Trust signals:

- Consistent placement of money, status, and identity
- Accurate timestamps and actor names on audits
- No placeholder KPIs in production
- Secure patterns for PIN, password, and device pairing
- Honest offline/sync states

Trust anti-signals:

- Silent failures
- Optimistic UI that lies
- Decorative charts with no underlying data
- Ambiguous destructive buttons

## 2.6 Professional Appearance

Professional does not mean gray-on-gray boredom. It means:

- Tight typographic hierarchy
- Aligned columns
- Predictable spacing rhythm
- Restrained accent color
- High-quality empty illustrations only when they clarify
- Print/receipt surfaces that look intentional, not like afterthoughts

---

# 3. Design Tokens

Tokens are the atomic API of Meridian. Components may not invent visual values outside tokens except for one-off data visualizations that still map into semantic chart tokens.

## 3.1 Token architecture

Layers:

1. **Primitive tokens** — raw values (`blue-600`, `space-16`, `font-size-14`)
2. **Semantic tokens** — purpose (`color-action-primary`, `text-danger`, `surface-elevated`)
3. **Component tokens** — optional mappings (`button-primary-bg`) that reference semantic tokens only

Themes (light, dark, high-contrast) remap semantic tokens. Products never remap primitives ad hoc in screens.

## 3.2 Color Tokens (primitives)

### Neutrals (Ink scale)

| Token | Light value | Usage |
|---|---|---|
| `mds.color.ink.0` | `#FFFFFF` | Absolute white |
| `mds.color.ink.25` | `#F8FAFC` | Subtle wash |
| `mds.color.ink.50` | `#F1F5F9` | Canvas tint |
| `mds.color.ink.100` | `#E2E8F0` | Borders soft |
| `mds.color.ink.200` | `#CBD5E1` | Borders default |
| `mds.color.ink.300` | `#94A3B8` | Disabled icons |
| `mds.color.ink.400` | `#64748B` | Muted text |
| `mds.color.ink.500` | `#475569` | Secondary text |
| `mds.color.ink.600` | `#334155` | Body emphasis |
| `mds.color.ink.700` | `#1E293B` | Primary text |
| `mds.color.ink.800` | `#0F172A` | Headings |
| `mds.color.ink.900` | `#020617` | Maximum contrast text |
| `mds.color.ink.950` | `#01040A` | Dark canvas deep |

### Brand / Harbor (primary family)

Meridian primary is a deep harbor teal-blue—distinct from Material blue and from purple-indigo defaults.

| Token | Value | Notes |
|---|---|---|
| `mds.color.harbor.50` | `#ECFEFF` | Selected wash |
| `mds.color.harbor.100` | `#CFFAFE` | Soft chip bg |
| `mds.color.harbor.200` | `#A5F3FC` | Focus glow soft |
| `mds.color.harbor.300` | `#67E8F9` | Charts secondary |
| `mds.color.harbor.400` | `#22D3EE` | Dark mode accents |
| `mds.color.harbor.500` | `#06B6D4` | Bright accent sparingly |
| `mds.color.harbor.600` | `#0E7490` | Primary interactive (light) |
| `mds.color.harbor.700` | `#0F5F75` | Primary hover |
| `mds.color.harbor.800` | `#155E75` | Primary pressed |
| `mds.color.harbor.900` | `#164E63` | Primary text on light wash |
| `mds.color.harbor.950` | `#083344` | Dark brand surface |

### Signal Amber (attention, not error)

| Token | Value |
|---|---|
| `mds.color.amber.50` | `#FFFBEB` |
| `mds.color.amber.100` | `#FEF3C7` |
| `mds.color.amber.500` | `#F59E0B` |
| `mds.color.amber.600` | `#D97706` |
| `mds.color.amber.700` | `#B45309` |

### Success / Danger / Info primitives

| Token | Value |
|---|---|
| `mds.color.green.50` | `#F0FDF4` |
| `mds.color.green.500` | `#22C55E` |
| `mds.color.green.600` | `#16A34A` |
| `mds.color.green.700` | `#15803D` |
| `mds.color.red.50` | `#FEF2F2` |
| `mds.color.red.500` | `#EF4444` |
| `mds.color.red.600` | `#DC2626` |
| `mds.color.red.700` | `#B91C1C` |
| `mds.color.blue.50` | `#EFF6FF` |
| `mds.color.blue.500` | `#3B82F6` |
| `mds.color.blue.600` | `#2563EB` |
| `mds.color.blue.700` | `#1D4ED8` |

## 3.3 Semantic Colors

| Semantic token | Light maps to | Purpose |
|---|---|---|
| `color.bg.canvas` | `ink.50` | App background |
| `color.bg.surface` | `ink.0` | Cards/panels |
| `color.bg.surface-muted` | `ink.25` | Nested regions |
| `color.bg.overlay` | `ink.900` @ 48% | Modal scrim |
| `color.border.default` | `ink.200` | Default borders |
| `color.border.strong` | `ink.300` | Emphasized dividers |
| `color.border.focus` | `harbor.600` | Focus rings |
| `color.text.primary` | `ink.800` | Body/headings |
| `color.text.secondary` | `ink.500` | Supporting |
| `color.text.muted` | `ink.400` | Meta |
| `color.text.inverse` | `ink.0` | On primary buttons |
| `color.text.disabled` | `ink.300` | Disabled |
| `color.action.primary` | `harbor.600` | Primary actions |
| `color.action.primary-hover` | `harbor.700` | Hover |
| `color.action.primary-pressed` | `harbor.800` | Active |
| `color.feedback.success` | `green.600` | Success |
| `color.feedback.warning` | `amber.600` | Warning |
| `color.feedback.danger` | `red.600` | Danger |
| `color.feedback.info` | `blue.600` | Info |
| `color.selection.bg` | `harbor.50` | Selected rows |
| `color.selection.border` | `harbor.600` | Selected outline |

Dark and high-contrast remaps are defined in §15 and §12.

## 3.4 Typography Tokens

| Token | Value | CSS |
|---|---|---|
| `font.family.sans` | Cairo, IBM Plex Sans Arabic, Inter, system-ui, sans-serif | UI + Arabic-first |
| `font.family.mono` | IBM Plex Mono, ui-monospace, monospace | Codes, IDs |
| `font.family.numeric` | inherit + `font-variant-numeric: tabular-nums` | Money, KPIs |
| `font.weight.regular` | 400 | Body |
| `font.weight.medium` | 500 | Labels, emphasis |
| `font.weight.semibold` | 600 | Headings, buttons |
| `font.weight.bold` | 700 | Rare display emphasis |
| `font.line.tight` | 1.25 | Headings |
| `font.line.snug` | 1.375 | Subheads |
| `font.line.normal` | 1.5 | Body |
| `font.line.relaxed` | 1.625 | Long reading |
| `font.tracking.tight` | -0.01em | Large headings |
| `font.tracking.normal` | 0 | Default |
| `font.tracking.wide` | 0.04em | Overlines / caps sparingly |

## 3.5 Font Scale

Modular scale based on 14px base (enterprise readable density) with 1.125 ratio rounded to even pixels.

| Token | Size | Typical use |
|---|---|---|
| `font.size.10` | 10px | Rare badges; avoid for body |
| `font.size.11` | 11px | Table meta |
| `font.size.12` | 12px | Captions, hints |
| `font.size.13` | 13px | Compact controls |
| `font.size.14` | 14px | Body default |
| `font.size.16` | 16px | Emphasized body / mobile body |
| `font.size.18` | 18px | Section titles |
| `font.size.20` | 20px | Page titles (sm) |
| `font.size.24` | 24px | Page titles |
| `font.size.30` | 30px | Dashboard hero metrics |
| `font.size.36` | 36px | Marketing/auth brand moments only |

Minimum body text in product UI: **14px**. Captions may be 12px if contrast ≥ 4.5:1.

## 3.6 Spacing Scale

**8pt grid** with 4pt half-steps for icon optical alignment.

| Token | Value |
|---|---|---|
| `space.0` | 0 |
| `space.0.5` | 2px |
| `space.1` | 4px |
| `space.1.5` | 6px |
| `space.2` | 8px |
| `space.3` | 12px |
| `space.4` | 16px |
| `space.5` | 20px |
| `space.6` | 24px |
| `space.8` | 32px |
| `space.10` | 40px |
| `space.12` | 48px |
| `space.16` | 64px |
| `space.20` | 80px |
| `space.24` | 96px |

## 3.7 Radius

| Token | Value | Use |
|---|---|---|
| `radius.none` | 0 | Tables flush, print |
| `radius.sm` | 6px | Inputs compact, chips |
| `radius.md` | 10px | Buttons, inputs default |
| `radius.lg` | 14px | Cards |
| `radius.xl` | 18px | Panels, sheets |
| `radius.2xl` | 24px | Auth shells, large POS tiles |
| `radius.full` | 9999px | Avatars, pills |

## 3.8 Shadows & Elevation

Elevation is semantic, not decorative.

| Token | Light | Purpose |
|---|---|---|
| `elevation.0` | none | Flat surfaces |
| `elevation.1` | `0 1px 2px rgba(15,23,42,0.06)` | Cards resting |
| `elevation.2` | `0 4px 12px rgba(15,23,42,0.08)` | Dropdowns |
| `elevation.3` | `0 12px 32px rgba(15,23,42,0.14)` | Modals |
| `elevation.4` | `0 24px 48px rgba(15,23,42,0.18)` | Rare command palette |

Prefer border + elevation.1 over heavy shadows for tables and ERP density.

## 3.9 Opacity

| Token | Value | Use |
|---|---|---|
| `opacity.disabled` | 0.48 | Disabled controls (also use disabled colors) |
| `opacity.muted` | 0.72 | Secondary icons |
| `opacity.overlay` | 0.48 | Scrims |
| `opacity.hover-wash` | 0.06 | Hover on ghost controls |
| `opacity.pressed-wash` | 0.10 | Pressed wash |

## 3.10 Motion Tokens

| Token | Value |
|---|---|
| `motion.duration.instant` | 0ms |
| `motion.duration.fast` | 120ms |
| `motion.duration.normal` | 200ms |
| `motion.duration.slow` | 320ms |
| `motion.duration.deliberate` | 480ms |
| `motion.easing.standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `motion.easing.emphasized` | `cubic-bezier(0.2, 0, 0, 1)` |
| `motion.easing.exit` | `cubic-bezier(0.4, 0, 1, 1)` |
| `motion.easing.enter` | `cubic-bezier(0, 0, 0.2, 1)` |

Reduced motion: all non-essential durations → `instant` or opacity-only fades ≤ 120ms.

## 3.11 Animation Timing (usage mapping)

| Interaction | Duration | Easing |
|---|---|---|
| Button press feedback | fast | standard |
| Tooltip show | fast | enter |
| Dropdown open | normal | enter |
| Modal open | slow | enter |
| Modal close | normal | exit |
| Toast enter | normal | enter |
| Page section reveal | normal | enter |
| Skeleton shimmer | deliberate loop | linear (disabled if reduced motion) |

## 3.12 Z-Index System

Use a closed scale. Do not invent `z-[9999]` in product code.

| Token | Value | Layer |
|---|---|---|
| `z.base` | 0 | Content |
| `z.sticky` | 100 | Sticky headers |
| `z.dropdown` | 200 | Menus |
| `z.overlay` | 300 | Scrims |
| `z.modal` | 400 | Dialogs |
| `z.toast` | 500 | Toasts |
| `z.popover` | 450 | Popovers above modal only when nested intentionally |
| `z.command` | 600 | Command palette |
| `z.devtools` | 1000 | Internal only |

## 3.13 Breakpoints

Mobile-first min-widths:

| Token | Value | Guidance |
|---|---|---|
| `bp.sm` | 640px | Large phones / small tablets |
| `bp.md` | 768px | Tablets |
| `bp.lg` | 1024px | Laptops / POS split layouts |
| `bp.xl` | 1280px | Desktops |
| `bp.2xl` | 1536px | Wide desktops |
| `bp.3xl` | 1920px | Ultra-wide dashboards |

## 3.14 Container Widths

| Token | Value | Use |
|---|---|---|
| `container.sm` | 640px | Narrow forms |
| `container.md` | 768px | Settings sections |
| `container.lg` | 1024px | Standard pages |
| `container.xl` | 1280px | Tables + filters |
| `container.2xl` | 1536px | Analytics |
| `container.full` | 100% | POS / immersive |

Page gutters: `space.4` mobile → `space.6` tablet → `space.8` desktop.

---

# 4. Grid System

## 4.1 8pt Grid

All spacing, sizing, and positioning snap to the 8pt grid. Exceptions:

- 1px hairline borders
- 4px icon optical adjustments
- Focus rings may extend 2–3px outside box

## 4.2 Layout Rules

1. Page = header region + optional toolbar + content + optional aside.
2. Content width constrained by container tokens unless immersive (POS).
3. Vertical rhythm uses `space.6` between sections and `space.4` within sections.
4. Align columns across stacked cards; do not stagger arbitrarily.
5. Avoid more than 12 conceptual columns; use 4/8/12 CSS grid patterns.

## 4.3 Containers

- Shell pages use `container.xl` max by default.
- Forms use `container.sm` or `container.md`.
- Analytics may use `container.2xl`.
- POS uses full viewport with internal rails.

## 4.4 Responsive Grid

| Breakpoint | Columns | Gutter |
|---|---|---|
| < sm | 4 | 16px |
| sm–md | 8 | 16px |
| lg+ | 12 | 24px |

KPI rows: 1 col mobile → 2 tablet → 4 desktop.  
Tables: full bleed within container; convert to cards below `md` when columns > 5 and tasks allow.

## 4.5 Spacing Rules

- Related items: `space.2`–`space.3`
- Control groups: `space.4`
- Card padding: `space.4` compact / `space.6` comfortable
- Section gaps: `space.8`
- Do not mix arbitrary values like 13px or 15px

---

# 5. Typography

## 5.1 Goals

Typography in Meridian must work equally for Arabic and Latin scripts, long operational labels, dense tables, and financial figures.

## 5.2 Font stack

**Primary UI:** Cairo (Arabic-first geometric), with IBM Plex Sans Arabic as fallback for extended Arabic coverage, then Inter / system-ui for Latin.

**Mono:** IBM Plex Mono for IDs, SKUs, webhook payloads, JSON previews.

Load fonts with `font-display: swap` and subset when possible. Never block first paint on marketing weights unused in product.

## 5.3 Headings

| Style | Size | Weight | Line | Use |
|---|---|---|---|---|
| H1 Page | 24/30 | semibold | tight | Page titles |
| H2 Section | 18/20 | semibold | snug | Section headers |
| H3 Subsection | 16 | semibold | snug | Card titles |
| H4 | 14 | semibold | normal | Nested groups |

Rules:

- One H1 per page.
- Do not skip heading levels for style reasons.
- Page titles do not compete with brand marks on branded marketing pages; product app shell uses product name in nav, page title in content.

## 5.4 Body

- Default: 14px / 1.5 / regular / `text.primary`
- Emphasized: 14–16px medium
- Long help content: 16px relaxed on mobile

## 5.5 Captions

12px muted for timestamps, helper text, table secondary lines. Never use captions as the only label for an input.

## 5.6 Labels

Form labels: 13–14px medium, `text.primary`, permanently visible. Placeholders are examples, never label substitutes.

## 5.7 Tables

- Header: 12–13px semibold, muted or secondary, uppercase avoided for Arabic
- Cell: 14px regular
- Numeric cells: tabular-nums, end-aligned in LTR, start-aligned carefully in RTL per §14
- Compact mode: 13px with maintained 40px row min height on touch surfaces

## 5.8 Forms

- Label above field
- Hint below field in caption style
- Error replaces hint in danger color, announced to AT

## 5.9 Code

Mono 13px in inline code chips; 12–13px in blocks. Prefer soft surface background, not harsh black terminal unless in developer tools.

## 5.10 Numbers & Financial Data

Always:

- `font-variant-numeric: tabular-nums`
- Consistent currency helper (`formatCurrency`)
- Explicit currency code or symbol policy per org locale
- Negatives with minus, not red alone (colorblind safety); red may reinforce
- Align decimal columns
- Do not animate digit spinners for financial ledgers

KPI big numbers: 24–30px semibold tabular-nums.

## 5.11 Arabic Support

- Prefer Cairo weights that keep Arabic counters clear at 12–14px
- Avoid ultra-tight tracking on Arabic
- Line length shorter for Arabic paragraphs when possible
- Do not force Latin-only title case transforms on Arabic strings

## 5.12 English Support

- Sentence case for UI labels (Title Case only for proper nouns)
- Keep button labels short verbs: Save, Approve, Close session

## 5.13 RTL Typography

- `dir` inherited from document/app setting
- Logical properties for padding/margin (`padding-inline-start`)
- Do not mirror numbers incorrectly; see §14

---

# 6. Color System

## 6.1 Principles

1. **Tokens only.** No hardcoded hex/rgb in components or pages.
2. **Semantic first.** Prefer `color.feedback.danger` over `red.600` in product UI.
3. **Meaning over decoration.** Color encodes state, not brand theater.
4. **Contrast by default.** Text/icon contrast meets WCAG AA against intended backgrounds.
5. **Theme remapping.** Light/dark/high-contrast change semantic tokens; components stay unchanged.

## 6.2 Primary

Primary (`color.action.primary` → Harbor 600/700) is reserved for:

- Primary buttons
- Key selected navigation item
- Focus rings
- Critical progressive indicators (stepper current)

Do not use primary for large background washes covering the whole page. Do not use primary for body text except links sparingly.

## 6.3 Secondary

Secondary actions use neutral surfaces:

- Secondary button: surface + border + text.primary
- Ghost button: transparent + text.secondary → text.primary on hover

Secondary is the default for most actions when a primary already exists in the region.

## 6.4 Accent

Accent (Harbor 500 / amber for attention) is rare:

- New feature badges (temporary)
- POS highlight tiles when needed
- Chart highlight series

Never use accent as a second primary competing with Harbor 600.

## 6.5 Success

`color.feedback.success` for completed states, positive stock adjustments confirmation, successful sync. Background washes use `green.50` / dark equivalent. Icons + text, not color alone.

## 6.6 Warning

`color.feedback.warning` for caution that is not yet failure: low stock, session cash variance pending review, approaching credit limit. Use amber—not orange-red confusion with danger.

## 6.7 Danger

`color.feedback.danger` for errors, destructive actions, blocking validation. Destructive primary buttons use danger background with inverse text. Confirm dialogs required.

## 6.8 Info

`color.feedback.info` for neutral system messages, tips, non-blocking notices.

## 6.9 Surface & Background

| Role | Token |
|---|---|
| App canvas | `color.bg.canvas` |
| Card/panel | `color.bg.surface` |
| Nested/muted | `color.bg.surface-muted` |
| Input fill | `color.bg.surface` or muted depending on density theme |
| Table header | `color.bg.surface-muted` |

## 6.10 Border

Default borders are visible but quiet. Strong borders for structural splits (sidebar edge). Focus borders use focus token, never rely on color alone without ring offset.

## 6.11 Text

Primary / secondary / muted / inverse / disabled as defined in tokens. Link text uses primary action color with underline on hover/focus for clarity.

## 6.12 Muted

Muted text and icons for metadata. Do not mute critical values (totals, statuses).

## 6.13 Disabled

Disabled controls: disabled text token + disabled border + not-allowed cursor + no hover elevation. Opacity may assist but contrast still should not fake interactivity.

## 6.14 Hover / Focus / Selection

- Hover: subtle wash or border strengthen; do not shift layout
- Focus: 2px ring using `color.border.focus` + offset 2px on canvas
- Selection: `color.selection.bg` for rows/chips; keyboard selection matches pointer selection visuals

## 6.15 Dark Mode

See §15. Semantic tokens remap; do not invert images blindly. Surfaces elevate via lighter border and slight luminance steps, not heavy shadows alone.

## 6.16 High Contrast

High-contrast theme increases border strength, text contrast, and focus ring thickness. Charts use patterns + color.

## 6.17 Accessibility

- Normal text ≥ 4.5:1
- Large text ≥ 3:1
- UI components/graphics ≥ 3:1 against adjacent colors
- Do not convey meaning by color alone

## 6.18 Usage Rules

**Do**

- Map every color in Figma/code to a token name
- Test pairs in light and dark
- Use washes (`*.50`) for soft status backgrounds

**Don’t**

- Hardcode `#2563EB` in a component
- Use pure black/pure white large text blocks for long reading in dark mode without adjustment
- Use red/green only for status without icons/text
- Paint entire dashboards in primary brand color

---

# 7. Iconography

## 7.1 Icon Library

Standard library: **Lucide** (or project-approved equivalent outline set) for product UI consistency. Do not mix filled Material icons with outline Lucide ad hoc.

Custom product icons (POS payment types, manufacturing machines) must match:

- 1.5–2px stroke at 24px artboard
- Rounded joins/caps
- Optical center aligned
- No brand logos inside action icons

## 7.2 Icon Sizes

| Token | Size | Use |
|---|---|---|
| `icon.xs` | 12px | Rare inline |
| `icon.sm` | 16px | Inputs, table actions |
| `icon.md` | 20px | Buttons, nav |
| `icon.lg` | 24px | Section headers, empty states |
| `icon.xl` | 32px | Feature empty / POS |
| `icon.2xl` | 40–48px | Onboarding only |

Touch icon buttons: hit area ≥ 40×40 even if glyph is 20px.

## 7.3 Icon Colors

Icons inherit text color from parent semantic token. Status icons use feedback tokens. Decorative icons never brighter than content hierarchy requires.

## 7.4 Usage Rules

- Prefer icon + label for primary navigation and critical actions
- Icon-only buttons require `aria-label` and tooltip on desktop
- Keep metaphors stable: trash = delete, pencil = edit, plus = create
- Do not use icons that conflict with cultural RTL expectations without review

## 7.5 RTL Rules

- Directional icons (arrows, chevrons, back/forward) flip in RTL
- Media/play icons carefully evaluated; usually flip chevrons, not all media
- Non-directional icons (search, settings, user) do not flip
- Implement via logical rotation utilities or RTL-aware icon component—never manual per-page hacks

## 7.6 Status Icons

| Status | Icon metaphor | Color |
|---|---|---|
| Success | check-circle | success |
| Warning | alert-triangle | warning |
| Danger | alert-circle / x-circle | danger |
| Info | info | info |
| Pending | clock / loader | muted/secondary |
| Syncing | refresh-cw (animated only if not reduced-motion) | info |

## 7.7 Action Icons

Edit, delete, filter, export, import, print, more-vertical/horizontal—use consistent placement: row actions end-aligned with overflow menu when >3 actions.

---

# 8. Component Library

Each component below is a contract. Implementations may use shadcn/Radix or internal primitives, but behavior and tokens must match Meridian.

## 8.1 Shared component contract

Every interactive component documents:

- Purpose
- Usage
- Variants
- States: default, hover, focus-visible, active, disabled, loading, error (as applicable)
- Accessibility
- Keyboard
- RTL
- Responsive
- Do / Don’t
- Examples (descriptive)

---

## Button

**Purpose:** Trigger actions and navigation that feel actionable.

**Usage:** One primary button per region. Prefer verbs.

**Variants:** `primary` · `secondary` · `ghost` · `danger` · `link` · `outline`  
**Sizes:** `sm` (32) · `md` (40) · `lg` (48) · `pos` (56+ for POS)

**States:** default, hover, focus-visible, pressed, disabled, loading (spinner + optional label preserve width)

**Accessibility:** Real `<button>` or properly roled link. Loading buttons stay focusable but `aria-disabled` / disabled submit. Announce loading via `aria-busy` when appropriate.

**Keyboard:** Enter/Space activate. No keyboard trap.

**RTL:** Icon+label order uses logical gap; directional icons flip.

**Responsive:** Full-width buttons allowed in mobile stacked footers; auto width on desktop toolbars.

**Do:** Use danger variant for destructive. Keep labels short.  
**Don’t:** Disable without explanation. Use primary for Cancel. Nest buttons in buttons.

**Examples:** “حفظ” / Save · “إغلاق الجلسة” / Close session · “حذف الصنف” with confirm.

---

## Input

**Purpose:** Single-line text entry.

**Usage:** Always with visible label. Optional hint/error.

**Variants:** default · quiet (borderless in dense filters) · prefix/suffix addon

**States:** default, hover, focus, error, disabled, read-only

**Accessibility:** `id` + `label for`. Error linked via `aria-describedby`. `aria-invalid` on error.

**Keyboard:** Standard text editing. Esc clears only if explicitly designed (search).

**RTL:** Placeholder and text align with direction; prefix/suffix swap logically.

**Responsive:** 16px font on iOS to prevent zoom where required; or accept zoom. Min height 40px.

**Do:** Correct `type`, `inputMode`, autocomplete.  
**Don’t:** Placeholder-as-label. Red border without text error.

---

## Textarea

**Purpose:** Multi-line entry (notes, addresses, rejection reasons).

**Usage:** Show character count only when limit matters. Auto-resize optional up to max height then scroll.

**States / A11y / Keyboard / RTL:** Same principles as Input.  
**Do:** Set sensible `rows`.  
**Don’t:** Use textarea for single-line OTPs or phones.

---

## Search

**Purpose:** Query lists and catalogs.

**Usage:** Leading search icon, clear button when non-empty, debounce 150–300ms for server search.

**Variants:** toolbar search · command-palette search · table search

**Keyboard:** `/` focuses site search when documented. Esc clears or blurs per pattern. Arrow keys move results when listbox present.

**Accessibility:** `role="search"` region; combobox pattern when suggestions exist.

**Do:** Show “No results” clearly.  
**Don’t:** Search-as-you-type without debounce on heavy endpoints.

---

## Password

**Purpose:** Secret entry.

**Usage:** Show/hide toggle with `aria-pressed` / label. Caps Lock warning when detectable.

**Do:** Support password managers (`autocomplete`).  
**Don’t:** SMS password anti-patterns for primary auth when better factors exist; follow product security policy.

---

## OTP

**Purpose:** One-time codes.

**Usage:** Segmented inputs or single input with paste support. Auto-advance. Paste fills all.

**Accessibility:** One field preferred for AT; visual segments cosmetic if possible. Announce errors.

**Keyboard:** Digits only; Backspace returns to previous segment if segmented.

**Do:** 30–60s resend cooldown clarity.  
**Don’t:** Block paste.

---

## Phone

**Purpose:** Phone numbers with locale awareness.

**Usage:** Country code separate or integrated; store E.164 when backend requires. `inputMode="tel"`.

**RTL:** Keep digits logical; UI chrome follows direction.

**Do:** Validate lightly client-side, firmly server-side.  
**Don’t:** Force national formatting that breaks paste.

---

## Currency

**Purpose:** Money entry and display.

**Usage:**  
- Display: shared formatter, tabular-nums  
- Input: decimal policy per currency; right/left symbol placement by locale

**States:** error on invalid precision; warning on unusually large values if business rules say so

**Do:** Align columns in tables.  
**Don’t:** Float math in UI without decimal rules; never invent FX rates in presentation.

---

## Select

**Purpose:** Choose one from known options.

**Usage:** Prefer Select for < ~20–50 options; Autocomplete for large sets.

**Accessibility:** Listbox pattern (Radix/shadcn). Announce selected option.

**Keyboard:** arrows, typeahead, Enter, Esc, Home/End.

**RTL:** Chevrons flip; menu aligns to logical start/end.

**Do:** Include empty placeholder option only if value nullable.  
**Don’t:** Native select on desktop if custom select breaks mobile—test both.

---

## Autocomplete

**Purpose:** Searchable selection from large datasets (customers, products, SKUs).

**Usage:** Async fetch, loading spinner in panel, keyboard listbox, clear selection.

**Accessibility:** Combobox ARIA pattern. `aria-activedescendant` or roving tabindex.

**Do:** Show selected chip/value clearly.  
**Don’t:** Fail silently on network; show error in panel.

---

## Date Picker

**Purpose:** Choose calendar dates / ranges.

**Usage:** Localized calendar; Arabic month names when locale ar. Range mode for reports.

**Keyboard:** arrows change days; PageUp/Down months; Enter selects.

**RTL:** Calendar chrome mirrors; week start follows locale.

**Do:** Allow manual typed entry with validation.  
**Don’t:** Ambiguous `01/02/2026` without locale format hint.

---

## Time Picker

**Purpose:** Time of day.

**Usage:** 24h vs 12h per locale settings. Steps of 5/15 minutes common for ops.

**Do:** Pair with date when datetime required.  
**Don’t:** Force seconds unless domain needs them.

---

## Checkbox

**Purpose:** Multi-select toggles / boolean agreements.

**States:** unchecked, checked, indeterminate (bulk tables)

**Keyboard:** Space toggles when focused.

**Do:** Click label toggles.  
**Don’t:** Use checkbox for exclusive choices (use radio).

---

## Radio

**Purpose:** Exclusive choice in small sets.

**Keyboard:** Arrow keys within group.

**Do:** Group with `radiogroup` + legend.  
**Don’t:** Single radio without group.

---

## Switch

**Purpose:** Immediate binary settings (enable tax, enable feature).

**Usage:** Prefer switch for instant-effect settings; checkbox for form submit batches.

**Accessibility:** `role="switch"` `aria-checked`.

**Do:** Confirm when switching on has side effects.  
**Don’t:** Use switch for tristate.

---

## Segmented Control

**Purpose:** 2–5 mutually exclusive views (Paid / Unpaid / All).

**Keyboard:** arrows between segments.

**Responsive:** Scroll horizontally on mobile if needed with fade hints; never clip without affordance.

**Do:** Keep labels short.  
**Don’t:** Use for primary navigation of whole app.

---

## Badge

**Purpose:** Compact status/count.

**Variants:** neutral · success · warning · danger · info · outline

**Do:** Pair with text status in tables when possible.  
**Don’t:** Tiny unread badges below 4.5:1 contrast.

---

## Chip / Tag

**Purpose:** Filters, categories, removable selections.

**Usage:** Removable chips need clear remove hit target ≥ 24px, better 40px in touch UIs.

**Keyboard:** Delete/Backspace removes focused chip in input contexts.

---

## Avatar

**Purpose:** People/entities visual identity.

**Variants:** image · initials · icon fallback  
**Sizes:** 24 · 32 · 40 · 56

**Do:** Always provide alt empty if decorative adjacent to name; otherwise meaningful label.  
**Don’t:** Rely on color alone to identify users.

---

## Card

**Purpose:** Group related content.

**Variants:** static · interactive (button/link) · operational panel · KPI

**Usage:** Cards are for interaction boundaries or clear grouping. Prefer less chrome on dashboards when tables suffice.

**Do:** Consistent padding tokens.  
**Don’t:** Card-in-card-in-card. Don’t put primary page layout entirely inside decorative cards without need.

---

## Table

**Purpose:** Compare structured rows.

**Must include:** sticky header (desktop), column alignment rules, empty/loading/error, row actions, selection optional, sort affordances.

**Accessibility:** `<table>` with scopes; or grid pattern if virtualized with care. Sortable headers announce state.

**Keyboard:** Sort via header Enter; row action menus via keyboard; selection Space.

**RTL:** Columns flow logically; numeric columns follow §14.

**Responsive:** Card transformation or prioritized columns + “more” drawer.

**Do:** Persist column filters in URL when shareable.  
**Don’t:** Horizontal scroll as the only mobile strategy for core tasks.

---

## Data Grid

**Purpose:** High-density editable operational grids (inventory counts, manufacturing BOMs).

**Extras vs Table:** cell navigation, inline edit, frozen columns, virtualization.

**Keyboard:** Excel-like arrows optional but documented; Enter edits; Esc cancels.

**Performance:** Virtualize beyond ~100–200 rows.

---

## Pagination

**Purpose:** Page through large sets.

**Variants:** numbered · simple prev/next · infinite (rare; prefer explicit for enterprise audits)

**Do:** Show range (“1–50 of 1,284”).  
**Don’t:** Hide total when backend provides it cheaply.

---

## Tabs

**Purpose:** Switch peer views in-place.

**Accessibility:** tablist/tab/tabpanel pattern; arrow keys.

**RTL:** order mirrors; arrows reverse logically.

**Do:** Keep tabs count manageable; overflow into dropdown.  
**Don’t:** Use tabs for sequential wizards (use stepper).

---

## Accordion

**Purpose:** Progressive disclosure of sections.

**Keyboard:** Enter/Space expands; arrows optional between headers.

**Do:** Allow multiple open when comparison needed.  
**Don’t:** Hide legally required info permanently.

---

## Modal (Dialog)

**Purpose:** Focused task requiring acknowledgment without full navigation.

**Sizes:** sm · md · lg · xl  
**Structure:** title · body · footer (cancel logical start / primary logical end—see RTL)

**Accessibility:** focus trap, restore focus, Esc closes if non-destructive critical, `aria-modal`.

**Do:** Confirm destructive with typed name when high risk.  
**Don’t:** Stack endless modals; use drawer or page for complex flows.

---

## Drawer / Sheet

**Purpose:** Mobile-friendly secondary panels; filters; POS cart on smaller screens.

**Usage:** bottom sheet on mobile; side drawer on desktop.

**Accessibility:** same focus management as modal when modal-like.

---

## Tooltip

**Purpose:** Supplemental label for icon-only controls.

**Keyboard:** appear on focus; dismiss Esc.  
**Do:** Not for critical info.  
**Don’t:** Tooltips on touch-only without long-press alternative—prefer visible labels.

---

## Popover

**Purpose:** Small interactive content (column picker, tiny forms).

**Keyboard:** focus inside; Esc closes.

---

## Dropdown Menu

**Purpose:** Action lists.

**Keyboard:** arrows, typeahead, Enter, Esc.  
**Do:** Group destructive actions separately.  
**Don’t:** More than ~10 without grouping/search.

---

## Toast

**Purpose:** Transient feedback.

**Rules:** 1–2 lines; action optional; auto-dismiss 4–6s for success; persist errors until dismissed; stack limit 3.

**Accessibility:** `aria-live="polite"` success; assertive for critical errors sparingly.

**Do:** Undo when feasible.  
**Don’t:** Toast validation errors that belong under fields.

---

## Alert

**Purpose:** Inline persistent messages in page/form.

**Variants:** info · success · warning · danger

**Do:** Include icon + title + description + optional action.  
**Don’t:** Duplicate the same alert in toast and inline.

---

## Progress

**Purpose:** Determinate task completion.

**Accessibility:** `role="progressbar"` valuemin/max/now.

**Do:** Show percentage or step fraction in text.  
**Don’t:** Fake determinate progress.

---

## Skeleton

**Purpose:** Loading placeholder matching layout.

**Do:** Mimic final content shape.  
**Don’t:** Skeleton forever without timeout/error.

---

## Empty State

**Purpose:** Explain zero-data and next action.

**Structure:** icon/illustration (optional) · title · description · primary action · secondary help link

**Do:** Differ empty vs filtered-empty (“No results” + clear filters).  
**Don’t:** Blank tables with no explanation.

---

## Timeline

**Purpose:** Order events, approval history, shipment tracking.

**Do:** Newest direction consistent with product language.  
**Don’t:** Overwhelm with trivial events—group.

---

## Calendar

**Purpose:** Scheduling surfaces (HR leave, production calendar).

**A11y:** keyboard reachable days; selected announced.

---

## Charts

**Purpose:** Visual analytics.

**Rules:** tokenized colors; legends; tabular alternative; no animation required for understanding; tooltips accessible.

**Do:** Title + period + unit.  
**Don’t:** 3D charts. Don’t rainbow default palettes.

---

## File Upload / Image Upload

**Purpose:** Attach documents/images.

**States:** idle, drag-active, uploading, success, error, virus/reject reasons

**Do:** Show type/size limits before choose. Image preview with remove.  
**Don’t:** Fail after 90% without recovery.

**A11y:** keyboard operable dropzone; progress announced.

---

## Breadcrumb

**Purpose:** Hierarchy orientation.

**Do:** Current page not a link. Collapse middle on mobile.  
**RTL:** separators flip.

---

## Sidebar

**Purpose:** App navigation.

**States:** expanded · collapsed (icon rail) · mobile off-canvas

**Do:** Show active route; badge counts sparingly.  
**Keyboard:** nav links tabbable; collapsed mode tooltips.

---

## Topbar / Header

**Purpose:** Context: org/store switcher, search, session, user menu, notifications.

**Do:** Keep critical context visible (active store, open session).  
**Don’t:** Duplicate entire sidebar links without need.

---

## Navigation

**Purpose:** Wayfinding across modules.

**Rules:** permission-filtered; predictable order; Arabic labels concise; group by workflow not org chart vanity.

---

## Command Palette

**Purpose:** Keyboard jump to actions/pages (`⌘K` / `Ctrl+K`).

**Do:** Recent + frequent; fuzzy search; keyboard only operable.  
**Don’t:** Hide features exclusively in command palette.

---

## Notifications

**Purpose:** System/user alerts center.

**Do:** Read/unread; deep link; timestamp; batch mark read.  
**Don’t:** Badge inflation for low-value noise.

---

## Loading Indicators

**Types:** skeleton · spinner · progress · button loading  
**Do:** Prefer skeleton for panels.  
**Don’t:** Multiple conflicting spinners.

---

## Status Indicators

**Purpose:** Entity lifecycle (order paid, session open, transfer in-transit).

**Do:** Status pill + text; consistent color mapping across modules.  
**Don’t:** Different colors for same status in POS vs Orders.

---

## Print Components

**Purpose:** Browser print layouts for reports/invoices.

**Rules:** white background; no sticky chrome; `print:` utilities; page breaks thoughtful; hide nav.

---

## Receipt Components

**Purpose:** Thermal/receipt width layouts for POS.

**Rules:** monospace or condensed; clear totals; store header; QR optional; test 58mm/80mm.

---

## POS Components

**Category rail · Product tile · Cart panel · Payment panel · PIN switch · Weight/amount modal · Credit checkout · Success receipt dialog**

Rules:

- Touch targets ≥ 44–48px (prefer 56 for payment)
- Large totals
- Blocking errors obvious
- Session visibility
- Offline/sync banners if applicable

---

## ERP Components

**Purpose:** Dense operational modules: purchases, transfers, stock counts, expenses, approvals.

Rules: filter bars, draft states, document numbers monospace, approval steppers, audit side panels.

---

## Dashboard Components

KPI card · sparkline · live feed · quick actions · top rankings · alerts list

Rules: exception-first; real data only; period selector visible; last updated timestamp.

---

## Analytics Components

Report hub tiles · chart + table twins · cohort filters · export buttons · saved views

Rules: never chart without numbers access; explain empty analytics.

---

# 9. UX Patterns

## 9.1 Login

**Goal:** Authenticate quickly with clear error recovery.

**Structure:** Brand mark · product name · email/phone · password · primary submit · forgot password · optional device/SSO links.

**Rules:**

- Prefer one column, `container.sm`
- Inline field errors + top alert for account-level failures
- Preserve username on password failure
- Rate-limit messaging honest (“Try again in 30s”)
- After login, route by role (cashier → POS, others → default home)
- Never show “user not found” vs “wrong password” if security policy forbids enumeration—use unified message

**A11y:** Autocomplete attributes; focus first field; announce errors.

## 9.2 Register

**Goal:** Create account/org with minimal friction and correct legal consent.

**Rules:** Progressive fields; password guidance without blocking quirks; clear org vs user distinction for multi-tenant SaaS.

## 9.3 Forgot Password

**Goal:** Recover access without support tickets.

**Flow:** Identify → send link/OTP → set new password → confirm → login.

**Rules:** Same success message whether account exists if enumeration risk; expiry clarity; disallow old password reuse if policy requires.

## 9.4 CRUD

**Create:** Dedicated page or modal for small entities; page for complex.  
**Read:** Detail with clear header meta + tabs for related data.  
**Update:** Edit-in-place sparingly; prefer edit form with cancel.  
**Delete:** Confirm; soft-delete when domain requires history; explain consequences (stock, invoices).

**List pattern:** Filters · search · table/grid · primary Create button top logical end · bulk actions when selected.

## 9.5 Wizard

**Goal:** Sequence complex setup (open session, stock count, onboarding).

**Rules:**

- Stepper with named steps
- Persist draft between steps
- Back never destroys data silently
- Summary step before commit
- Partial failure recovery on final submit

## 9.6 Checkout

**Goal:** Collect payment accurately.

**Rules:** Totals immutable except via line changes; tender types clear; change due prominent; receipts optional/print/email; credit path separate with limit checks; never double-charge—disable submit while in flight.

## 9.7 POS Pattern

**Layout:** Category rail · product grid · cart · pay  
**Priorities:** Speed, large targets, session safety, PIN switch, barcode search focus.  
**Interruptions:** Online order badges must not steal cart focus without user action.  
**Close of day:** Guided close session stepper, not a single dangerous button.

## 9.8 ERP Pattern

**Document-centric:** Draft → Submit → Approve → Post.  
Status always visible. Related documents linked. Attachments and notes secondary. Period locks respected with clear messaging.

## 9.9 Search Pattern

Global vs local search. Recent searches. Entity-type filters. Keyboard open. Empty and error states. Result rows show enough meta to disambiguate (SKU + name + store).

## 9.10 Filters

**Rules:** Chip-visible active filters; Clear all; Apply vs instant filter—choose per cost; sticky filter bar; mobile filters in drawer; count results after filter.

## 9.11 Import

**Flow:** Download template → upload → validate preview → map columns if needed → commit → report errors CSV.

**Rules:** Never partially import without explicit policy; show row-level errors; idempotency keys when possible.

## 9.12 Export

Async for large jobs; email/download when ready; format choices (CSV/XLSX/PDF); respect permissions and store scope; watermark sensitive PDFs if policy requires.

## 9.13 Approval Workflow

Inbox of pending items; diff of what changed; approve/reject with reason; escalations; prevent self-approve if policy; audit trail timeline.

## 9.14 Settings

Unified settings hub with sections/tabs; dangerous zones clearly separated; save per section or explicit save bar; unsaved changes guard.

## 9.15 Profile

Identity, security (password/PIN/sessions), preferences (language, theme), notification prefs. Do not mix org billing into personal profile without clarity.

## 9.16 Notifications Pattern

In-app center + optional email/push. Group by day. Deep links open exact entity. Quiet hours if product supports.

## 9.17 Error Recovery

Classify: validation · permission · conflict · network · unknown.  
Each class has UI: field errors · AccessDenied · refresh/merge · retry/offline queue · support code.

## 9.18 Offline Mode

Banner “Offline — changes queued” / “Offline — read only” depending on capability. Conflict resolution UI on reconnect. Never pretend writes succeeded if only queued—say queued.

## 9.19 Sync

Last synced timestamp; manual sync action; error detail; per-module sync health for POS devices.

## 9.20 File Upload Pattern

See component. Additionally: virus scan pending state; replace vs add-another; OCR hooks if product has them.

## 9.21 Bulk Actions

Select rows → sticky bulk bar → confirm summary (“Adjust 24 items”) → progress → per-row failures list.

---

# 10. Page Templates

Templates define structure, not pixel art. Each template lists regions and required states.

## 10.1 Login Template

Centered card on calm canvas · brand · form · legal/footer links · language switch if bilingual · no app sidebar.

## 10.2 Dashboard Template

PageHeader (title, period selector, export) · alert strip (exceptions) · KPI row · main grid (charts/feeds) · secondary rankings. Loading skeletons per region. Empty: “No sales in period” with CTA.

## 10.3 Settings Template

Left section nav (top tabs on mobile) · section header · forms in cards · save affordance · danger zone card last.

## 10.4 Table Page Template

PageHeader + primary action · filter/search bar · optional saved views · DataTableShell · pagination · row drawer/modal optional. States: loading, empty, error, filtered-empty.

## 10.5 Form Page Template

PageHeader · optional stepper · form sections · sticky action bar on long forms · cancel/save · success → detail or list.

## 10.6 Analytics Template

Controls (period, store, compare) · KPI strip · chart · data table twin · insights/notes · export.

## 10.7 Profile Template

Avatar/name header · tabbed panels (general/security/preferences).

## 10.8 Inventory Template

On-hand KPIs · low stock alerts · filters (store, category) · stock table · actions (transfer, adjust, count).

## 10.9 Sales Template

Sales KPIs · funnel/orders list · channels filter · drill to order detail.

## 10.10 POS Template

Fullscreen operational · no admin sidebar · session bar · catalog · cart · pay dialogs · readiness gates.

## 10.11 Orders Template

Tabs or filters by status · table · order detail page with timeline, payments, refunds, print.

## 10.12 Customers Template

Search-first · customer list · profile with credit, loyalty, order history · privacy-safe fields.

## 10.13 Products Template

Catalog table · guided product form · variants · recipes/ingredients · category manager · image upload.

## 10.14 Reports Template

Report gallery cards · each report: params → run → visualize → export · schedule if exists.

## 10.15 HR Template

Employee directory · attendance · leave requests · approvals · documents. Sensitive data masking.

## 10.16 Accounting Template

Period lock banner · journal/invoice lists · trial balances · reconciliation tools · export packs.

## 10.17 Manufacturing Template

Work orders board/table · BOM views · scrap/waste entry · machine/status · floor-friendly large actions when needed.

---

# 11. Motion

## 11.1 Animation Rules

1. Motion explains state change—never decorates.
2. Prefer opacity and transform; avoid layout thrash.
3. Respect `prefers-reduced-motion: reduce`.
4. One motion focal point at a time.
5. Interruptible animations on user input.
6. No infinite bouncing marketing motion in ops tools.
7. Duration from motion tokens only.

## 11.2 Duration & Easing

See §3.10–3.11. Default interactive: 120–200ms. Modal: ≤320ms.

## 11.3 Page Transition

Prefer instant route swap with skeleton content. If transition used: fade 120–200ms. No sliding entire ERP pages.

## 11.4 Micro Interactions

Button press scale ≤ 0.98. Toggle knobs slide. Checkbox check draws simply or snaps with reduced motion.

## 11.5 Loading

Skeleton pulse opacity 0.6↔1 at deliberate duration; disable pulse when reduced motion—use static skeleton.

## 11.6 Success / Failure

Success: toast slide/fade + optional check icon. Failure: no shake spam; brief attention via alert focus.

## 11.7 Hover / Focus

Hover visual without movement that shifts layout. Focus ring appears instantly (0–120ms).

## 11.8 Forbidden motion

Confetti on finance; parallax in tables; autoplay decorative Lottie on dashboards; animated gradients as primary background.

---

# 12. Accessibility

## 12.1 WCAG AA (minimum)

Conform to WCAG 2.2 Level AA for all product surfaces. Document exceptions only with legal/product approval.

Key criteria emphasis:

- 1.4.3 Contrast
- 1.4.11 Non-text contrast
- 2.1.1 Keyboard
- 2.4.3 Focus order
- 2.4.7 Focus visible
- 2.5.8 Target size (24px minimum; Meridian uses 40px+ for primary ops)
- 3.3.1 Error identification
- 3.3.2 Labels or instructions
- 4.1.2 Name, Role, Value

## 12.2 ARIA

Prefer native semantics. Use ARIA when building composite widgets (combobox, tabs, dialog). Never put `aria-hidden` on focused elements. Keep live regions sparse.

## 12.3 Keyboard Navigation

- All actions reachable
- Logical tab order
- Skip link to main content in shell
- Shortcuts documented (`?` help overlay optional)
- No keyboard traps except modal focus containment

## 12.4 Screen Readers

- Meaningful page titles
- Live regions for toasts/async
- Status text not color-only
- Charts have text summaries
- Icon-only buttons labeled

## 12.5 Focus

`:focus-visible` ring 2px token color + offset. Never `outline: none` without replacement. Restore focus on dialog close to invoker.

## 12.6 Contrast

Test semantic pairs in light, dark, high-contrast. Chart series must meet non-text contrast or use patterns.

## 12.7 Reduced Motion

Media query remaps motion tokens. Provide static alternatives for instructional animations.

## 12.8 Touch Targets

Primary ops controls ≥ 40×40px; POS payment ≥ 48–56px; spacing between targets ≥ 8px.

## 12.9 Semantic HTML

`main` `nav` `header` `footer` `button` `a` `table` `label` `fieldset`/`legend`. Landmarks unique.

---

# 13. Responsive Rules

## 13.1 Mobile (<640)

- Single column
- Bottom nav or hamburger + drawer
- Filters in sheet
- Tables → cards or priority columns
- Sticky primary CTA where task requires
- Avoid hover-only actions

## 13.2 Tablet (640–1024)

- Optional split views
- POS: cart may become sheet
- Sidebars collapsible
- 2-column KPI grids

## 13.3 Laptop (1024–1280)

- Standard shell with sidebar
- Tables comfortable
- 12-column grids

## 13.4 Desktop (1280–1920)

- Denser tables allowed
- Secondary panels/drawers
- Multi-column dashboards

## 13.5 Ultra Wide (>1920)

- Constrain readable forms; allow tables/analytics to expand to `container.2xl` max—avoid infinite stretch of text lines
- Prefer split panes over 4000px-wide single tables without frozen columns

## 13.6 Foldables

- Avoid critical controls in hinge occlusion zones when detectable; prefer flexible grids
- Re-test nav after posture changes

## 13.7 Landscape / Portrait

- POS landscape preferred on tablets; portrait must still complete sale
- Lock orientation only with strong product reason

## 13.8 General responsive rules

- Mobile-first CSS
- Logical properties
- Test 320, 375, 768, 1024, 1440 widths
- No horizontal scroll for primary tasks
- Images `max-width: 100%`

---

# 14. RTL Rules

Meridian is **RTL-native**, not LTR-mirrored after the fact.

## 14.1 Fundamentals

- Set `dir` and `lang` on document (e.g., `dir="rtl" lang="ar"`)
- Use CSS logical properties: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `border-inline-start`, `text-align: start`
- Flex/grid naturally reverse with direction for navigation chrome

## 14.2 Navigation

- Sidebar on inline-start edge
- Chevrons point toward deeper hierarchy relative to direction
- Back affordances point to inline-start

## 14.3 Icons

- Flip directional icons only
- Brands/logos generally do not flip
- Progress steppers flow inline-start → inline-end

## 14.4 Spacing

- Logical spacing tokens; no `ml-`/`mr-` in new code—use `ms-`/`me-` / inline utilities

## 14.5 Animations

- Slide-ins originate from inline-end for drawers in RTL if that matches reading (side drawers from inline-start edge still open from their edge)
- Avoid “left/right” in motion code; use start/end

## 14.6 Tables

- Header/text columns align start
- Numeric/money columns: keep tabular alignment; for Arabic locales typically align numbers consistently—pick one product rule: **financial figures align end in both modes for scanability** unless locale standard dictates otherwise; document per product
- Row action menus on inline-end

## 14.7 Forms

- Labels/fields full width; helpers start-aligned
- Prefix/suffix icons swap via logical sides
- Date formats localized

## 14.8 Charts

- Category axes follow direction
- Tooltips do not escape viewport opposite side incorrectly
- Legends wrap with direction

## 14.9 Numbers

- Western digits (0–9) often preferred for finance even in ar UI—follow org locale setting (`ar-EG` etc.)
- Do not mirror “123” glyphs
- Phone numbers retain meaningful grouping

## 14.10 Arabic Typography

- Adequate line-height
- Avoid italic as emphasis (poor Arabic italic support)—use weight/color
- Truncation with ellipsis works; ensure critical Arabic words aren’t clipped without title tooltip
- Mixed bilingual strings: keep roles clear; don’t mid-flip arbitrarily

## 14.11 Component checklist for RTL

Every component PR: screenshot LTR + RTL; verify focus rings, menus, icons, tables, toasts.

---

# 15. Dark Mode

## 15.1 Color Strategy

Dark mode remaps semantic tokens; components do not branch on theme except for rare assets (logos, illustrations).

**Strategy: desaturated surfaces + preserved semantic meaning.**

| Semantic | Dark approach |
|---|---|
| Canvas | `ink.950` / near `#0B1020` |
| Surface | slightly lifted `#111827` / `ink.900` |
| Surface muted | `#0F172A` |
| Borders | low-contrast luminous edges `white @ 8–12%` or `ink.700` |
| Text primary | `ink.50`–`ink.100` |
| Text muted | `ink.400` carefully tested |
| Primary action | Harbor 400–500 for fill on dark (maintain contrast) |
| Danger/success | Adjust lightness upward for contrast on dark surfaces |

Do not pure-invert light theme. Do not use large pure `#000` adjacent to `#FFF` text without hierarchy.

## 15.2 Elevation in Dark Mode

Shadows are weaker; elevation = lighter surface step + border. Modal surfaces one step above canvas. Avoid heavy black shadows that muddy the UI.

## 15.3 Contrast

Re-test all status washes. Soft red/green backgrounds need darker text than in light mode. Link contrast must hold on muted surfaces.

## 15.4 Borders

Prefer visible separators; dark mode often needs slightly stronger borders than light to compensate for lost shadow cues.

## 15.5 Charts

Increase series luminance; add gridlines at low opacity; provide patterns for accessibility; tooltips use elevated dark surface.

## 15.6 Images

Photos may need subtle scrims under overlay text. Logos: provide dark-mode variant token `asset.logo.on-dark`.

## 15.7 Icons

Use currentColor. Avoid dark-on-dark custom SVGs. Status icons may need token remaps.

## 15.8 Tables

Zebra optional via muted surface; selected row uses selection token tuned for dark; sticky headers opaque (no content bleed).

## 15.9 Forms

Input fills slightly elevated or sunken consistently—pick one metaphor per theme and stick to it. Caret color matches text. Autofill styles overridden to theme.

## 15.10 Print Rules

Print/receipt always render as light canonical theme unless user explicitly prints “as shown” and contrast remains AA. Never force dark ink-on-dark paper.

## 15.11 Theme switching

- Respect system preference by default if product allows
- User override stored per profile
- Switch without full remount flicker; update CSS variables
- No animated rainbow theme transitions

---

# 16. Enterprise Data Visualization

## 16.1 Principles

1. Truth over ornament
2. Numbers first, pictures second
3. Exceptions before averages
4. Comparable scales
5. Accessible encodings (color + shape + label)
6. Exportable underlying data

## 16.2 Tables as visualization

Tables are the primary enterprise visualization. Sort, filter, freeze, totals row, unit clarity. Footer aggregates must match filter scope—label “Totals (filtered)”.

## 16.3 KPIs

**KPI card anatomy:** label · value · delta · period · optional sparkline · optional status.

Rules:

- Delta explains direction with icon + text (“↑ 12% vs yesterday”)
- Never show vanity KPI without definition tooltip
- Loading skeleton; error inline
- Money KPIs use currency formatter
- Alert KPIs (overdue, variance) visually prioritized

## 16.4 Financial Reports

- Credit/debit columns aligned
- Negatives standardized
- Period and book locked indicators
- Drill from summary → journal → source document
- PDF export matches on-screen totals

## 16.5 Charts

**Allowed defaults:** bar, line, area (subtle), donut sparingly for composition ≤5 slices, stacked bar with caution.

**Forbidden defaults:** 3D, pie with many slices, dual-axis unless clearly labeled, chart junk.

**Anatomy:** title · subtitle/period · legend · axis labels/units · empty state · data table alternative link.

## 16.6 Heatmaps

Use for density (hours×weekday sales, machine utilization). Provide legend; color scale colorblind-safe (Harbor sequential or viridis-like approved token scale—not red-green only).

## 16.7 Progress visualizations

Determinate bars for goals; bullet charts optional for targets; always include numeric.

## 16.8 Inventory visualization

On-hand vs reserved vs incoming; reorder point markers; stockout risk badges; location breakdown.

## 16.9 Accounting visualization

Aging buckets (current, 1–30, 31–60, 61–90, 90+); waterfall for P&L movements when helpful; reconciliation match rates.

## 16.10 Manufacturing visualization

Throughput, scrap rate, OEE-style metrics only if data authentic; work-order status boards with swimlanes; bottleneck callouts.

## 16.11 Live data

Pulse indicators for live feeds; “as of” timestamps; pause live updates when user is interacting with rows if jumps cause errors.

---

# 17. Performance Guidelines

## 17.1 Rendering

- Prefer server components / streaming where architecture supports
- Avoid unnecessary client waterfalls
- Memoize only when profiling proves need (follow React Compiler guidance in-repo)
- Key lists stably; do not use index keys for reorderable data
- Split above-the-fold vs deferred widgets on dashboards

## 17.2 Images

- Modern formats (WebP/AVIF) with fallbacks
- Explicit width/height or aspect-ratio to prevent CLS
- CDN/storage transforms for thumbnails
- Lazy load below fold
- Product tiles: consistent aspect boxes

## 17.3 Lazy Loading

Route-level code splitting for heavy modules (reports, charts, manufacturing boards). Defer command palette and rarely used dialogs.

## 17.4 Virtualization

Required for large tables/grids (~100+ rows or any POS catalog with heavy cells). Preserve focus when virtualizing. Estimate row heights carefully for RTL.

## 17.5 Bundle Size

- Tree-shake icons (per-icon imports)
- No moment.js; use modern date libs already in stack
- Chart libraries loaded only on analytics routes
- Monitor budgets in CI when available

## 17.6 Animation Performance

- Transform/opacity on compositor-friendly properties
- Avoid animating top/left/width/height
- Cancel animations on navigate away
- Reduced motion disables continuous shimmer

## 17.7 Data fetching UX

- Stale-while-revalidate patterns with visible freshness
- Deduplicate identical requests
- Paginate; never silently download 50k rows into DOM

## 17.8 Performance budgets (targets)

| Metric | Target |
|---|---|
| POS interactive after nav | < 2s on standard café Wi-Fi |
| Table first contentful rows | < 1.5s cached |
| CLS | < 0.1 |
| Input latency (keypress to paint) | < 100ms perceived |

---

# 18. Engineering Rules

## 18.1 Naming

- Components: `PascalCase` (`CustomerCreditSettings`)
- Files: match project convention (`customer-credit-settings.tsx` or kebab as repo uses)
- Tokens: `mds.color.text.primary` / `--mds-color-text-primary`
- Variants: explicit unions `"primary" | "secondary"` not booleans `isPrimary`
- Event handlers: `onSave`, `onOpenChange`
- Avoid abbreviations except industry standard (`POS`, `SKU`, `id`)

## 18.2 Folder Structure (reference)

```
src/
  components/
    ui/                 # primitives (button, input)
    mds/ or sweetflow/  # composite product components
  modules/<domain>/
    components/
    actions/
    services/
  lib/
    design-tokens.ts
    formatters/
  styles/
    tokens.css
```

Do not invent parallel design systems in `components/legacy-ui`.

## 18.3 Component Structure

1. Imports
2. Types/props
3. Component function
4. Subcomponents colocated if private
5. Skeleton/empty exports as needed

Prefer composition:

```tsx
<DataTableShell>
  <DataTableShell.Toolbar />
  <DataTableShell.Table />
  <DataTableShell.Pagination />
</DataTableShell>
```

## 18.4 Props

- Sensible defaults documented
- Controlled vs uncontrolled clearly
- Disabled/loading/error props consistent across library
- Never require consumers to pass raw color classes for variants that exist
- Forward refs on inputs/buttons
- Spread carefully; don’t swallow `className`—merge with tokenized base

## 18.5 Composition

Build pages from templates + composites + primitives. Domain modules own business wiring; MDS owns visual behavior.

## 18.6 Variants

Use variant APIs (`cva` or equivalent) mapped to tokens. New variants require design-system approval if global.

## 18.7 Theming

Theme = CSS variable pack. Runtime switch updates attributes (`data-theme="dark"`). No SCSS variable forks per customer without token layer.

## 18.8 Design Tokens in Code

Single export source. Tailwind theme extends map to CSS variables. Product code uses utility classes mapped to tokens (`bg-surface`, `text-muted-foreground`)—not raw hex.

## 18.9 Documentation

- Each composite listed in this file
- Storybook/Ladle optional but encouraged
- Changelog section at bottom for system versions
- Screenshots for RTL/dark in PR for UI changes

## 18.10 Testing expectations

- Unit: formatters, token maps
- Component: critical a11y roles/keyboard
- E2E: login, POS sale path, table filter, RTL smoke

## 18.11 i18n engineering

- No hardcoded user-facing strings in shared MDS primitives when product uses `t()`—pass labels in
- Domain ops Arabic may be hardcoded only where project already does; prefer translation keys for new shared chrome
- Date/number format via locale utilities

---

# 19. Checklists

## 19.1 Page Checklist

- [ ] One clear H1 / PageHeader
- [ ] Primary action defined or intentionally absent
- [ ] Loading state
- [ ] Empty state
- [ ] Error state
- [ ] Permission/AccessDenied state
- [ ] Responsive layout verified
- [ ] RTL verified
- [ ] Dark mode verified
- [ ] Keyboard path verified
- [ ] Context (store/period/org) visible if relevant
- [ ] No fake demo metrics

## 19.2 Form Checklist

- [ ] Visible labels
- [ ] Required indicators
- [ ] Validation messages linked
- [ ] Correct input modes
- [ ] Autocomplete attributes
- [ ] Disabled/submit pending state
- [ ] Unsaved changes guard when needed
- [ ] Cancel safe
- [ ] Success destination clear
- [ ] Server errors mapped to fields when possible
- [ ] RTL prefixes/suffixes correct
- [ ] Touch targets adequate

## 19.3 Table Checklist

- [ ] Sticky header on desktop
- [ ] Sort/filter affordances clear
- [ ] Empty vs filtered-empty
- [ ] Loading skeleton/rows
- [ ] Error retry
- [ ] Row actions keyboard accessible
- [ ] Numeric alignment + tabular-nums
- [ ] Pagination or virtualization
- [ ] Bulk selection UX if enabled
- [ ] Mobile strategy defined
- [ ] Export respects filters

## 19.4 Dashboard Checklist

- [ ] Period selector
- [ ] Last updated
- [ ] Exception alerts first
- [ ] KPI definitions available
- [ ] Charts have table alternative
- [ ] Widgets degrade independently on error
- [ ] Performance acceptable with live widgets

## 19.5 Accessibility Checklist

- [ ] Contrast AA+
- [ ] Focus visible
- [ ] Tab order logical
- [ ] Landmarks present
- [ ] Icons labeled
- [ ] Live regions appropriate
- [ ] Reduced motion respected
- [ ] Target sizes met
- [ ] Errors announced
- [ ] Dialogs trap/restore focus

## 19.6 Responsive Checklist

- [ ] 320–375 width usable
- [ ] Tablet POS/cart behavior
- [ ] No essential horizontal scroll
- [ ] Touch-friendly densification
- [ ] Ultra-wide constrained forms

## 19.7 Dark Mode Checklist

- [ ] Token remap complete
- [ ] Borders visible
- [ ] Charts legible
- [ ] Images/logos variants
- [ ] Autofill styled
- [ ] Print remains light

## 19.8 RTL Checklist

- [ ] `dir` correct
- [ ] Logical properties used
- [ ] Directional icons flipped
- [ ] Nav edge correct
- [ ] Tables/forms OK
- [ ] Menus align correctly
- [ ] Toasts/drawers origin correct

## 19.9 Performance Checklist

- [ ] Heavy charts deferred
- [ ] Images sized
- [ ] Lists virtualized if large
- [ ] No unnecessary client bundles
- [ ] Spinners timeout to error

## 19.10 Design Review Checklist

- [ ] Matches Meridian tokens
- [ ] Reuses existing components
- [ ] One primary action per region
- [ ] Copy tone correct
- [ ] States complete
- [ ] No anti-patterns (§20)
- [ ] Documented if new pattern

## 19.11 Release Checklist

- [ ] Visual QA light/dark/RTL
- [ ] Critical flows E2E
- [ ] A11y smoke
- [ ] No hardcoded secrets/colors
- [ ] Feature flags considered
- [ ] Rollback plan for UI-breaking changes
- [ ] DESIGN-SYSTEM.md updated if contracts changed

---

# 20. Anti Patterns

Never ship these.

## 20.1 UX anti-patterns

1. Placeholder-as-label
2. Mystery meat icon-only navigation without labels/tooltips
3. Destructive action without confirmation
4. Confirmations that don’t state consequences
5. Silent save failures
6. Success toasts for trivial checkbox toggles that clutter
7. Modal stacked on modal stacked on modal
8. Wizards without back/draft
9. Pagination that loses selection unexpectedly without warning
10. Filters that don’t show active state
11. Empty tables with blank white space
12. Fake KPIs / lorem metrics in production
13. Hover-only critical actions on mobile
14. Auto-advancing carousels in ops UIs
15. Timeouts that log users out without preserving draft work when avoidable
16. Ambiguous “Something went wrong”
17. Resetting forms on unrelated re-renders
18. Forcing desktop-only workflows for cashiers
19. Hiding legal/permission denials as empty lists
20. Infinite scroll without return-to-position for audit work

## 20.2 UI anti-patterns

1. Hardcoded hex colors in product components
2. Purple-gradient AI-default aesthetics as system identity
3. Soft cream + terracotta “template” look as default enterprise theme
4. Heavy multi-layer drop shadows everywhere
5. Glow effects on buttons
6. Rounded-full pills for every badge competing visually
7. Decorative glassmorphism reducing contrast
8. Centered everything regardless of task
9. Inconsistent corner radii within a page
10. Dense tables with 10px unreadable type
11. Vertical rhythm broken by arbitrary margins
12. Competing multiple primary buttons
13. Red text for non-errors
14. Low-contrast muted text for primary values
15. Charts without axes/units
16. 3D pies
17. Animated backgrounds
18. Non-semantic heading skips for styling
19. Custom scrollbars that hide overflow affordances poorly
20. Focus outline removed

## 20.3 Interaction anti-patterns

1. Disabled submit with no hint why
2. Buttons that look enabled but aren’t
3. Clicking row does nothing while caret suggests clickability
4. Accidental navigation away destroying cart without guard
5. Double-submit charges
6. Keyboard traps
7. Focus loss on async refresh
8. Tooltips as only source of critical help
9. Gesture-only controls without buttons
10. Swipe actions without visible alternatives

## 20.4 Content anti-patterns

1. Playful failure copy for money errors
2. Blaming the user
3. Untranslated mixed language without rules
4. Truncating Arabic mid-word without access to full string
5. ALL CAPS Arabic labels
6. Exclamation marks everywhere!!!

## 20.5 Engineering anti-patterns

1. Second design system folder
2. Copy-pasting button styles instead of variants
3. `z-index: 99999`
4. Inline styles for theme colors
5. Animating width/height for page transitions
6. Shipping `console.log` spam in POS loops
7. Fetching entire DB tables into client
8. Blocking PDF generation on UI thread without feedback

## 20.6 Accessibility anti-patterns

1. Clickable `div` without role/button
2. `aria-label` mismatches visible text
3. Color-only status
4. Tiny hit areas
5. Missing form labels
6. Motions that ignore reduced-motion
7. Autoplaying media with sound

## 20.7 RTL anti-patterns

1. Physical `left`/`right` positioning for nav
2. Flipping non-directional icons
3. Mirroring digits/charts incorrectly
4. Assuming English string lengths for truncation

## 20.8 Dark mode anti-patterns

1. Pure inversion filters on the whole app
2. Dark print receipts
3. Near-black text on dark navy washes
4. Transparent sticky headers causing unreadable overlap

---

# 21. Future Scalability

## 21.1 10-year evolution model

Meridian is versioned and layered so products can evolve without rewrite:

1. **Tokens** always remain the contract of visual truth
2. **Primitives** stay headless-friendly (Radix-level behavior + Meridian visuals)
3. **Composites** encode product patterns (DataTableShell, PageHeader, SessionBar)
4. **Domain kits** (POS kit, Accounting kit) extend composites without forking tokens
5. **Codegen / Figma libraries** sync naming 1:1 with tokens

## 21.2 Versioning policy

- **MAJOR:** breaking token renames, removed components, contrast-incompatible remaps
- **MINOR:** new components/variants, additive tokens
- **PATCH:** doc clarifications, bugfix visuals

Deprecations require migration notes and minimum one minor grace period.

## 21.3 Multi-brand / white-label

Allowed via token packs (brand primary remap) within contrast rules. Structural patterns stay Meridian. Do not allow customers to break AA.

## 21.4 New platforms

When native mobile apps appear, map Meridian tokens to iOS/Android design tokens; keep interaction principles; adapt components to platform conventions without fragmenting mental models (status colors, terminology).

## 21.5 AI-assisted UI

AI features must use Meridian surfaces: clear disclosure, reversible actions, no free-form “creative” colors. AI suggestions are secondary to operator confirmation for money/stock mutations.

## 21.6 Design ops

- Quarterly audit of anti-pattern regressions
- Token coverage lint rules
- Visual regression snapshots for shell/POS/tables
- Accessibility CI checks
- Contribution RFC process for new patterns

## 21.7 International growth

Add locales without altering layout rules; expand font fallbacks; validate pluralization; keep numeral policy configurable.

## 21.8 What must never fork

Never create “Meridian Lite”, “Meridian ERP-only shadows”, or per-squad color islands. Extend the system; don’t shadow it.

## 21.9 Longevity test

A new engineer in 2036 should open this file, find the token, find the component contract, and ship a settings page without inventing a new card style. If they cannot, the system failed—not the engineer.

## 21.10 Stewardship

Design Systems team (or designated maintainers) owns:

- Token definitions
- Primitive/composite quality
- Documentation
- Review of RFCs
- Deprecation communications

Product squads own domain correctness and may propose extensions via RFC.

---

# Appendix A — Token Quick Reference (CSS)

```css
:root {
  --mds-color-bg-canvas: #f1f5f9;
  --mds-color-bg-surface: #ffffff;
  --mds-color-bg-surface-muted: #f8fafc;
  --mds-color-border-default: #cbd5e1;
  --mds-color-border-focus: #0e7490;
  --mds-color-text-primary: #0f172a;
  --mds-color-text-secondary: #475569;
  --mds-color-text-muted: #64748b;
  --mds-color-action-primary: #0e7490;
  --mds-color-action-primary-hover: #0f5f75;
  --mds-color-feedback-success: #16a34a;
  --mds-color-feedback-warning: #d97706;
  --mds-color-feedback-danger: #dc2626;
  --mds-color-feedback-info: #2563eb;
  --mds-space-1: 4px;
  --mds-space-2: 8px;
  --mds-space-3: 12px;
  --mds-space-4: 16px;
  --mds-space-6: 24px;
  --mds-space-8: 32px;
  --mds-radius-md: 10px;
  --mds-radius-lg: 14px;
  --mds-radius-xl: 18px;
  --mds-font-size-body: 14px;
  --mds-z-modal: 400;
  --mds-motion-fast: 120ms;
  --mds-motion-normal: 200ms;
  --mds-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
}

[data-theme="dark"] {
  --mds-color-bg-canvas: #0b1020;
  --mds-color-bg-surface: #111827;
  --mds-color-bg-surface-muted: #0f172a;
  --mds-color-border-default: #334155;
  --mds-color-text-primary: #f8fafc;
  --mds-color-text-secondary: #94a3b8;
  --mds-color-text-muted: #64748b;
  --mds-color-action-primary: #22d3ee;
  --mds-color-border-focus: #22d3ee;
}
```

# Appendix B — Component Inventory Matrix

| Component | Keyboard | RTL | Dark | Touch | Notes |
|---|---|---|---|---|---|
| Button | ✓ | ✓ | ✓ | ✓ | loading width lock |
| Input | ✓ | ✓ | ✓ | ✓ | label required |
| Textarea | ✓ | ✓ | ✓ | ✓ | |
| Search | ✓ | ✓ | ✓ | ✓ | debounced |
| Password | ✓ | ✓ | ✓ | ✓ | show/hide |
| OTP | ✓ | ✓ | ✓ | ✓ | paste |
| Phone | ✓ | ✓ | ✓ | ✓ | E.164 |
| Currency | ✓ | ✓ | ✓ | ✓ | tabular-nums |
| Select | ✓ | ✓ | ✓ | ✓ | |
| Autocomplete | ✓ | ✓ | ✓ | ✓ | combobox |
| Date Picker | ✓ | ✓ | ✓ | ✓ | locale weeks |
| Time Picker | ✓ | ✓ | ✓ | ✓ | |
| Checkbox | ✓ | ✓ | ✓ | ✓ | indeterminate |
| Radio | ✓ | ✓ | ✓ | ✓ | |
| Switch | ✓ | ✓ | ✓ | ✓ | |
| Segmented Control | ✓ | ✓ | ✓ | ✓ | |
| Badge/Chip/Tag | ✓ | ✓ | ✓ | ✓ | |
| Avatar | ✓ | ✓ | ✓ | ✓ | |
| Card | ✓ | ✓ | ✓ | ✓ | |
| Table/Grid | ✓ | ✓ | ✓ | ✓ | virtualize |
| Pagination | ✓ | ✓ | ✓ | ✓ | |
| Tabs | ✓ | ✓ | ✓ | ✓ | |
| Accordion | ✓ | ✓ | ✓ | ✓ | |
| Modal/Drawer | ✓ | ✓ | ✓ | ✓ | focus trap |
| Tooltip/Popover | ✓ | ✓ | ✓ | cautious | |
| Dropdown | ✓ | ✓ | ✓ | ✓ | |
| Toast/Alert | ✓ | ✓ | ✓ | ✓ | live regions |
| Progress/Skeleton | ✓ | ✓ | ✓ | ✓ | reduced motion |
| Empty/Timeline | ✓ | ✓ | ✓ | ✓ | |
| Calendar/Charts | ✓ | ✓ | ✓ | ✓ | text alt |
| Upload | ✓ | ✓ | ✓ | ✓ | |
| Nav/Sidebar/Topbar | ✓ | ✓ | ✓ | ✓ | |
| Command Palette | ✓ | ✓ | ✓ | ✓ | |
| Notifications | ✓ | ✓ | ✓ | ✓ | |
| Print/Receipt | n/a | ✓ | print-light | n/a | |
| POS set | ✓ | ✓ | ✓ | critical | large targets |
| ERP/Dashboard/Analytics | ✓ | ✓ | ✓ | ✓ | |

# Appendix C — Status Color Mapping (canonical)

| Domain status examples | Semantic |
|---|---|
| Draft | neutral |
| Open / In progress | info |
| Pending approval | warning |
| Approved / Paid / Closed / Active | success |
| Rejected / Failed / Overdue / Void | danger |
| Archived | muted |

Teams may not invent a new color for a synonym of an existing status.

# Appendix D — Content Patterns (Arabic / English)

| Intent | AR example | EN example |
|---|---|---|
| Save | حفظ | Save |
| Cancel | إلغاء | Cancel |
| Delete | حذف | Delete |
| Confirm delete | هل أنت متأكد من حذف هذا العنصر؟ لا يمكن التراجع. | Delete this item? This cannot be undone. |
| Empty list | لا توجد عناصر بعد | No items yet |
| Filtered empty | لا نتائج مطابقة | No matching results |
| Network error | تعذر الاتصال. حاول مرة أخرى. | Connection failed. Try again. |
| Access denied | ليس لديك صلاحية لعرض هذه الصفحة | You don’t have access to this page |
| Offline queued | أنت غير متصل. سيتم إرسال التغييرات عند عودة الاتصال. | You’re offline. Changes will send when back online. |

# Appendix E — Definition of Done (UI)

A UI change is done when:

1. Tokens used exclusively for color/spacing/type/radius/elevation/motion
2. Light + dark verified
3. LTR + RTL verified
4. Keyboard path verified
5. Loading/empty/error/success handled
6. Permissions respected
7. Mobile + desktop verified for the flow
8. No §20 anti-patterns introduced
9. Documentation updated if a new reusable pattern was created
10. Performance acceptable on target hardware

# Appendix F — RFC Template for new patterns

```
Title:
Problem:
Why existing components fail:
Proposed API:
Tokens required:
A11y plan:
RTL plan:
Dark mode plan:
Migration impact:
Screenshots:
```

# Appendix G — Changelog

## 1.0.0 — 2026-07-11

- Initial public internal release of Meridian Design System as single-source `DESIGN-SYSTEM.md`
- Establishes Harbor primary palette, 8pt grid, semantic tokens, component contracts, UX patterns, templates, a11y/RTL/dark rules, checklists, anti-patterns, and 10-year stewardship model

---


---

# Part II — Extended Production Specifications

This part deepens contracts for teams implementing Meridian across ERP, POS, OMS, CRM, HR, inventory, manufacturing, commerce, and admin SaaS. It does not replace Part I; it operationalizes it.

---

# 22. Extended Component Specifications

## 22.1 Button — full contract

**Anatomy:** optional leading icon · label · optional trailing icon · optional keyboard hint · optional loading spinner.

**Sizing table**

| Size | Min height | Pad inline | Font | Icon |
|---|---|---|---|---|
| sm | 32px | 12px | 13px | 16px |
| md | 40px | 16px | 14px | 20px |
| lg | 48px | 20px | 16px | 20px |
| pos | 56px | 24px | 16–18px | 24px |

**Width behavior:** `hug` (default) · `full` (mobile footers, stacked forms).

**Loading:** Replace icon with spinner; keep label or use `aria-label` “Loading”; freeze min-width to prevent layout jump.

**Icon-only:** square hit area matching size; mandatory accessible name.

**Link variant:** Looks like text link; use for inline actions inside paragraphs/tables when weight must stay low.

**Destructive pattern:** Secondary “Cancel” + danger “Delete”. Never danger+primary both competing.

**Do:** Prefer single primary in modal footer.  
**Don’t:** `primary` + another filled brand button beside it.  
**Don’t:** Disable primary on incomplete forms without listing missing fields nearby.

**Example (conceptual):**

```tsx
<Button variant="primary" size="md" loading={pending}>
  {t('save')}
</Button>
```

## 22.2 Input family — shared field contract

All text-like fields share:

| Element | Spec |
|---|---|
| Label | 13–14px medium, margin-bottom 6–8px |
| Control | min-height 40px, radius.md, border.default, bg.surface |
| Focus | border.focus + ring 2px offset 2px |
| Hint | 12px muted, margin-top 6px |
| Error | 12px danger, icon optional, `aria-describedby` |
| Addon | muted surface, border shared, not separately focusable unless button |

**Validation timing:** Prefer on blur + on submit; live validation only for strength meters / OTP.

**Read-only vs disabled:** Read-only is copyable and focusable; disabled is not actionable and skipped or clearly announced.

## 22.3 Search & Command surfaces

**Toolbar search:** width 240–360px desktop; full width mobile.

**Debounce:** 200ms default; 300ms for expensive product search; 0ms for local lists <500 items.

**Results panel:** max-height 320–420px; virtualize beyond 50; highlight match substrings carefully for Arabic (grapheme aware when possible).

**Command palette sections:** Navigation · Actions · Recent · Help. Each item shows icon, title, meta, shortcut.

## 22.4 Select & Autocomplete — decision guide

| Situation | Use |
|---|---|
| ≤7 options, always visible | Radio or Segmented |
| ≤20 static options | Select |
| Large remote list | Autocomplete |
| Multi select large | Autocomplete multi + chips |
| Free text allowed | Combobox allowing create |

**Empty query state:** show recommended/recent, not a blank void.

**Error state:** network error inside popover with Retry.

## 22.5 Date & Time — enterprise rules

- Fiscal period pickers may constrain to open periods
- “Today”, “Yesterday”, “Last 7 days”, “This month” presets for analytics
- Max range guards (e.g., export ≤ 366 days) with clear messaging
- Time zones: display org/store local; store UTC in backend; show abbreviation when ambiguity exists
- Disable future dates when domain forbids (attendance exceptions vary)

## 22.6 Checkbox, Radio, Switch — choosing correctly

| Control | Commit model | Example |
|---|---|---|
| Checkbox | With form submit or immediate if list filter | “Include inactive” |
| Radio | Exclusive in form | Payment method |
| Switch | Immediate setting | “Enable low-stock alerts” |

Switches that trigger costly side effects open a confirm dialog first.

## 22.7 Badge, Chip, Tag — density rules

- Badge: non-interactive status/count
- Chip: interactive filter or selection
- Tag: taxonomy labels, sometimes removable by editors

Max chip row: wrap with gap `space.2`; in tight toolbars collapse into “+3” overflow popover.

## 22.8 Card — when not to use

Do not wrap an entire table page in a card that only adds border. Use `DataTableShell` surface. Cards for KPI, settings sections, empty states, and grouped form sections.

**Interactive card:** role/button or nested link with clear focus; avoid nested interactive conflicts.

## 22.9 Table — column design rules

1. First column: primary identity (name/code) sticky optional
2. Status near identity or near actions—pick one convention per product and keep it
3. Dates: absolute + relative tooltip optional
4. Money: always end-aligned per product numeric rule
5. Actions: inline-end overflow
6. Max recommended visible columns on laptop: 7–9; rest in column picker
7. Totals row uses semibold and muted background
8. Multi-sort only if users ask; default single-sort with clear indicator

**Row height:** comfortable 48px; compact 40px; POS-adjacent 56px.

**Selection:** checkbox column; shift-click range when pointer; “select all filtered” vs “select all pages” explicit.

## 22.10 Data Grid — editing contract

- View mode default; edit on Enter/F2/double-click
- Esc cancels cell; Enter commits and moves down (or configurable)
- Validation errors per cell + summary
- Dirty indicator on row
- Conflict: if server version changed, block overwrite with merge UI

## 22.11 Modal & Drawer — choosing

| Use Modal when | Use Drawer when | Use Page when |
|---|---|---|
| Short confirm/edit | Filters, details, mobile cart | Long multi-section forms |
| User must decide now | Persistent context useful | Deep linking needed |
| ≤ viewport height content | Long vertical content | Wizard with URL steps |

**Modal footer order (LTR):** secondary left, primary right. **RTL:** mirrored via logical `justify`/flex direction—primary at inline-end.

## 22.12 Toast vs Alert vs Banner

| Type | Persistence | Use |
|---|---|---|
| Toast | Temporary | Save succeeded, queued offline |
| Alert | Until resolved/dismissed | Form-level error, partial failure |
| Banner | Session/page | Offline, maintenance, period locked |

## 22.13 Upload — detailed states

1. Idle with limits text  
2. Drag active  
3. Uploading with determinate progress if known  
4. Processing (virus/scan) indeterminate  
5. Success with file row (name, size, remove)  
6. Error with reason + retry  
7. Duplicate detected → replace/keep both

Image upload crops only if product requires consistent aspect; otherwise letterbox in tile.

## 22.14 Navigation — information architecture rules

Group by operator workflow:

1. Daily ops (POS, Orders, Sessions)
2. Catalog & inventory
3. Purchasing & suppliers
4. Customers & loyalty
5. Money (expenses, reports, accounting)
6. People (HR, users)
7. System (settings, audit)

Permission-hidden items never leave empty gaps that reveal existence if security requires concealment—follow product security policy (hide vs disabled-with-tooltip).

## 22.15 POS component kit — detailed

**Category rail:** vertical or horizontal scroll; selected state strong; “All” first.

**Product tile:** image/color fallback · name (2-line clamp) · price · stock warning badge · tap adds; long-press optional favorites—must have alternative.

**Cart panel:** line items with qty steppers · discounts · customer · totals · clear cart confirm · hold/retrieve if exists.

**Payment panel:** tender large tiles · amount due · change · split pay if supported · disable double submit.

**PIN switch:** numeric pad · masked entry · lockout messaging · accessibility labels for digits.

**Weight/amount modal:** unit clarity · keypad · confirm.

**Success dialog:** change due · print/email/share · new sale CTA focused.

## 22.16 ERP document kit — detailed

Document header: number · status pill · supplier/customer · dates · store.  
Lines editor: product autocomplete · qty · UOM · cost/price · tax · line total.  
Footer: subtotal · tax · total · amount due.  
Side audit: created by · approvals · exports.

## 22.17 Dashboard widget kit — detailed

- Widgets declare own error boundaries
- Drag-reorder only if persisted and accessible alternatives exist
- Default layout sensible without customization
- Live Sales pulse: throttle updates; flash row highlight ≤ 1s without seizure risk (no rapid red strobing)

## 22.18 Print & Receipt — detailed

**Print CSS essentials:** hide `[data-print-hide]`; show `[data-print-only]`; black text; remove shadows; page-break-inside avoid for rows when possible.

**Receipt:** store logo monochrome · header · datetime · cashier/session · lines · totals · footer legal · optional QR. Width constraint 280–320 CSS px for 80mm simulation.

---

# 23. Extended UX Flows (step-by-step)

## 23.1 First-time owner onboarding

1. Create org  
2. Create first store  
3. Invite users / set PIN policies  
4. Add categories & products (import optional)  
5. Open first session  
6. Complete first sale in POS  
7. View dashboard proof of life  

Empty states push to the next incomplete step—not generic “Welcome to the future of retail.”

## 23.2 Cashier daily loop

Clock/PIN → readiness checks (session, device, store) → sell → pay → receipt → repeat → close session with counted cash → variance explained → handoff.

## 23.3 Stock count loop

Create count → freeze or snapshot policy → scan/count lines → variance review → approve → post adjustments → audit.

## 23.4 Purchase → receive → pay supplier

PO draft → approve → receive against PO → discrepancies → invoice match → record payment → update supplier balance.

## 23.5 Refund / void

Permission gate → reason codes → restock decision → payment reversal method → receipt → audit.

## 23.6 Approval rejection loop

Reject with reason → notify requester → editable draft reopen → resubmit → prior rejection visible in timeline.

## 23.7 Import customers/products

Template download → upload → validate → preview first N rows + error summary → commit → result report with failed rows export.

## 23.8 Offline POS sale (if feature exists)

Banner offline → allow queued sales per policy → on reconnect sync → conflict list → resolved → banner clear.

## 23.9 User access denial

Route guard → AccessDenied page with requested resource name · how to request access · back to safe home—not blank dashboard pretending.

## 23.10 Destructive bulk delete

Select → Bulk bar “Delete” → modal lists count + sample names → optional type-to-confirm → progress → failures remain selected with errors.

---

# 24. Page Template Wireframes (structural)

Descriptions use regions top→bottom, inline-start→inline-end.

## 24.1 Login

`[Canvas] [Brand] [Title] [Form] [Links] [Language]`

## 24.2 Dashboard

`[Header+Period] [Exception Banner?] [KPI×4] [Main Chart | Live Feed] [Top Products | Quick Actions]`

## 24.3 Table page

`[Header+CTA] [Filters/Search/Chips] [Table] [Pagination]`

## 24.4 Form page

`[Header] [Section cards…] [Sticky Save Bar]`

## 24.5 Settings

`[Title] [Nav sections | Content] [Danger Zone]`

## 24.6 POS

`[Session Bar] [Categories | Products | Cart] [Pay]`

## 24.7 Order detail

`[Back+Title+Status+Actions] [Summary] [Lines] [Payments] [Timeline]`

## 24.8 Customer profile

`[Identity+Credit] [Tabs: Overview | Orders | Loyalty | Notes]`

## 24.9 Inventory

`[KPIs] [Alerts] [Filters] [Stock Table]`

## 24.10 Reports hub

`[Gallery cards by category] → [Report runner]`

## 24.11 HR leave

`[Balance KPIs] [Request CTA] [Requests table] [Calendar]`

## 24.12 Manufacturing work order

`[Status board filters] [WO detail] [BOM] [Scrap entry] [Complete]`

## 24.13 Accounting period close

`[Checklist steps] [Open items] [Lock action] [Export pack]`

## 24.14 Analytics deep dive

`[Controls] [KPI] [Chart] [Table] [Export]`

---

# 25. Interaction Design Details

## 25.1 Feedback latency expectations

| Action | Feedback |
|---|---|
| Button press | immediate pressed state |
| Local toggle | <100ms visual |
| Save small form | pending on button; toast on success |
| Heavy export | start toast + notification when ready |
| POS add item | optimistic cart line instantly |

## 25.2 Optimistic UI rules

Allowed when rollback is safe and obvious. Forbidden for irreversible money movement unless paired with strong reconciliation. Always reconcile with server id/version.

## 25.3 Undo

Offer undo for: archive, remove filter presets, accidental cart clear (short window). Do not fake undo for posted accounting docs—use reversing entries.

## 25.4 Drag and drop

Must be keyboard operable alternative (move up/down buttons). Announce position. Do not rely on drag alone for POS.

## 25.5 Scanning

Global key buffer for barcode scanners on POS; prevent input stealing when in PIN modal; audible optional with reduced-sound respect.

---

# 26. Content Design System

## 26.1 Label grammar

- Buttons: verb / verb+noun (“حفظ”, “إضافة منتج”)
- Titles: noun phrases (“المنتجات”, “Products”)
- Errors: what happened + how to fix
- Success: past tense short

## 26.2 Number & unit grammar

Always pair number with unit where ambiguous (kg, pcs, min). Don’t say “5” alone for weight.

## 26.3 Truncation

Provide `title`/tooltip for truncated critical names. Prefer clamp 1–2 lines. SKUs prefer mono full visible when possible.

## 26.4 Tone matrix examples

| Situation | Bad | Good |
|---|---|---|
| Payment fail | “Oops! Payment broke 💸” | “Payment failed. Try another method or retry.” |
| Delete | “Bye forever!” | “Delete product? Historical orders keep a snapshot.” |
| Empty | “Nothing to see here” | “No open sessions. Open a session to start selling.” |

---

# 27. Security UX

1. PIN pads not logged
2. Mask secrets; allow temporary reveal
3. Session timeout warnings with extend
4. Step-up auth for destructive/high-risk
5. Device pairing codes large and human-friendly
6. Audit log UI never editable
7. Permission errors don’t leak sensitive existence when policy says so
8. Clipboard paste on sensitive fields allowed; auto-clear clipboard optional warning

---

# 28. Multi-store & Tenancy UX

- Active store always visible when data is store-scoped
- Switching store confirms if unsaved work
- Org-level pages labeled “All stores” explicitly
- Reports default to active store unless user expands scope
- Transfers require from/to clarity with direction icons RTL-safe

---

# 29. Density Modes

| Mode | Use | Row height | Type |
|---|---|---|---|
| Comfortable | default admin | 48 | 14 |
| Compact | power accounting | 40 | 13 |
| Touch | POS / floor | 56 | 16 |

User preference stored; POS forces touch density for payment controls.

---

# 30. Form Layout Patterns

**Single column** default for cognitive ease.  
**Two column** only for short related fields (city/country) on ≥md.  
**Sectioned cards** for >8 fields.  
**Inline edit** for tables with few editable cells.  
**Field arrays** (lines) with add/remove and keyboard add.

Required marker: `*` with legend “مطلوب” / “Required” once per form—not only color.

---

# 31. Table Filter Patterns

- Instant filter for cheap local fields
- Apply button for expensive server queries
- URL sync: `?status=open&q=ahmed`
- Saved views: name, shared vs private
- Filter chips removable individually

---

# 32. Chart Token Palette

Ordered series tokens (not rainbow random):

1. Harbor 600  
2. Blue 600  
3. Amber 600  
4. Green 600  
5. Ink 500  
6. Harbor 300  
7. Blue 300  

Always provide direct labels on small-n donuts; avoid legend-only for 2-slice.

---

# 33. Empty State Catalog

| Context | Title pattern | CTA |
|---|---|---|
| Never created | “No X yet” | Create X |
| Filtered | “No results” | Clear filters |
| No permission | AccessDenied | Go back / request |
| Error | “Couldn’t load X” | Retry |
| Offline | “Offline” | Retry / view cached |

---

# 34. Notification Information Architecture

Priorities: Critical (period lock, sync fail) · Action needed (approval) · Informational (export ready).  
Channels: in-app · email · push optional.  
User prefs respect quiet hours if present.  
Aggregation: “15 products low stock” not 15 toasts.

---

# 35. Localization Engineering Companion

- Externalize strings
- Pseudo-loc testing for length
- Arabic plurals
- Avoid string concatenation for sentences
- Bidirectional isolate for mixed embeds when needed (`dir=auto` carefully)

---

# 36. Testing Scenarios (must-pass samples)

1. Login → role routing  
2. POS sale cash + receipt  
3. POS credit path limits  
4. Open/close session variance  
5. Table filter + RTL  
6. Modal focus trap + Esc  
7. Dark mode contrast on danger button  
8. Upload reject oversized file  
9. AccessDenied on forbidden route  
10. Keyboard-only customer search select  

---

# 37. Governance

**RFC required for:** new global component, token rename, status color remap, navigation IA change, density mode addition.

**Not RFC:** domain page composition using existing components, copy tweaks, bug fixes.

**Reviewers:** design systems maintainer + squad lead. A11y specialist for widgets with new keyboard models.

---

# 38. Migration from ad-hoc UI

1. Inventory hardcoded colors → map to tokens  
2. Replace one-off buttons with Button variants  
3. Wrap tables in DataTableShell  
4. Normalize modal footers  
5. Add missing empty/error states  
6. Verify RTL/dark  
7. Delete dead CSS  

Migrate module by module; do not big-bang rewrite without product approval.

---

# 39. Figma / Design Tool Parity Rules

- Layer names match component names
- Variables bind to token names identically (`mds/color/action/primary`)
- Component properties mirror variant APIs
- Document breakpoints in frames: 375, 768, 1280
- Provide RTL mirrored frames for shell/POS/table
- Annotate a11y notes on complex widgets

---

# 40. Quality Bars by Surface

| Surface | Bar |
|---|---|
| Marketing landing | Brand expression allowed within anti-pattern limits |
| Auth | Clarity + security UX |
| Admin shell | Consistency + density |
| POS | Speed + touch + session safety |
| Finance | Precision + auditability |
| Print | Legibility + ink efficiency |
| Public menu | Brand + performance + mobile |

---



---

# Part III — Exhaustive Reference

## 41. Complete Semantic Token Tables

### 41.1 Background tokens

| Token | Light | Dark | High contrast light | High contrast dark |
|---|---|---|---|---|
| `bg.canvas` | `#F1F5F9` | `#0B1020` | `#FFFFFF` | `#000000` |
| `bg.surface` | `#FFFFFF` | `#111827` | `#FFFFFF` | `#000000` |
| `bg.surface-muted` | `#F8FAFC` | `#0F172A` | `#F0F0F0` | `#0A0A0A` |
| `bg.surface-sunken` | `#E2E8F0` | `#020617` | `#E0E0E0` | `#000000` |
| `bg.overlay` | `rgba(15,23,42,.48)` | `rgba(0,0,0,.64)` | `rgba(0,0,0,.72)` | `rgba(0,0,0,.8)` |
| `bg.primary-subtle` | `#ECFEFF` | `#083344` | `#D9F7FA` | `#001820` |
| `bg.success-subtle` | `#F0FDF4` | `#052e16` | `#DCFCE7` | `#001a00` |
| `bg.warning-subtle` | `#FFFBEB` | `#422006` | `#FEF3C7` | `#1a1000` |
| `bg.danger-subtle` | `#FEF2F2` | `#450a0a` | `#FEE2E2` | `#1a0000` |
| `bg.info-subtle` | `#EFF6FF` | `#172554` | `#DBEAFE` | `#00081a` |

### 41.2 Text tokens

| Token | Light | Dark | Notes |
|---|---|---|---|
| `text.primary` | `#0F172A` | `#F8FAFC` | Body/headings |
| `text.secondary` | `#475569` | `#94A3B8` | Supporting |
| `text.muted` | `#64748B` | `#64748B` | Meta; verify pairs |
| `text.disabled` | `#94A3B8` | `#475569` | |
| `text.inverse` | `#FFFFFF` | `#0F172A` | On filled primary (dark may use ink.900 on cyan) |
| `text.link` | `#0E7490` | `#22D3EE` | Underline on hover/focus |
| `text.success` | `#15803D` | `#4ADE80` | |
| `text.warning` | `#B45309` | `#FBBF24` | |
| `text.danger` | `#B91C1C` | `#F87171` | |
| `text.info` | `#1D4ED8` | `#93C5FD` | |

### 41.3 Border tokens

| Token | Light | Dark |
|---|---|---|
| `border.default` | `#CBD5E1` | `#334155` |
| `border.strong` | `#94A3B8` | `#475569` |
| `border.muted` | `#E2E8F0` | `#1E293B` |
| `border.focus` | `#0E7490` | `#22D3EE` |
| `border.danger` | `#DC2626` | `#F87171` |
| `border.success` | `#16A34A` | `#4ADE80` |

### 41.4 Action tokens

| Token | Light | Dark |
|---|---|---|
| `action.primary` | `#0E7490` | `#22D3EE` |
| `action.primary-hover` | `#0F5F75` | `#67E8F9` |
| `action.primary-pressed` | `#155E75` | `#A5F3FC` |
| `action.primary-text` | `#FFFFFF` | `#083344` |
| `action.danger` | `#DC2626` | `#EF4444` |
| `action.danger-hover` | `#B91C1C` | `#F87171` |
| `action.danger-text` | `#FFFFFF` | `#FFFFFF` |

### 41.5 Spacing applied recipes

| Recipe | Value | Use |
|---|---|---|
| Control gap | `space.2` | icon-label |
| Form field stack | `space.4` | between fields |
| Form section stack | `space.6` | between sections |
| Page section stack | `space.8` | between page blocks |
| Card padding comfortable | `space.6` | settings cards |
| Card padding compact | `space.4` | dense dashboards |
| Table cell padding | `12px 16px` | default |
| Modal padding | `space.6` | body |
| Shell gutter mobile | `space.4` | |
| Shell gutter desktop | `space.8` | |

### 41.6 Typography recipes

| Recipe | Spec |
|---|---|
| Page title | 24px/30px semibold tight tracking text.primary |
| Section title | 18px semibold text.primary |
| Card title | 16px semibold |
| Body | 14px/1.5 regular |
| Label | 13–14px medium |
| Helper | 12px muted |
| Table header | 12px semibold secondary |
| Table cell | 14px |
| KPI value | 30px semibold tabular-nums |
| KPI label | 12px muted |
| Mono ID | 13px mono |
| Button md | 14px semibold |
| POS total | 28–36px semibold tabular-nums |

---

## 42. Component Accessibility Matrix (detailed)

| Component | Role | Key keys | Labels | Live region | Focus mgmt |
|---|---|---|---|---|---|
| Button | button/link | Enter Space | visible or aria-label | no | natural |
| Icon Button | button | Enter Space | aria-label required | no | natural |
| Input | textbox | printable | label for= | no | natural |
| Search combobox | combobox | arrows Enter Esc | label | polite optional | listbox |
| Select | button+listbox | arrows Enter Esc | label | no | panel |
| Checkbox | checkbox | Space | label | no | natural |
| Switch | switch | Space | label | no | natural |
| Tabs | tablist | arrows Home End | tab names | no | roving |
| Modal | dialog | Esc Tab | aria-labelledby | no | trap+restore |
| Drawer | dialog/ Complementary | Esc Tab | title | no | trap if modal |
| Toast | status/alert | - | text | polite/assertive | no steal |
| Tooltip | tooltip | Esc | content | no | on focus |
| Menu | menu | arrows Enter Esc | item names | no | roving |
| Table sort | button in th | Enter | aria-sort | no | natural |
| Pagination | navigation | Enter | page names | no | natural |
| Progress | progressbar | - | aria-valuetext | optional | n/a |
| Upload | button+region | Enter | instructions | polite progress | natural |
| Command palette | dialog+combobox | arrows Enter Esc | search | no | trap |
| Date grid | grid | arrows PageEnter | dates | no | roving |
| POS keypad | group buttons | digits Enter | digit labels | no | natural |

---

## 43. Keyboard Shortcut Conventions

Shortcuts must be customizable or disableable when they conflict with IME/Arabic typing. Defaults:

| Shortcut | Action | Context |
|---|---|---|
| `/` | Focus page search | Lists (when not typing in field) |
| `Ctrl/⌘ K` | Command palette | Global |
| `?` | Shortcut help | Global |
| `Esc` | Close overlay / clear | Overlays |
| `Ctrl/⌘ S` | Save | Forms (if no browser conflict handled) |
| `n` | New entity | Lists when not typing |
| `g then d` | Go dashboard | Optional chord |
| `g then p` | Go POS | Optional |

Document chords in help overlay. Never override text-field typing.

---

## 44. Focus Ring Specification

- Width: 2px
- Offset: 2px
- Color: `border.focus`
- Style: solid
- Apply on `:focus-visible`
- High contrast: 3px
- Never rely on browser default alone after reset
- Inverse surfaces: use `ink.0` ring with dark offset if needed for contrast

---

## 45. Elevation + Border Pairing Rules

| Surface | Elevation | Border |
|---|---|---|
| Canvas | 0 | none |
| Card resting | 1 or 0 | default |
| Sticky header | 1 | muted bottom |
| Dropdown | 2 | default |
| Modal | 3 | default |
| Toast | 3 | default |

If elevation ≥2, border still present for dark mode clarity.

---

## 46. State Styling Recipes

### Destructive confirm modal

Title: clear object name  
Body: consequence  
Optional: type name to confirm for high risk  
Footer: Cancel + Danger Confirm  
Focus: Cancel by default for irreversible extreme risk; Confirm for mild archive—product chooses; document choice.

### Permission denied

Icon · title · description · primary “Back” · secondary “Request access” if exists · no sidebar highlight pretending access.

### Conflict (409)

Explain versions · show diff if possible · Reload / Overwrite (permissioned) / Merge.

### Validation summary

When >3 field errors, show alert summary with anchors jump-to-field + inline errors.

---

## 47. POS Visual Spec

- Payment tiles: min 56px height, radius xl, strong selected border
- Product grid: 2 cols phone, 3–4 tablet, 4–6 desktop
- Cart line qty control: 40px hits
- Total due: largest text in cart
- Session bar: always visible; color only as reinforcement with text status
- Blocking readiness: full-screen gate with next action

---

## 48. ERP Document Status Machine (UI)

Visual only—domain owns transitions:

`draft → pending_approval → approved → posted → void`

Each state maps Appendix C colors. Invalid transitions hide actions rather than error after click when possible; if race, show conflict.

---

## 49. Data Table Shell Anatomy

```
DataTableShell
├─ Toolbar (title optional, search, filters, column picker, export)
├─ BulkBar (appears on selection)
├─ Table
│  ├─ Header (sticky)
│  ├─ Body
│  └─ Footer totals optional
├─ Pagination
└─ States: Loading | Empty | Error | FilteredEmpty
```

---

## 50. Form Shell Anatomy

```
FormShell
├─ Header
├─ Alert (optional)
├─ Sections[]
│  ├─ SectionTitle
│  └─ Fields
├─ StickyActions (Cancel/Save)
└─ UnsavedGuard
```

---

## 51. Responsive Behavior Catalog

| Pattern | <md | ≥md | ≥lg |
|---|---|---|---|
| Sidebar | off-canvas | collapsible | expanded default |
| Filters | drawer | inline | inline |
| Table | cards/priority | scroll+sticky | sticky+dense |
| KPI | 1 col | 2 col | 4 col |
| Modal | fullscreen sheet | centered | centered |
| POS cart | sheet | sheet/side | side panel |
| Settings nav | top tabs | left nav | left nav |
| Page actions | bottom sticky optional | header | header |

---

## 52. RTL Implementation Cookbook

**Tailwind/logical:** prefer `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`, `border-s`.

**Icons:**

```tsx
<ChevronIcon className="rtl:rotate-180" /> // only for directional
```

**Menus:** align `end` in LTR for row actions; logical end works in both.

**Toasts:** typically stack in a corner; use `inset-inline-end` + `top`.

**Charts (SVG):** set text-anchor carefully; flip axes with direction libraries when needed.

**Examples of forbidden CSS:** `margin-left: 16px` for icon spacing; use `margin-inline-start`.

---

## 53. Dark Mode Implementation Cookbook

```html
<html data-theme="dark" lang="ar" dir="rtl">
```

Switch:

1. Write preference to profile/local  
2. Set `data-theme`  
3. Tokens cascade  
4. Persist across sessions  

Test components on `bg.canvas` and `bg.surface`. Status washes must keep text contrast.

Avoid `filter: invert(1)` on the root.

---

## 54. Chart Accessibility Companion

Every chart ships with:

1. Visible title  
2. Summary sentence (“Sales rose 12% vs last week”)  
3. Data table toggle  
4. Keyboard focusable points or rely on table  
5. Pattern fills when printing B&W  

---

## 55. Performance Playbook by Route Type

| Route type | Strategy |
|---|---|
| POS | preload catalog chunk; virtualize tiles; optimistic cart |
| Dashboard | defer secondary widgets; stream KPIs |
| Reports | lazy charts; async run |
| Settings | light forms; no chart libs |
| Admin tables | paginate server-side; column virtualize if huge |

---

## 56. Anti-Pattern Enforcement (lint ideas)

- Ban raw hex in `src/modules/**` and `src/components/**` except token files
- Ban `outline-none` without `focus-visible` ring utility
- Ban `ml-`/`mr-` in new files (prefer logical)
- Ban `z-[9` arbitrary extremes
- Warn on `<div onClick` without role

---

## 57. Design Review Scoring Rubric

Score 1–5 each: Clarity · Consistency · Accessibility · RTL · Density · Feedback states · Performance risk · Copy quality. Ship threshold: no 1s; average ≥4; a11y ≥4.

---

## 58. Sample Do/Don’t Boards

### Buttons
Do: one primary “ترحيل”  
Don’t: primary “ترحيل” beside primary “حفظ” beside primary “اعتماد”

### Tables
Do: “No results” + Clear filters  
Don’t: empty `<tbody>` with zero explanation

### Forms
Do: “Password must be at least 8 characters”  
Don’t: red border only

### POS
Do: disable Pay while request in flight  
Don’t: allow double tap double charge

### Dark
Do: cyan primary on dark with dark text  
Don’t: dark navy button text on dark navy background

### RTL
Do: back chevron points inline-start  
Don’t: back chevron always points left physically

---

## 59. Extended Page Checklists (domain)

### POS release checklist
- [ ] Readiness gates
- [ ] Session visible
- [ ] Catalog search + barcode
- [ ] Cart edit qty
- [ ] Pay cash/card/credit paths used by product
- [ ] Receipt print
- [ ] PIN switch
- [ ] Offline banner if applicable
- [ ] Touch targets
- [ ] RTL

### Inventory release checklist
- [ ] Store scope
- [ ] Low stock alerts accurate
- [ ] Transfer direction clarity
- [ ] Count variance approval
- [ ] Units correct
- [ ] Audit

### Accounting release checklist
- [ ] Period lock banner
- [ ] Money formatting
- [ ] Reversals not silent deletes
- [ ] Export totals match UI
- [ ] Permissions

### HR release checklist
- [ ] PII masking
- [ ] Leave balances
- [ ] Approval path
- [ ] Document upload limits

---

## 60. Glossary

| Term | Meaning |
|---|---|
| Token | Named design value |
| Semantic token | Purpose-based token |
| Primitive | Base UI atom |
| Composite | Product-level assembled component |
| Shell | App chrome (nav/header) |
| Operational surface | POS-like fullscreen work mode |
| Density | Spacing/type compaction level |
| Scrim | Overlay backdrop |
| Live region | ARIA polite/assertive announcements |
| Logical properties | CSS start/end vs left/right |
| RFC | Request for comments to change the system |

---

## 61. Component Example Specs (descriptive)

**Button primary loading:** Harbor fill, inverse text, spinner 16px, label “جاري الحفظ…”, `aria-busy=true`, disabled pointer interactions, still readable.

**Input error:** border.danger, message “أدخل رقم هاتف صالح”, `aria-invalid=true`, focus moves to first invalid on submit.

**Table selected row:** bg selection, checkbox checked, bulk bar shows count.

**Toast undo:** “Customer archived” + action Undo 5s.

**Modal destructive:** title “حذف المورد؟”, body explains open balances block delete if business rule, danger button disabled until resolved.

**Empty products:** illustration optional, title “لا منتجات بعد”, CTA “إضافة منتج”, secondary “استيراد”.

**Chart empty:** “No sales in this period”, CTA adjust period.

**Sidebar collapsed:** icons only, tooltips on focus/hover, active indicator bar inline-start.

**Command palette no results:** “Nothing found for ‘xyz’”, suggest clear.

**OTP paste:** pasting `123456` fills all and may auto-submit if product allows.

**Currency input:** shows `E£` / org currency, rejects third decimal for EGP if policy 2.

**Date range:** presets + calendars; invalid range error “End date must be after start date”.

**Switch with confirm:** turning on “Force close sessions” opens confirm explaining audit impact.

**Upload drag:** border.focus dashed, text “Drop files to upload”.

**Pagination:** “عرض 1–50 من 1,284” / “Showing 1–50 of 1,284”.

**Badge overdue:** danger subtle bg + danger text + clock icon.

**Avatar fallback:** initials from name, deterministic color from tokenized palette set (not random rainbow), contrast checked.

**Tooltip on truncated SKU:** full SKU on focus.

**Popover column picker:** checkboxes, Apply, Reset defaults.

**Alert period locked:** warning, “You can’t post in a locked period”, link to accounting.

**Skeleton table:** 5 rows gray bars matching columns.

**Timeline approval:** dots + connector, success/danger icons, actor+time.

**Calendar leave:** selected range wash primary-subtle.

**File list:** name, size, progress, remove.

**Breadcrumb:** Home / Inventory / Transfer #1024 current.

**Notifications drawer:** unread bold, mark all read, deep link.

**Print invoice:** logo, columns aligned, totals bold, page footer number.

**Receipt:** 32–40 char width feel, totals emphasized, thank-you line brief.

**POS product tile out of stock:** muted, badge “نفد”, optional block add.

**ERP approval inbox:** list with amount, requester, age; open shows diff.

**Dashboard KPI negative delta:** danger text with down icon and “vs prior period”.

**Analytics compare mode:** two series Harbor + Blue, legend clear.

---

## 62. Long-form Enterprise UX Principles (expanded)

### Reduce decision thrash
Operators should not re-decide layout, color meaning, or button placement across modules. Meridian’s consistency is a productivity feature.

### Make the costly mistake hard
Money, stock, permissions, and privacy need friction. Friction is not bad UX when it prevents irreversible harm; unlabelled friction is bad UX.

### Show the system state
Offline, syncing, locked period, unread approvals—state is part of the UI, not a hidden log.

### Design for interruption
POS users are interrupted constantly. Preserve cart drafts. Confirm navigations that lose money context.

### Respect bilingual operators
Many users mix Arabic UI with Latin SKUs and English brand names. Layouts must tolerate mixed scripts in one row without overflow disasters.

### Prefer boring excellence
The best enterprise UI is remembered for absence of pain, not presence of novelty.

---

## 63. Visual QA Script

1. Open page in light LTR  
2. Toggle dark  
3. Toggle RTL  
4. Keyboard-only complete primary task  
5. Zoom 200%  
6. Throttle network; check loading/error  
7. Mobile width 375  
8. Tablet 768  
9. Desktop 1440  
10. Print preview if printable  

Record defects with severity: blocker / major / minor.

---

## 64. Contribution Workflow

1. Propose RFC if needed  
2. Implement tokens/components  
3. Add docs to this file in same PR  
4. Visual QA script  
5. A11y check  
6. Review approval  
7. Version bump note in Appendix G  

---

## 65. Compatibility with Existing SweetFlow Codebases

When Meridian is applied onto an existing SweetFlow/CafeFlow codebase:

- Map existing CSS variables to Meridian semantic tokens gradually
- Keep `src/components/sweetflow/*` composites as Meridian composites with renamed docs
- Do not introduce a second parallel button language
- Prefer adapter layers over rewrite
- Update `docs/DESIGN_SYSTEM.md` to point to this file as normative if product adopts Meridian fully

---

## 66. Final Normative Statement

Meridian Design System 1.0 defines the visual, interaction, accessibility, and engineering contracts for Hakimo-built operational software. Products may specialize through domain kits; they may not contradict core tokens, a11y floors, RTL rules, or anti-patterns without an approved major version change.

Clarity under pressure. Consistency under scale. Accessibility without exception.



## 67. Pattern Playbooks (expanded)

### 67.1 Login playbook
- Fields: identifier, password
- Optional: remember device (security-reviewed), language
- Errors: inline + summary
- Post-auth redirect matrix by role
- Lockout UX with countdown
- SSO button secondary if present
- Footer: privacy, terms

### 67.2 CRUD list playbook
Header CTA Create · Search · Filters · Table · Pagination · Row → Detail  
Bulk: export, status change, delete  
Row actions: view, edit, more  

### 67.3 Wizard playbook
Steps named · progress · continue/back · save draft · summary · commit · success page with next actions  

### 67.4 Checkout / pay playbook
Review lines · choose tender · enter amount · confirm · result · receipt · new sale  

### 67.5 Approval playbook
Queue · open · inspect · approve/reject · reason · notify · audit  

### 67.6 Settings playbook
Section nav · forms · save · toast · danger zone separate  

### 67.7 Import playbook
Template · upload · validate · preview · commit · report  

### 67.8 Export playbook
Params · format · run · download/notify · permissioned  

### 67.9 Search playbook
Query · filters · results · empty · error · recent  

### 67.10 Error recovery playbook
Detect class → present message → offer retry/fix/support code → preserve data  

### 67.11 Offline playbook
Detect → banner → queue or readonly → sync → conflicts → clear  

### 67.12 Bulk actions playbook
Select → bar → confirm → progress → per-row errors → done  

### 67.13 Profile playbook
Identity · security · sessions list revoke · preferences theme/lang · notifications  

### 67.14 Notifications playbook
Bell · drawer · unread · deep link · mark read · prefs  

### 67.15 File upload playbook
Limits · select/drag · progress · virus · success/error · remove  

---

## 68. Template Field Inventories

### Login fields
identifier · password · submit · forgot link · language

### Customer form fields (typical)
name · phone · email optional · tax id optional · credit limit · notes · active

### Product form fields (typical)
name · SKU · category · price · cost · tax · unit · track stock · images · variants · recipe

### Purchase form fields
supplier · store · lines (product, qty, cost) · notes · dates · submit

### Expense form fields
category · amount · date · store · payment method · attachment · notes

### Employee form fields
name · role · phone · store access · start date · documents

### Work order fields
product · qty · BOM snapshot · machine · schedule · scrap · complete

---

## 69. Microcopy Library (extendable)

| Key | AR | EN |
|---|---|---|
| action.save | حفظ | Save |
| action.cancel | إلغاء | Cancel |
| action.edit | تعديل | Edit |
| action.delete | حذف | Delete |
| action.create | إضافة | Add |
| action.export | تصدير | Export |
| action.import | استيراد | Import |
| action.approve | اعتماد | Approve |
| action.reject | رفض | Reject |
| action.retry | إعادة المحاولة | Retry |
| action.clear_filters | مسح الفلاتر | Clear filters |
| status.draft | مسودة | Draft |
| status.open | مفتوحة | Open |
| status.closed | مغلقة | Closed |
| status.paid | مدفوعة | Paid |
| status.pending | قيد الانتظار | Pending |
| empty.generic | لا توجد بيانات | No data |
| error.generic | حدث خطأ. حاول مرة أخرى. | Something went wrong. Try again. |
| error.network | تعذر الاتصال بالشبكة | Network connection failed |
| confirm.delete_title | تأكيد الحذف | Confirm delete |
| unsaved.title | تغييرات غير محفوظة | Unsaved changes |
| unsaved.body | هل تريد مغادرة الصفحة بدون حفظ؟ | Leave without saving? |
| offline.banner | أنت غير متصل | You are offline |
| syncing.banner | جاري المزامنة… | Syncing… |

---

## 70. Motion Catalog (allowed)

| Name | Properties | Duration | When |
|---|---|---|---|
| fade-in | opacity | fast/normal | overlays |
| fade-out | opacity | fast/normal | dismiss |
| slide-in-inline-end | transform+opacity | normal | drawers |
| scale-in | scale .98→1 + opacity | normal | modals |
| press | scale 1→.98 | instant/fast | buttons |
| row-highlight | bg wash | slow | live feed |
| skeleton-pulse | opacity | deliberate | loading (disable if reduced) |

Forbidden: bounce, flip-3d, parallax, continuous attention-grabbing pulses on critical danger.

---

**End of Meridian Design System 1.0.0**

This document is normative. When code and documentation disagree, fix the code—or intentionally revise this document with versioning. Do not leave divergence untracked.
