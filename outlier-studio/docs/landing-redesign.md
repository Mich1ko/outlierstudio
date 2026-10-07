# Landing page redesign

## Design rationale
- A concise, two-tone headline leads directly into a working product preview, making the product understandable before login.
- Three sample screens demonstrate the entire workflow: discover an outlier, understand the hook, then write a version.
- Layered blue and lime light, restrained grain, perspective, and a fading browser frame give the hero depth without external image requests.
- Shared glass buttons provide consistent sheen, magnetic hover, keyboard focus, and disabled/loading states.
- The original coffee script remains intact, with readable timestamps and a highlighted hook.
- An SVG journey links the original three steps, with persistent progress, miniature workflow animations, and responsive/reduced-motion layouts.

## Implementation
`src/components/landing/LandingPage.tsx` exports Nav, Hero, HeroHeadline, GlassButton, AppPreview, PreviewVideos, PreviewDetail, PreviewHooks, GlowBackground, ExampleScript, StepsPath, FinalCTA, Footer, and ThemeToggle.

`src/components/landing/landing.css` contains the landing-scoped semantic tokens, glass, glow, grain, animation, and responsive rules. The eight base palette tokens remain in `src/app/globals.css`. Existing application styling is preserved. Motion is the only added runtime dependency.

The landing page is statically prerendered. Preview autoplay runs only near the viewport, pauses on hover/focus, stops after manual tab selection, and has an explicit resume control. Reduced motion disables autoplay and spatial effects. Step illustrations mount once near the viewport. All primary CTAs route to the existing `/app` entry point; sign-in and signup remain available.

## Assumptions and reference limits
- No screenshots or Sandcastles URL were supplied. The written reference was used; no screenshot text could be inspected.
- Fictional channel names, metrics, and CSS thumbnail illustrations are deliberate sample data, not claims about real creators.
- The requested display URL is `outlierstudio.app/app/videos`; the actual application entry point remains `/app` (its current Videos route is `/app/feed`).
- The installed Bricolage Grotesque display font is retained. UI typography uses the existing Inter/system stack; no external font request was added.
- Dark is the default on `/`; a saved explicit light/dark preference wins. Other routes retain system defaults. This decision is applied in the head before paint and by the theme provider.
- Short viewports use a nonsticky journey so all steps remain reachable. Mobile uses a vertical path. Reduced motion shows the steps without spatial animation.

## Validation
- TypeScript check and optimized Next.js production build pass.
- Theme tests cover landing default, saved light/dark overrides, nonlanding behavior, and blocked storage.
- The full suite reports unrelated provider tests comparing Windows paths to POSIX paths (five failures), plus an authentication test expecting a missing signup `plan` field (one failure). Those files were not changed.
- No browser is connected to the available browser automation service. Visual verification at 360px, measured WCAG contrast, and Lighthouse/CLS scores remain unverified; a 90+ score is a target, not a measured result.
