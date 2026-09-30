# Typography System — Tavryn Design System

Tavryn uses **Manrope** as its primary typeface across all interfaces, paired with a system-ui fallback and monospace font stack for numbers, wallet addresses, and code.

Loaded via `next/font/google` in `app/layout.tsx` across weights 400, 500, 600, 700, and 800.

---

## 1. Type Scale

All tokens are defined in `app/globals.css` within the Tailwind v4 `@theme` block:

| Token         | Size             | Line Height | Letter Spacing | Weight          | Primary Use Cases                                                   |
| :------------ | :--------------- | :---------- | :------------- | :-------------- | :------------------------------------------------------------------ |
| **`display`** | 3rem (48px)      | 1.1         | -0.02em        | 800 (extrabold) | Hero savings figure, landing headlines, breakthrough numbers        |
| **`h1`**      | 2.25rem (36px)   | 1.15        | -0.02em        | 700 (bold)      | Page titles (`Money overview`, `Contract Decision Review`)          |
| **`h2`**      | 1.5rem (24px)    | 1.25        | -0.01em        | 700 (bold)      | Section headers (`Opportunities`, `Deterministic Policy Checklist`) |
| **`h3`**      | 1.125rem (18px)  | 1.35        | 0              | 600 (semibold)  | Card titles, modal headers, table titles (`Exchange Transcript`)    |
| **`body-lg`** | 1rem (16px)      | 1.5         | 0              | 400/500         | Primary reading text, lead paragraphs, long-form policy rationales  |
| **`body`**    | 0.875rem (14px)  | 1.5         | 0              | 400 (normal)    | Default UI copy, table cells, negotiation message bodies            |
| **`body-sm`** | 0.8125rem (13px) | 1.45        | 0              | 500 (medium)    | Secondary text, timestamps, metadata, speaker titles                |
| **`caption`** | 0.75rem (12px)   | 1.4         | +0.01em        | 600 (semibold)  | Uppercase labels (`TREASURY`, `BASELINE`), pill badges              |
| **`mono`**    | 0.8125rem (13px) | 1.5         | 0              | 600 (semibold)  | Financial math, USDC amounts, tx hashes, addresses (`font-mono`)    |

> Backward Compatibility Note: `--text-xs` is retained at 13px (0.8125rem) to preserve legacy styles.

---

## 2. React Primitives (`@/components/ui/text`)

Reusable polymorphic React components are provided in `components/ui/text.tsx`. Each primitive supports the `as` prop for semantic HTML tag substitution and merges additional Tailwind utility classes seamlessly.

### Component Primitives Reference

```tsx
import {
  Display,
  H1,
  H2,
  H3,
  Body,
  BodySmall,
  Caption,
  Mono,
} from "@/components/ui/text";
```

### Examples

#### Page Heading & Hero Metrics

```tsx
<H1 className="text-slate-900 dark:text-white">Contracts Ledger</H1>

<Display className="text-emerald-600 dark:text-emerald-400 font-mono">
  $42,850
</Display>
```

#### Section Heading with Polymorphic Rendering

```tsx
{
  /* Renders an <h2> styled with the H3 type-scale */
}
<H3 as="h2" className="text-slate-900 dark:text-white">
  Deterministic Policy Checklist
</H3>;
```

#### Financial Figures & Metadata

```tsx
<div className="flex flex-col">
  <Caption className="text-slate-400 uppercase tracking-wider">
    Original Rate
  </Caption>
  <Mono className="text-slate-900 dark:text-white text-base">$12,400.00</Mono>
  <BodySmall className="text-slate-500">Updated 2 hours ago</BodySmall>
</div>
```

#### Negotiation Transcript Turn

```tsx
<div className="flex items-center gap-2">
  <BodySmall as="span" className="font-bold text-slate-900 dark:text-white">
    Tavryn Procurement
  </BodySmall>
  <Caption className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[#107e65]">
    Autonomous Agent
  </Caption>
  <Mono className="text-[#107e65] font-bold">
    Offer: $9,600
  </Mono>
</div>
<Body className="text-slate-600 dark:text-slate-300 leading-relaxed">
  Based on seat utilization data, 18 of 25 licenses are active...
</Body>
```

---

## 3. Class-Based Usage

For lightweight inline styling without importing components, standard utility classes mapping to `@theme` tokens are available:

```tsx
<span className="text-caption font-bold uppercase tracking-wider text-slate-500">
  Identified Savings
</span>

<div className="text-h2 font-bold font-mono text-[#107e65]">
  $14,200
</div>

<p className="text-body text-slate-600 dark:text-slate-300">
  All policy constraints satisfied automatically.
</p>
```

---

## 4. Design Guidelines

1. **Universal Border Radius**: Always pair containers with `rounded-xl` or `rounded-2xl` matching the design system rules.
2. **Never Use Arbitrary Font Sizes**: Do not use `text-[13px]`, `text-[15px]`, or ad-hoc Tailwind size classes. Stick to the tokens above.
3. **Financial Consistency**: All currency values, blockchain addresses, transaction hashes, and contract references (`CT-XXXX/XXX`) must use `Mono` or `font-mono text-mono`.
4. **Legibility First**: In dark mode (`#111714` / `#0b0f0d`), use `text-white` for primary titles, `text-slate-300` for body copy, and `text-slate-400` or `text-slate-500` for metadata.
