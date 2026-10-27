---
name: Juris Corporate Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf4'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d4e4fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#43474e'
  inverse-surface: '#223144'
  inverse-on-surface: '#eaf1ff'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#455f88'
  primary: '#002045'
  on-primary: '#ffffff'
  primary-container: '#1a365d'
  on-primary-container: '#86a0cd'
  inverse-primary: '#adc7f7'
  secondary: '#555f71'
  on-secondary: '#ffffff'
  secondary-container: '#d6e0f6'
  on-secondary-container: '#596376'
  tertiary: '#002625'
  on-tertiary: '#ffffff'
  tertiary-container: '#003d3c'
  on-tertiary-container: '#4cadab'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#adc7f7'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#2d476f'
  secondary-fixed: '#d9e3f9'
  secondary-fixed-dim: '#bdc7dc'
  on-secondary-fixed: '#121c2c'
  on-secondary-fixed-variant: '#3d4759'
  tertiary-fixed: '#94f2f0'
  tertiary-fixed-dim: '#77d6d3'
  on-tertiary-fixed: '#00201f'
  on-tertiary-fixed-variant: '#00504e'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d4e4fc'
typography:
  display:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  title-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered for modern, mission-critical legal software and compliance SaaS platforms. Its identity conveys authoritative security, intellectual clarity, and institutional trust without succumbing to the antiquated aesthetics of legacy legal software.

The philosophy builds upon the structured, utility-first clarity of Chakra UI:
- **Sobriety over decoration:** Every line, border, and elevation level serves an explicit functional role in data comprehension and document workflow integrity.
- **Atmospheric Trust:** Dense information (dockets, contract redlines, audit trails, multi-step compliance workflows) is balanced with generous whitespace, crisp slate borders, and deep corporate blues.
- **Architectural Style:** A blend of **Corporate / Modern** and **Tonal Minimalism**. Structural layout borders (`#E2E8F0`) anchor high-density data tables, subtle inset focus halos prevent user error, and crisp typographic hierarchy reduces legal review fatigue.

## Colors

The palette establishes an immediate foundation of confidence, rigor, and technical reliability.

### Primary, Secondary & Accent Roles
- **Primary (`#1A365D`)**: Deep Corporate Navy. Applied to core navigational frameworks, high-priority interactive buttons, authoritative headers, and active state indicators.
- **Primary Hover (`#2C5282`)**: Accessible mid-navy for direct hover interaction on primary controls.
- **Secondary (`#2D3748`)**: Charcoal Slate. Used for secondary actions, structural tabs, segmented controls, and secondary emphasis containers.
- **Tertiary / Accent (`#319795`)**: Deep Teal/Cyan. Applied sparingly for high-value metrics, signature readiness indicators, verification highlights, and subtle data visualization accents.

### Neutral System & Surfaces
- **App Canvas (`#F7FAFC`)**: Soft, anti-glare neutral for main application layout backgrounds.
- **Surface Elevation (`#FFFFFF`)**: Pure white for cards, modal dialogs, data grids, and document workspaces.
- **Border Default (`#E2E8F0`)**: Subtle architectural separation rule for inputs, tables, dividers, and card envelopes.
- **Border Subtle (`#EDF2F7`)**: Secondary structural dividers within cards and sub-menus.
- **Text Primary (`#1A202C`)**: High-contrast, fatigue-free dark charcoal for continuous reading.
- **Text Secondary (`#718096`)**: Crisp slate for metadata, labels, table subheaders, and helper copy.
- **Text Muted (`#A0AEC0`)**: Subtle tone for placeholders, disabled states, and auxiliary timestamps.

### Semantic & Feedback System
- **Success (`#38A169`)**: Verification tags, signed document badges, completed pipeline steps. Background tint: `#F0FFF4`, Border: `#C6F6D5`.
- **Security / Interactive Active (`#3182CE`)**: System alerts, authentication checkpoints, and link targets.
- **Info Callout**: Background `#EBF8FF`, Border `#BEE3F8`, Text `#2B6CB0`.
- **Warning / Alert (`#DD6B20`)**: Expiring clauses, unverified signatories. Background `#FFFAF0`, Border `#FEEBC8`.
- **Destructive / Error (`#E53E3E`)**: Contract breach flags, voided actions, form invalidation. Background `#FFF5F5`, Border `#FED7D7`.

## Typography

Typography prioritizes legibility, scanning velocity, and legal precision across complex tabular and prose layouts.

- **Typeface**: `Inter` is universally applied across display, body, and label roles. Its geometric neutral chassis, tall x-height, and open counters keep legal contract clauses and docket numbers legible even in dense tables.
- **Weights & Hierarchy**:
  - `700 (Bold)`: Exclusively for display dashboards and empty-state headlines.
  - `600 (SemiBold)`: Standard for all headers, card titles, table headings, and primary interactive elements.
  - `500 (Medium)`: Form labels, stepper headers, navigation anchors, and status badges.
  - `400 (Regular)`: Body copy, legal contract paragraphs, terms and conditions, and form placeholders.
- **Numbers & Data Values**: Numeric data within financial settlements, legal clause sequences, and execution dates utilize tabular numerals (`font-variant-numeric: tabular-nums`) to ensure strict vertical column alignment across enterprise tables.

## Layout & Spacing

The design system implements a disciplined 8-point base spatial rhythm tailored for operational legal dashboards.

### Grid & Breakpoints
- **Desktop (≥ 1280px)**: 12-column fluid grid. Outer margin `2rem` (`32px`), column gutter `1.5rem` (`24px`). Collapsible navigation sidebar (fixed 260px expanded, 72px iconified).
- **Tablet (768px – 1279px)**: 8-column grid. Outer margin `1.5rem` (`24px`), column gutter `1rem` (`16px`). Navigation collapses to an off-canvas drawer.
- **Mobile (< 768px)**: 4-column grid. Outer margin `1rem` (`16px`), column gutter `1rem` (`16px`). Workspaces stack vertically; side-by-side legal comparison tools collapse into toggleable segmented views.

### Spacing Philosophy
- `space-xs` (4px): Icon-to-text gaps within inline badges, close triggers, and stepper connectors.
- `space-sm` (8px): Form input inner vertical padding, spacing between stacked list items, segmented button padding.
- `space-md` (16px): Input horizontal padding, spacing between standard form groups, modal internal margins.
- `space-lg` (24px): Card interior padding, section separation within documents.
- `space-xl` (32px): Primary dashboard row gaps and legal workflow block division.

## Elevation & Depth

This design system avoids high-contrast skeuomorphism and excessive blur radii. Depth is achieved via crisp borders paired with subtle, cold-tinted ambient shadows inspired by Chakra UI's clean enterprise elevations.

- **Level 0 (Flat)**: Background `#F7FAFC`. Structural page dividers use `1px solid #E2E8F0` with no shadow.
- **Level 1 (Card & Containers)**: Surface `#FFFFFF`, border `1px solid #E2E8F0`, shadow `0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)`. Used for base cards, data grids, and resting dropzones.
- **Level 2 (Dropdowns & Popovers)**: Surface `#FFFFFF`, border `1px solid #E2E8F0`, shadow `0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -1px rgba(0, 0, 0, 0.04)`. Used for auto-completes, context menus, and active calendar datepickers.
- **Level 3 (Modals & Drawers)**: Surface `#FFFFFF`, border `1px solid #CBD5E0`, shadow `0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.03)`. Backed by an overlay scrim of `rgba(26, 32, 44, 0.45)` with `backdrop-filter: blur(2px)`.
- **Focus Halos**: Interactive controls receive an outer ring of `0 0 0 3px rgba(49, 130, 206, 0.35)` with an inner border of `#3182CE` on focus-visible states.

## Shapes

The design system employs a refined, subdued curvature philosophy (Level 1 - Soft) aligned with enterprise precision.

- **Base Radius (`rounded-md`, 6px / 0.375rem)**: Standard corner radius for input fields, buttons, dropdown items, switches, and table header rows. Provides a crisp, modern look without looking childish or overtly organic.
- **Card & Modal Radius (`rounded-lg`, 8px / 0.5rem)**: Applied to cards, dialogue panels, document preview containers, and dropzones.
- **Pill Radius (`rounded-full`, 9999px)**: Reserved strictly for small analytical tags, status badges, signatory avatars, and toggle switch thumbs.

## Components

### Buttons
- **Primary**: Background `#1A365D`, text `#FFFFFF`, border `1px solid transparent`, radius `6px`, font `label-md` (500). Hover `#2C5282`. Active `#1A202C`. Focus ring `3px rgba(49, 130, 206, 0.4)`.
- **Secondary**: Background `#FFFFFF`, text `#2D3748`, border `1px solid #E2E8F0`. Hover `#F7FAFC` with border `#CBD5E0`. Active `#EDF2F7`.
- **Ghost / Tertiary**: Transparent background, text `#2B6CB0`. Hover `#EBF8FF`.
- **Destructive**: Background `#E53E3E`, text `#FFFFFF`. Hover `#C53030`.

### Form Inputs & Selects
- Height `40px` (md) / `32px` (sm). Border `1px solid #E2E8F0`, surface `#FFFFFF`, text `#1A202C`, placeholder `#A0AEC0`, radius `6px`.
- **Hover**: Border `#CBD5E0`.
- **Focus**: Border `#3182CE`, box-shadow `0 0 0 3px rgba(49, 130, 206, 0.25)`.
- **Error State**: Border `#E53E3E`, focus box-shadow `0 0 0 3px rgba(229, 62, 62, 0.25)`.

### Steppers (Legal Workflows & Filings)
- Horizontal and vertical orientations.
- **Active Step**: Solid circle `#1A365D` with white numerical indicator or icon; step title in `14px` SemiBold (`#1A365D`).
- **Completed Step**: Solid circle `#38A169` featuring checkmark icon; connecting track line filled with `#38A169`; label `#2D3748`.
- **Inactive Step**: Hollow circle border `2px solid #E2E8F0`, surface `#FFFFFF`, text `#A0AEC0`; label `#718096`.

### Badges & Status Chips
- Clean, muted tint backgrounds with border matching the parent state.
- **Structure**: Inline flex, height `24px`, padding `0 8px`, border-radius `9999px`, typography `label-sm`.
- **Variants**:
  - Success: Bg `#F0FFF4`, border `#C6F6D5`, text `#22543D`.
  - Info / Review: Bg `#EBF8FF`, border `#BEE3F8`, text `#2B6CB0`.
  - Security / Sealed: Bg `#EBF8FF`, border `#90CDF4`, text `#1A365D`.
  - Warning: Bg `#FFFAF0`, border `#FEEBC8`, text `#744210`.
  - Danger: Bg `#FFF5F5`, border `#FED7D7`, text `#742A2A`.
- **Dismissible Tag**: Incorporates an integrated `14px` close icon (`#718096`) on the right margin with hover color `#1A202C` and subtle circular feedback.

### Dropzone (Contract & Evidence Upload)
- Surface `#F7FAFC`, border `2px dashed #CBD5E0`, border-radius `8px`, padding `32px 24px`. Center-aligned layout.
- Icon container: `#EBF8FF` background circle with `#3182CE` document upload icon.
- **Hover / Drag Over**: Background `#EBF8FF`, border-color `#3182CE`. Transition `all 0.15s ease-in-out`.

### Switches & Toggles (Chakra UI Style)
- Track: width `34px`, height `18px`, border-radius `9999px`, background `#CBD5E0`, transition `background-color 0.2s`.
- Thumb: width `14px`, height `14px`, border-radius `50%`, background `#FFFFFF`, shadow `0 1px 2px rgba(0,0,0,0.2)`, transition `transform 0.2s`.
- **Checked Track**: Background `#1A365D`. Thumb translated `16px`. Focus ring `0 0 0 3px rgba(49, 130, 206, 0.3)`.

### Cards & Data Panels
- Surface `#FFFFFF`, border `1px solid #E2E8F0`, border-radius `8px`, Level 1 ambient elevation.
- Header divided by an internal border `1px solid #EDF2F7`, vertical padding `16px`, horizontal padding `20px`.