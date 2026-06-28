# Design

## Overview
PastePreset is a clipboard-first image utility with a bright product register. The visual system should feel like a focused browser tool rather than a heavy editor: blue-cyan energy, clean panels, crisp hierarchy, and enough softness in the shell to keep the workflow approachable.

## Brand foundation

### Identity lock
- Primary family: blue-cyan with deep ink navy anchors
- Register: energetic product UI, not editorial, not terminal, not enterprise admin
- Emotional read: fast, clear, privacy-safe, share-ready

### Core palette
- `brand-ink`: deep navy for wordmark, strong text, and grounding surfaces
- `brand-primary`: vivid blue for primary actions and active states
- `brand-primary-strong`: brighter saturated blue for emphasized interactions
- `brand-secondary`: cyan lift used sparingly for glow, highlight, and gradient support
- `brand-surface-tint`: cool near-white for light shell depth
- `brand-dark-surface`: cool graphite-navy for dark shell depth

### Color strategy
- Light theme: restrained shell with committed blue action color
- Dark theme: committed dark shell with bright, clean active accents
- Status colors remain semantic but tuned toward the same cool palette family so they do not feel imported from a default component library

## Themes

### Light theme
- Background should feel airy and cool, not flat white
- Cards use soft elevation or subtle borders, but not both aggressively at once
- Primary actions and selected states use vivid blue with clean white text
- Secondary chrome uses blue-tinted neutrals instead of generic gray

### Dark theme
- Background should read as an intentional night-mode workspace, not black SaaS chrome
- Surfaces step through two or three cool navy layers
- Text stays bright and highly legible; muted text remains blue-tinted rather than chalk gray
- Interactive accents stay luminous and sharp against dark surfaces

## Typography
- Use a single modern sans stack for consistency across app shell, forms, and metadata-heavy cards
- Headings should feel compact and product-oriented rather than display-editorial
- Small labels and helper text should remain readable under both themes, with strong enough contrast to avoid washed-out gray

## Components

### App shell
- Header, status area, content frame, and footer should read as one family
- Shell depth comes from layered surfaces, subtle gradients, and controlled border opacity
- Mobile drawer and overlays should inherit the same branded shell language

### Cards and panels
- Cards top out around medium radii and should feel crisp, not pillowy
- Reusable panels rely on a consistent surface recipe so settings, previews, and task groups feel related
- Dashed or outlined drop zones should use the brand accent system, not default neutral borders

### Actions and controls
- Primary buttons should feel saturated and decisive
- Ghost/secondary actions should remain visible on both themes without stealing focus
- Inputs, toggles, selects, and badges should use the same token family for focus, active, disabled, and feedback states

### Feedback and status
- Alerts, badges, overlays, and sticky status bars should use branded semantic tones with consistent contrast
- Loading and stale-result overlays should feel integrated into the shell instead of pasted-on utility states

## Motion
- Motion stays brief and informative
- Use small lift, opacity, and shimmer cues to support drag, processing, and panel transitions
- Avoid theatrical page-load choreography; the product should feel ready quickly

## Brand assets
- Public entrypoints stay stable at current URLs
- Light and dark logo variants must share one source-of-truth geometry and align with the UI token family
- PWA icons, social preview art, and screenshots should visually match the same shell and palette rather than drift into separate mini-brands
