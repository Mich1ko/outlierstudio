# Outlier Studio (working name)

A short-form video research and scripting app, modelled on the feature set of
sandcastles.ai and built as its own product. All AI runs on Groq.

**Status: working app.** You can keep a watchlist of competitor YouTube
channels, see their videos ranked against each channel's normal with growth
over time, break any video down in one click (YouTube, TikTok or Instagram),
and write your own hooks and scripts from it. Automatic monitoring of TikTok
and Instagram accounts, the reference's curated library, and billing are not
built. The full list is under [What is and is not built](#what-is-and-is-not-built).

The name is a placeholder. Change it in `src/config/app.ts`.

## Run it

```bash
npm install
cp .env.example .env      # then set GROQ_API_KEY
npm run dev               # http://localhost:3000
```

Open http://localhost:3000, create an account, and you land in the app.

With no `DATABASE_URL`, an embedded Postgres (PGlite) is created in
`./.data/pglite` and migrated on first start. It is for local development: it
is single-process, so stop the server before running other scripts against it.

```bash
npm test                  # 79 tests, no network needed
npm run typecheck
npm run build && npm start
```

Make yourself an admin after signing up:

```bash
npm run admin:promote -- you@example.com
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | yes | Groq key. Read only on the server. |
| `APP_URL` | yes in production | Public origin, used to block cross-site writes. |
| `DATABASE_URL` | production | Postgres connection string. |
| `PGLITE_DIR` | no | Folder for the embedded dev database. |
| `YOUTUBE_API_KEY` | for tracking | Google API key with YouTube Data API v3 enabled. Read only on the server. |
| `APIFY_TOKEN` | for one-click analysis | Apify API token: YouTube transcripts, and TikTok / Instagram video numbers. Read only on the server. |
| `APIFY_MONTHLY_BUDGET_USD` | no | Most to spend on Apify in a calendar month (UTC). Default 5. Never above 5 in code. Runs that would pass it are refused before they start. |
| `APIFY_ACTOR_YOUTUBE_TRANSCRIPT`, `APIFY_ACTOR_TIKTOK`, `APIFY_ACTOR_INSTAGRAM`, `APIFY_ACTOR_INSTAGRAM_SEARCH` | no | Replace the default Apify Actors. See the defaults in `src/server/video/apify.ts`. |
| `TRACK_INTERVAL_HOURS` | no | Hours between automatic checks of each channel. Default 6. |
| `DISABLE_SCHEDULER` | no | `1` turns off the built-in timer. |
| `CRON_SECRET` | no | Enables `POST /api/cron/refresh` for an external scheduler. At least 16 characters. |
| `GROQ_MODEL_QUALITY` | no | Model for scripts, hooks, analysis. Default `openai/gpt-oss-120b`. |
| `GROQ_MODEL_FAST` | no | Model for quick classification tasks. Default `openai/gpt-oss-20b`. |
| `GROQ_MODEL_TRANSCRIBE` | no | Speech-to-text model. Default `whisper-large-v3-turbo`. Not used yet. |
| `GROQ_STRICT_JSON_MODELS` | no | Models that accept strict `json_schema` output. |
| `GROQ_REASONING_EFFORT` | no | `low`, `medium` or `high`. Only for reasoning models. |
| `GROQ_TIMEOUT_MS`, `GROQ_MAX_RETRIES` | no | Defaults 60000 and 2. |
| `GROQ_PRICING_JSON` | no | Price overrides, USD per 1M tokens. |

When Groq retires a model, change the variable and restart. No code changes.

### Troubleshooting Groq configuration

You do not need to copy the entire `.env` into your hosting settings. Set
`GROQ_API_KEY` in the running server's environment; the model variables above
are optional overrides with built-in defaults. Locally, Next.js also loads
`.env*` from the `outlier-studio` directory. Existing process environment
variables take precedence over those files.

For a hosted app, check that the key is assigned to the environment serving
the failing request (for example, production versus preview), then restart
or redeploy after changing it. Enter the key value only, without surrounding
quotes or a `GROQ_API_KEY=` prefix. Keep it server-only; never use a
`NEXT_PUBLIC_` prefix for secrets.

- Missing key: configure `GROQ_API_KEY` on the running server.
- Authentication rejected (401): check that the deployed key is current and
  belongs to the intended Groq project. Adding model variables cannot fix an
  invalid key.
- Access denied (403): check Groq organization and project permissions,
  including whether the configured model is allowed. This does not necessarily
  mean the key is invalid. See [Groq model permissions](https://console.groq.com/docs/model-permissions).

The app refunds its reserved credits when either provider rejection occurs.

## Get a YouTube API key (free)

Competitor tracking reads public channel and video data through Google's
official YouTube Data API v3.

1. Go to https://console.cloud.google.com and sign in with a Google account.
2. Create a project (the project picker at the top, then "New project").
3. Open "APIs & Services", then "Library". Search for "YouTube Data API v3",
   open it and press "Enable".
4. Open "APIs & Services", then "Credentials". Press "Create credentials" and
   choose "API key". Copy the key.
5. Recommended: edit the key and under "API restrictions" allow only
   "YouTube Data API v3".
6. Put it in `.env` as `YOUTUBE_API_KEY=...` and restart the app.

The free quota is 10,000 units a day. Adding a channel or checking it costs 3
units, so 25 channels checked every 6 hours use about 300 units a day.

## Get an Apify token

One-click analysis needs a YouTube video's transcript, and TikTok and Instagram
links need their numbers. Neither is available from the platforms' own free
APIs, so the app runs Apify scrapers for both.

1. Sign up at https://apify.com. The free plan includes a monthly platform
   credit; check the current amount on its pricing page.
2. Copy the API token from Settings, then Integrations.
3. Put it in `.env` as `APIFY_TOKEN=...` and restart the app.

The default Actors are `devsef~youtube-transcript-scraper` (YouTube captions),
`clockworks~tiktok-scraper` (TikTok), `apify~instagram-reel-scraper`
(Instagram single reels and account checks). Their input fields were written against the Actors' documentation
and have not been run live yet, so check the first real run's output.
Instagram niche discovery uses `apify~instagram-search-scraper`.
TikTok and Instagram transcripts are not available: paste one in instead.

What an Apify run is spent on:

| Action | Runs |
|---|---|
| First breakdown of a YouTube video | 1 transcript run |
| Breaking the same video down again | 0, the transcript is stored |
| Adding a TikTok or Instagram video by link | 1 run of the matching Actor |
| "Update numbers" on a TikTok or Instagram video | 1 run |
| Anything on YouTube except transcripts | 0, it uses the YouTube API |

The app keeps its own monthly ledger (`apify_runs`). Before each run it reserves
the most the run can cost at the Actor's listed price, refuses it if the month's
spend would pass the budget, and sends the reservation to Apify as
`maxTotalChargeUsd` so Apify stops the run at that cost. Failed runs keep their
reservation. Each run is billed by Apify against the monthly credit, so a long transcript
costs the same as a short one. Each Instagram account is one run per check, so
the number of Instagram accounts and `TRACK_INTERVAL_HOURS` set the spend. Without a token the app still works: every
video page has a "Paste a transcript instead" box.

## How tracking works

- **Adding a competitor.** Paste a YouTube channel link, an `@handle`, or any
  video or Short from the channel (old-style `/c/name` links cannot be looked
  up). Or paste an Instagram profile, like `instagram.com/name`. Instagram
  accounts are read through Apify, so they need `APIFY_TOKEN`.
- **Checks.** Each check reads the channel's subscriber count and its 50 most
  recent uploads, and stores a snapshot of every number. Channels are checked
  every `TRACK_INTERVAL_HOURS` (default 6) by a timer inside the server, so
  **monitoring only runs while the app is running**. "Check now" re-checks one
  channel by hand, at most every 15 minutes.
- **Outlier multiple.** A video's views divided by the channel's median views
  for the same kind of video (Shorts and longer videos have separate
  medians), over its 50 most recent uploads. Videos under a day old are left
  out of the median once there are five older ones.
- **Momentum.** Views gained per hour between the two most recent checks. A
  video needs two checks before it has one.
- **Subscriber growth.** The difference between now and the oldest check in
  the last 7 days. YouTube rounds public subscriber counts to three significant
  figures, so small changes on large channels do not show. History starts on
  the day you add a channel; the API does not provide past numbers.
- **Shorts.** The API has no "is a Short" field. A video of 3 minutes or less
  is counted as a Short, which will misfile a few short ordinary videos.
- **Transcripts.** The official YouTube API only gives transcripts to a video's
  owner, so transcripts come from Apify (see above) and are stored on the
  video after the first fetch. The app itself does not scrape youtube.com,
  tiktok.com or instagram.com.
- **TikTok and Instagram.** There is no free source that lists an account's
  videos, so these accounts are not monitored. Paste a single video link (on
  Videos or Analyze a link): its numbers are read once, it is filed under its
  author, and "Update numbers" re-reads it on request. An author's videos get
  an outlier multiple once five of them have been added.
- **Your own channels.** Mark a YouTube channel as yours from its "More" menu.
  It is tracked the same way but kept out of the competitor list.
- **History kept.** Snapshots older than 90 days are deleted.
- **Hosting without a long-running server** (for example serverless): set
  `DISABLE_SCHEDULER=1` and `CRON_SECRET`, and have a scheduler send
  `POST /api/cron/refresh` with `Authorization: Bearer <CRON_SECRET>`.

## The interface

| Screen | What it does |
|---|---|
| `/` | Landing page with an example script. |
| `/signup`, `/login` | Account creation and sign-in. |
| `/app` | Start page: the steps in order, and recently saved items. |
| `/app/competitors` | **Watchlist.** Add and remove YouTube channels; subscribers, growth, uploads in 7 days, typical Short views, last check. Write a report on a channel. Mark a channel as your own. Authors from pasted TikTok and Instagram links are listed separately. |
| `/app/feed` | **Videos.** Competitors' videos, filtered by channel, type and period, sorted by outlier multiple, momentum, date or views. Add one video by link. |
| `/app/videos/:id` | One video: current numbers, **Analyze this video** (one click), the stored transcript, a chart and table of views at each check, earlier breakdowns. A paste-a-transcript fallback. |
| `/app/hook-library` | The hook of every video you have broken down, with its pattern, why it works and the source video. |
| `/app/analyze` | **Analyze a link.** Paste a video link and the breakdown starts on its page. Or paste a transcript. |
| `/app/hooks` | **Hook writer.** Hooks for a topic. Each can be copied or sent to the script writer. |
| `/app/scripts` | **Script writer.** From a new idea, from a breakdown (remix), or from your own draft. Streams in line by line with the second each line is spoken, and can be stopped. |
| `/app/library` | Everything generated (breakdowns, hooks, scripts, reports), filterable, with a page per item and delete. |
| `/app/usage` | Tokens, estimated cost, per-tool totals, recent requests. |
| `/app/settings` | Account, your creator profile (used in every hook and script), sign out. Admins also get limits and an account list. |

Pages under `/app` redirect to sign-in without a session. On phones the
sidebar becomes a bottom tab bar. The look is our own: styles and colours are
in `src/app/globals.css`, the product name in `src/config/app.ts`. Fonts are
bundled from npm (Bricolage Grotesque, Atkinson Hyperlegible Next), so nothing
loads from a font CDN.

## How AI requests work

```
route handler ─► feature (prompt + schema) ─► ai/service.ts ─► Groq
                                                  │
                                 ai/limits.ts ◄───┼───► ai/usage.ts
                             (rate limit, quota)        (one row per request)
```

- `src/server/ai/client.ts` is the only file that creates an AI client. The
  base URL is fixed to `https://api.groq.com`. There is no other provider and
  no fallback: when Groq fails, the user is told Groq failed.
- `src/server/ai/service.ts` exposes `generateJson` (structured output) and
  `openTextStream` (streaming). Every feature uses one of these.
- Before each call, `limits.ts` checks the per-minute limit under a per-user
  database lock. There are no plans or monthly quotas; this is a personal tool.
- After each call, `usage.ts` records model, status, latency, error code, and
  the token counts **Groq reported**. For streams these come from the
  `x_groq.usage` field of the final chunk. If Groq reports none, the token
  columns stay empty. Nothing is estimated.
- Cost is an estimate: tokens x list price as read from Groq's models page on
  2026-10-04 (`src/server/ai/pricing.ts`). Models with no public price get no
  cost. The API labels it as an estimate.

To add an AI feature: add its name to `FEATURES` in `src/server/settings.ts`,
write a file in `src/server/ai/features/`, call the service. Limits and usage
tracking apply without further work.

## API

All bodies are JSON. Errors are `{ "error": { "code", "message" } }`.

| Method and path | Access | Purpose |
|---|---|---|
| `POST /api/auth/signup` | public | `{email, password, name}`. Sets the session cookie. |
| `POST /api/auth/login` | public | `{email, password}` |
| `POST /api/auth/logout` | session | Ends the session on the server. |
| `GET /api/auth/me` | session | Current user. |
| `POST /api/ai/hooks` | session | `{topic, audience?, tone?, platform?, count?, referenceTranscript?}` |
| `GET /api/channels` | session | Your tracked channels with growth figures. |
| `POST /api/channels` | session | `{url}`. Starts tracking and runs the first check. |
| `DELETE /api/channels/:id` | tracker | Stops tracking. |
| `POST /api/channels/:id/refresh` | tracker | Re-checks now (at most every 15 minutes). |
| `GET /api/videos` | session | Feed. `?channelId=&type=shorts|long|all&days=7|30|90|all&sort=outlier|momentum|recent|views&limit=&offset=` |
| `POST /api/videos` | session | `{url}`. Adds one YouTube, TikTok or Instagram video by link. |
| `GET /api/videos/:id` | tracker | One video, its transcript if stored, check history and your breakdowns of it. |
| `POST /api/videos/:id/refresh` | tracker | Re-reads the video's numbers (at most every 15 minutes). |
| `PUT /api/channels/:id` | tracker | `{isOwn}`. Marks a channel as yours or as a competitor. |
| `GET /api/hook-library` | session | Hooks from your breakdowns. |
| `GET` / `PUT /api/profile` | session | Your creator profile text. |
| `POST /api/ai/report` | tracker | `{channelId}`. Writes a channel report (needs five videos). |
| `POST /api/cron/refresh` | secret | Checks all due channels. Off unless `CRON_SECRET` is set. |
| `POST /api/ai/analyze` | session | `{videoId}` for one-click analysis (transcript fetched and stored), or `{transcript, title?, ...}` for pasted text. With `videoId`, title and numbers come from the tracked video. |
| `POST /api/ai/script` | session | `{idea?, draft?, hook?, framework?, lengthSeconds?, tone?, audience?, platform?, callToAction?, referenceTranscript?}` (one of `idea` or `draft` is required). Server-sent events: `start`, `delta`, then `done` or `error`. |
| `GET /api/generations` | session | Saved outputs. `?kind=&before=&limit=` |
| `GET` / `DELETE /api/generations/:id` | owner | One saved output. |
| `GET /api/usage` | session | Tokens, estimated cost, by feature and model, last 50 requests. |
| `GET` / `PUT /api/admin/limits` | admin | Safety limits: AI requests per minute and tracked channels. |

Tracking error codes: `invalid_link` (400), `channel_not_found` (404),
`video_not_found` (404), `channel_limit` (403), `checked_recently` (429),
`not_monitored` (400), `video_data_not_configured` (503), `video_data_quota`
(429), `video_data_unavailable` (503).

Transcript error codes: `transcripts_not_configured` (503),
`transcript_unavailable` (422), `transcript_quota` (429),
`transcript_plan_limit` (402), `transcript_timeout` (504). Each leads to the
paste-a-transcript box.

AI error codes: `ai_rate_limited` (429, with `Retry-After`), `ai_unavailable`
(503), `ai_timeout` (504), `ai_model_unavailable` (503), `ai_not_configured`
(503), `ai_invalid_output` (502), `ai_stream_interrupted` (502),
`quota_exceeded` (402), `rate_limited` (429).

## Security

- Passwords: scrypt with a per-user salt. Sessions: random 256-bit token in an
  `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production); only its SHA-256
  is stored.
- Every data query filters by the signed-in user's id on the server. Channel
  and video rows are shared between accounts that track the same channel, and
  every read joins through the caller's own tracking list.
- The YouTube key is sent only to googleapis.com and the Apify token only to
  api.apify.com, in a request header. Neither is logged or returned.
- A transcript you paste for a tracked video is used for your breakdown only.
  Only transcripts fetched from the service are stored on the shared video row.
- Image links from other sites are shown only if they are http(s) links.
- Writes from another origin are rejected; bodies must be JSON and under 200 KB;
  all input is validated with zod.
- Login locks after 10 failures per email in 15 minutes. Signup is limited per IP.
- Role cannot be set from signup. Admin is granted from the command line.
- Unknown errors return a reference id; details go to the server log only.
- Text pasted by users (transcripts, ideas) is fenced in the prompt and the
  model is told to treat it as material, not instructions.

Known gaps:

- No email verification. Anyone can register any address.
- The IP used for rate limiting comes from `X-Forwarded-For`. That is only
  trustworthy behind a proxy that sets it (Vercel, Fly, nginx).
- A 403 from Groq is reported as "not set up correctly". Groq can also return
  403 for a model your account is not permitted to use.

## Deploy

1. Create a Postgres database and set `DATABASE_URL`.
2. `npm ci && npm run db:migrate && npm run build`
3. Set `GROQ_API_KEY`, `APP_URL` and `NODE_ENV=production`, then `npm start`.
4. Sign up, then `npm run admin:promote -- <your email>`.

Built and tested on Node 22. Route handlers use the Node runtime, not edge.
After changing `src/server/db/schema.ts`, run `npm run db:generate` to create
the migration.

## Tests

`npm test` runs the real route handlers against an in-memory Postgres and a
local stand-in for Groq's API (`tests/support/fake-groq.ts`) that speaks the
same wire format. The stand-in exists only in the test suite; the app reads
`GROQ_BASE_URL` only when `NODE_ENV=test`.

Covered: signup, login, logout, lockout, cross-site blocking, per-user data
isolation, admin access, hooks, analysis, script streaming, client disconnect,
token and cost recording, missing usage, Groq 429 / 404 / 5xx / bad key,
retries, quotas, parallel overspend, per-minute limits, script timing, and a
source scan proving no other AI provider or key exposure.

One-click analysis and videos by link are tested against a stand-in for
Apify (`tests/support/fake-apify.ts`): transcript fetch and reuse, missing transcripts, missing or rejected keys, a used-up allowance,
long videos, TikTok and Instagram links, on-request updates, privacy between
accounts, the hook library, the creator profile, drafts and channel reports.

Tracking is tested against a stand-in for the YouTube API
(`tests/support/fake-youtube.ts`): link parsing, adding by handle and by video
link, ranking, momentum and subscriber growth between checks, hidden counts,
channel limits, missing or rejected keys, quota exhaustion, due-only scheduled
checks, the cron secret, privacy between accounts, and analysing a tracked
video.

The interface was also driven end to end in Chromium at desktop (1440px) and
phone (390px) width against the same stand-in: sign up, every tool, the
hand-offs between tools, stopping a script, error messages, library, delete,
usage, admin settings, sign out. That browser run is not part of `npm test`.
To repeat it by hand without a Groq key:

```bash
npx tsx tests/support/serve-fake-groq.ts        # canned answers on ports 4010 to 4012
npm run build
NODE_ENV=test GROQ_BASE_URL=http://127.0.0.1:4010 GROQ_API_KEY=test \
  YOUTUBE_API_BASE_URL=http://127.0.0.1:4011 YOUTUBE_API_KEY=test \
  APIFY_BASE_URL=http://127.0.0.1:4012 APIFY_TOKEN=apify_test_token npm start
```

In that mode the database is in memory and the answers are canned, so use it
only to look around. Two made-up channels exist there: `@runfaster` and
`@kitchenshortcuts`.

**Not tested: a real call to Groq, YouTube or Apify.** The build
environment could not reach any of them. The clients follow each service's
published API reference, but your first real request to each is its first
real run. Before relying on it, run one request of each kind with a real
key. The thing most likely to need adjusting is strict structured output: the
JSON Schemas are generated from zod and have not been accepted by the live API yet.
If Groq rejects one, remove that model from `GROQ_STRICT_JSON_MODELS` to use
JSON-object mode instead.

## What is and is not built

Reference features were taken from the public pages of sandcastles.ai. The
logged-in app and the help centre were not inspected.

| Reference feature | Status here |
|---|---|
| Sign up, log in, sessions | Built (email and password) |
| Google / Apple sign-in, passkeys, password reset, email verification | Not built. Need OAuth credentials and an email provider. |
| Hook writer | Built. Uses general hook patterns written for this project and your creator profile, **not** a library of proven high-view templates, which the reference has and we do not. |
| Hook library | Built from your own breakdowns (the hook of each analysed video). The reference's is drawn from its whole database. |
| Script writer | Built, streaming: from an idea, from a video breakdown (remix), or from your own draft. Six storytelling structures written for this project. |
| One-click video analysis | Built for YouTube links, where the transcript is fetched automatically. TikTok and Instagram links need a pasted transcript. Analysis is then idea, hook, format, structure and remix ideas. **Text only**: it does not see visuals, editing or audio, so there is no visual-layout breakdown. |
| Watchlist, channel tracking, outlier feed | Built for **YouTube** through Google's official API, and for **Instagram accounts** through Apify. |
| TikTok | Single videos by link only. Whole-account monitoring is not built: no free source lists a TikTok account's videos. |
| Monitoring of uploads, views, subscribers, momentum | Built for YouTube and Instagram accounts. Runs while the app is running; history starts when a channel is added. Each Instagram account check is one Apify run. |
| Reports | A channel report (what is working, topics, title patterns, recommendations) is built. The reference's other report types are not. |
| Your own channel's stats | Built by marking a YouTube channel as yours (public numbers only; no account connection, so no private analytics such as retention). |
| Creator profile | Built as one text field that shapes hooks and scripts. |
| Saved outputs | Built as a Library with a filter by type. Projects and folders are not built. |
| Usage stats | Built. No plans or credit quotas: personal use. |
| Admin limits and quotas | Built, in Settings for admins. |
| Curated Collections, database of millions of outlier videos | Cannot be reproduced. They are the reference's own data. |
| Finding new channels in your niche | Not built. |
| Bulk analysis, workspaces, guest access, public API, MCP server | Not built. |
| Interface | Built for the features above, desktop and phone, with our own design. It follows the reference's flow (watchlist, videos, analysis, script) as described in writing; the reference's logged-in screens and demo video were not seen. |
| Changing name, email or password in Settings | Not built. |
I fucking hate this life because i just hate it oh my god nada danndasa asdjdn ada dan sda sa dasdhad aasd 
