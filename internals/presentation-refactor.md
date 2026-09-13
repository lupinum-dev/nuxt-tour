# Presentation refactor

Implementation record, 13 September 2026. Local work on
`feat/tour-presentation`, based on `ecf11643c2acc99ee34e53945e7cf3c7851a0144`.
The release-preparation follow-up targets 0.2.0. Publication is a separate
protected operation.

## Delivered scope

- Continuous, distance-adaptive 160–280 ms spotlight travel between nearby
  visible targets without Vue component rendering on each animation frame.
  Keep one spotlight element. Redirection preserves position and velocity;
  its path is independent of intermediate frame sampling.
- Preserve covered route and long-scroll handoffs. Detect whether the requested
  native alignment needs movement, including scroll margins, scroll padding,
  clamping, and RTL. An already aligned target can travel with default settings.
- Keep actual target hit areas separate from the travelling opening. Delay
  target interaction until alignment. Retarget from the current painted shape.
- Coordinate the arrow with the card, refine its tip and border join, and derive
  corner clearance from actual theme geometry. Default spacing includes 12 px
  beyond spotlight padding and arrow reach, following Matthias's visual review.
  `gap` sets this clear spacing. Explicit step offsets retain their existing
  target-to-card meaning; specifying both is rejected. Card and arrow share
  one translated surface throughout their fade.
- Add typed `actions` and `progress` slots. Preserve whole-card precedence,
  default naming and description, the close control, focus, and positioning.
  Default action styles do not override consumer-supplied button components.
- Fit cards to available placement space, scroll long content inside the card,
  and center targetless cards using the visual viewport. Prevent a positioning
  shift from moving the card over an interactive target on a narrow screen.
  Modal cards can use viewport space over a large highlighted region when no
  external side has enough room; an overlapping card has no pointing arrow.
- Show cancellable loading feedback after 400 ms. Escape can cancel preparation
  before the first card exists. Dispose focus isolation before restoring focus.
- Finish owned visual waits when the document is hidden. Honor reduced-motion
  preference changes during spotlight travel and scroll settlement.
- Add one application-level motion policy: `auto` by default, or `none` to
  remove tour-owned animation and smooth scrolling. Consumer content retains
  ownership of its own effects. Reduced motion also removes button scaling.
- Keep native scroll cancellation after early reveal until container movement
  actually settles, including sticky targets. Escape, teardown, and the next
  step stop the previous scroll. Modal input and focus isolation begin with the
  initial covered frame. A paused unrelated animation cannot stall navigation.
- Add reactive host step labels with validated-name fallback, plus `tourId`,
  resolved `title`, and `ariaLabel` in custom slots. Keep definition values and
  controller identity unchanged. Accept native `behavior: 'instant'`.
- Correct preparation examples to release their UI on abort and retain error
  feedback outside a host that may close after a failed command.
- Use the documentation's developer-focused demos to demonstrate motion.
  Remove the separate form playground and its tour following Matthias's review.
  Complete the plain Vue quickstart and document section slots,
  design-system buttons, and async Vue content.
- Add a reproducible complete-UI bundle check with a 30 KiB gzip limit.

The controller, application-scoped registry, typed IDs, route-before-prepare
order, cleanup contract, semantic targets, and public command concurrency rules
remain the same. No new runtime dependency was added.

## Renderer decision

The proposal named an SVG path as the first candidate and required comparison
with the existing element before replacement. A local Chrome experiment compared
the same repeated position/size interpolation using a rounded shadow element
and a rounded SVG opening at 1280 × 900. It ran four alternating 1.76-second
samples after a short warmup. The 95th-percentile frame intervals were:

| Candidate | First sample | Second sample |
| --- | ---: | ---: |
| SVG path | 16.8 ms | 18.0 ms |
| Existing element | 18.1 ms | 17.4 ms |

The largest interval across those four samples was 18.7 ms. An earlier cold
sample contained a 401 ms interval while other work was active; repeating in
alternating order did not reproduce a renderer-specific difference. These are
exploratory browser frame intervals on a small synthetic page, not isolated
paint costs, a CPU-throttled benchmark, or a Firefox result. Do not claim either
renderer is universally faster from them.

Keep the simpler existing renderer and CSS theme contract. The private geometry
routine writes its transform and dimensions directly. CSS retains the rounded
opening and clamps its radius naturally as dimensions change. There is no
second renderer or CSS path capability branch. Motion has one public policy;
durations and geometry interpolation remain private implementation details.

The animation review used Apple's WWDC 2018 session, [Designing Fluid
Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/), as design
guidance: respond promptly, preserve continuity, and allow interruption. This
is not Apple certification. Cancellation and finish intentionally remove the
tour immediately so focus and input return without waiting for decoration.
Route changes remain covered because a continuous path across different pages
would imply a spatial relationship that does not exist.

## Motion inventory

| Interaction | Default behavior | Reduced motion / `none` |
| --- | --- | --- |
| Start | Backdrop fades in over 120 ms; isolation is immediate. | Immediate backdrop. |
| Nearby step | Opening moves and resizes over 160–280 ms. | Geometry updates immediately. |
| Card and arrow | Shared 6 px arrival over 140 ms; opacity closes over 80 ms. | Opacity only over 120 ms / immediate. |
| Covered handoff | Opening cover closes over 70 ms and reveals over 120 ms. | Immediate cover. |
| Distant target | Native smooth scrolling; early reveal retains cancellation ownership. | Native instant alignment. |
| Slow preparation | Cancellable feedback after 400 ms, with a 120 ms entrance. | Same delay, immediate entrance. |
| Default buttons | Color feedback and 2% press scaling over 140 ms. | Immediate feedback without scaling. |
| Resize and user scroll | Direct tracking, without decorative interpolation. | Same tracking. |
| Finish and cancellation | Immediate removal and focus restoration. | Same behavior. |

`none` applies to effects owned by Nuxt Tour. A custom content component or
application route transition keeps its own animation policy. No spring engine,
looping attention effect, exit ghost, or configurable animation timeline was
added.

## Bundle and loading decision

`node scripts/measure-bundle.mjs --compare-head` compares the committed baseline
and working tree using the same installed esbuild and Vue compiler. Vue is
external; runtime dependencies and the default CSS are included. This is a
library-entry measurement, not a full application's incremental download.

The measured baseline was 27,062 gzip bytes including CSS. The implementation
measured 30,700 bytes at the final runtime review, an increase of 3,638 bytes
(about 3.6 KiB). This includes 28,435 bytes of JavaScript and 2,265 bytes of CSS.
`pnpm test:bundle` is part of `pnpm verify` and checks the
complete default Vue UI against 30 KiB. The script removes temporary files.

The existing documentation's rich-content component compiles to approximately
336 gzip bytes of JavaScript and 165 bytes of CSS, before app-level chunk
sharing. It has no heavy imported rendering dependency. That example does not
justify a registry loader and changed synchronous controller semantics.

Definitions therefore remain eager. The new recipe uses Vue's existing
`defineAsyncComponent` for large content, including loading and failure UI.
A focused test covers cancellation while that component loads. Whole-definition
lazy discovery remains conditional on a consumer that demonstrates material
cost; it was not silently introduced under a visual refactor.

## Verification and corrections

The initial browser checks found two implementation issues that were corrected:
focus isolation outlived the loading dialog during cancellation, and a narrow
WebKit card could shift over the target. Default button margins and minimum
widths are now explicit so global application button styles do not enlarge the
default close/action controls unexpectedly.

The existing docs latency test combined native smooth-scroll time with tour
response time. It failed at 436 ms in this refactor and at 686.5 ms in the prior
baseline investigation. A live sample started about 800 px from its destination
and showed the page still travelling before the reveal could safely happen.
The replacement assertion requires a reveal within 200 ms once the destination
is near and slow, while retaining the shaded-frame, painted-reveal, maximum
offset, scroll-settlement, and geometry-handoff assertions. No production
scroll-speed threshold was loosened to satisfy it.

Safari can remove button focus during a pointer click. Focus-return tests now
start the tour with an actual focused button and Enter. Pointer operation is
tested separately. Arrow stacking assertions were updated for the new border
join; the arrow remains decorative.

Final checks:

- The final `pnpm verify` run passed all 19 Chromium documentation and runtime
  journeys, including the new initial-isolation, scroll-cancellation,
  arrow-attachment, same-target spacing, and motion-off regressions.
- The documentation tests now locate the element that owns opacity explicitly
  after the surface wrapper changed. Their painted-reveal and visible-height
  assertions remain intact. A fresh documentation build also passed after the
  final preparation-example correction.
- Dependency policy and positive/negative policy checks passed; the workspace
  audit found no known vulnerabilities.
- Lint, application and public-contract type checks, 92 source tests, the
  module build, and the documentation build passed.
- The final WebKit, mobile Chromium, and mobile WebKit matrix passed 49 tests.
  Two forced-colors tests were skipped on WebKit, which does not support that
  emulation mode. Firefox is excluded from this local result as explained below.
- The rebuilt tarball passed mounted journeys in Nuxt 4.5.2 and Vue 3.5.42,
  including customized actions and progress sections, motion-off, translated
  headings, `gap`, and native instant scrolling. Its SHA-256 is
  `e625eb15fafa97a84ec066d6b64760c554dad9c85899a0144b43d67ba43166ab`.
- The bundle check passed at 30,700 gzip bytes against the 30 KiB limit.
- Desktop and mobile form journeys were inspected in Chrome. The final desktop
  screenshot confirms the increased spacing and the arrow's border join.

Two independent read-only API and motion reviews found additional issues in
scroll ownership, label fallbacks, spacing reactivity, and redirected velocity.
Those findings are corrected with focused regressions. Screenshots and
exploratory traces do not replace assistive-technology or physical-phone tests.
The normal pull-request review is still required before merging.

## Remaining release evidence

The installed Playwright Firefox build cannot start on this host. Both headless
and headed attempts failed before page navigation with a macOS sandbox-extension
error; the headless attempt also reported an SWGL framebuffer failure. Do not
claim Firefox verification or a Firefox performance improvement. Keep the
Firefox release project enabled for a working environment.

No physical on-screen-keyboard, VoiceOver, or NVDA result is claimed. Automated
mobile browser viewports and keyboard/focus checks cover the documented local
evidence only. Production publishing and broader framework-floor/OS certification
remain separate release operations.
