# Video detail design

- The outlier score owns the only dark metric card in light mode and the lime figure in both themes. Supporting numbers use tabular figures, consistent labels, and quieter surfaces. Lime appears only in the score, the primary writer action, and the active navigation marker on this screen.
- Light mode combines paper, white cards, sunken callouts, and subtle shadows. Dark mode uses ink, slate cards, brighter raised controls, visible borders, and inner highlights. The sidebar and score card stay dark in both.
- The page follows video context, performance, then analysis. A roughly 1100px content limit, 4/8px spacing, and summaries limited to 72ch keep the content readable. A blue rule and larger quotation distinguish the hook from its explanation.
- Script/hooks tabs use real tab panels and arrow/Home/End navigation. Each offers an explicit writer action and preserves the reference transcript. The complete analysis, remix ideas, transcript controls, history, and earlier breakdowns remain available.
- Appearance defaults to System, persists locally, follows OS changes only in System mode, and syncs across tabs. The segmented control uses a moving thumb. A mobile top bar keeps appearance reachable; a native modal drawer provides all navigation and profile actions.

## Implementation

| Concern | Source |
| --- | --- |
| Theme state, OS/storage listeners, `useTheme` | [`ThemeProvider.tsx`](../src/components/ThemeProvider.tsx) |
| Light / Dark / System control | [`ThemeToggle.tsx`](../src/components/ThemeToggle.tsx) |
| Shared initialization script | [`theme.ts`](../src/lib/theme.ts) |
| Sidebar and mobile shell | [`Sidebar.tsx`](../src/components/Sidebar.tsx), [`AppShell.tsx`](../src/components/AppShell.tsx) |
| Thumbnail, title, metadata, actions | [`VideoHeader.tsx`](../src/components/VideoHeader.tsx) |
| Metric layout and accessible momentum hint | [`MetricsRow.tsx`](../src/components/MetricsRow.tsx), [`MetricCard.tsx`](../src/components/MetricCard.tsx) |
| Writer tabs and hook quotation | [`BreakdownTabs.tsx`](../src/components/BreakdownTabs.tsx), [`HookCallout.tsx`](../src/components/HookCallout.tsx) |
| Existing analysis integration | [`GenerationViews.tsx`](../src/components/GenerationViews.tsx) |
| Video page integration | [`page.tsx`](../src/app/app/videos/[id]/page.tsx) |
| Palette, semantic utilities, layout, global transitions | [`globals.css`](../src/app/globals.css) |

Tailwind v4 compiles the requested `@theme inline` semantic utilities and class-based dark variant. It is integrated without Preflight to retain existing form and document behavior, following the [Tailwind documentation](https://tailwindcss.com/docs/preflight#disabling-preflight). Theme state uses React only; no theme library is installed. Components contain no literal colour values or per-component dark overrides. Compatibility aliases map existing app styles onto the same semantic tokens.

## Before-paint script / index.html equivalent

This is a Next.js App Router project, so there is no `index.html`. The synchronous script is installed in the `<head>` of [`src/app/layout.tsx`](../src/app/layout.tsx), before the body; `suppressHydrationWarning` covers the intentional class change on `<html>`. The equivalent standalone snippet is:

```html
<head>
  <script>
    (function () {
      var theme = 'system';
      try {
        var saved = localStorage.getItem('outlier-studio-theme');
        if (saved === 'light' || saved === 'dark') theme = saved;
      } catch (error) {}
      var dark = theme === 'dark' || (
        theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches
      );
      document.documentElement.classList.toggle('dark', dark);
    })();
  </script>
</head>
```

The provider adds `data-theme-ready` after the initial two animation frames. Global CSS transitions background, border, text, SVG fill/stroke, and the control thumb over 250ms with `ease-in-out`. Before that attribute exists, and under reduced motion, transitions are disabled.

## Assumptions and accessibility adjustments

No screenshot was attached. Nothing was transcribed from an image or omitted because it was unreadable; the existing app supplies all video and analysis content. The example score in the brief is illustrative: scores and metrics still come from the API. Browser checks used the project's local fake services and their placeholder thumbnail.

The explicit semantic surface colours in the brief are treated as permitted exceptions to the eight base colours. Two requested token values conflict with the AA requirement: grey-500 is too faint for small light-mode labels (and dark raised surfaces), and unadjusted brand-blue is too faint for text on dark slate/tag backgrounds. `--text-muted` therefore mixes existing greys with ink in light mode and grey-300 in dark mode; the dark `--link` mixes brand-blue with paper. No new literal colours are introduced. The tag fill remains 10% brand-blue. The light link remains the supplied `#2563EB`.

The site uses the system sans stack, with Inter used if available locally. Supporting numeric metrics are 28–32px, the hero figure 36px; unavailable values are smaller and muted. Non-YouTube videos retain the appropriate platform label and update action.

## Verification

Production build and TypeScript validation pass. Eight theme initialization tests cover explicit choices, System, missing/invalid storage, and blocked storage.

An isolated Chromium run against local fake services verified persistence, cross-tab updates and deletion, OS changes, explicit overrides, radio/tab keyboard navigation, script and hook handoffs with the reference transcript, the momentum tooltip, mobile navigation, reduced motion, and blocked storage. Axe reported no WCAG A/AA violations on the populated video page in either theme at 1440px, 768px, 390px, and 320px, or in the mobile drawer. No horizontal page overflow or hydration/browser errors were observed. Automated accessibility checks do not replace a full assistive-technology audit.

The existing full suite reports 85 passing and six failing tests, unrelated to the UI changes: five source-path assertions in `tests/provider.test.ts` expect forward slashes on Windows; `tests/auth.test.ts` expects the removed `user.plan` value. Those tests and server implementations are unchanged.
