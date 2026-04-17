# BetterCode v1.0.0 — Perf Baseline

Recorded: 2026-04-17
Reference machine: M1 MacBook Pro 16GB (document substitute if different)

## Methodology

See Appendix A of `implementation.md` for the measurement definitions.

- **Keystroke-to-paint**: wall-clock from `useInput` receiving a key to the Ink re-render commit that includes the new value (via `BETTERCODE_PERF_HUD=1`).
- **Scroll FPS**: moving average FPS while page-up is held on a 10k-message transcript.
- **Streaming CPU%**: sampled from `ps -o %cpu -p <pid>` every 500 ms during a tool-heavy turn.
- **Memory (RSS)**: from `ps -o rss -p <pid>` at each transcript size.

## Baseline measurements (pre-M1)

> To be filled in once M0.1 Perf HUD is verified working.

| metric | 0 msg | 100 msg | 1000 msg | 10000 msg | target |
|--------|-------|---------|----------|-----------|--------|
| keystroke p50 (ms) | — | — | — | — | < 8 ms |
| keystroke p95 (ms) | — | — | — | — | < 16 ms |
| scroll FPS | — | — | — | — | ≥ 30 FPS |
| streaming CPU% | — | — | — | — | < 30% |
| RSS (MB) | — | — | — | — | < 200 MB |

## Post-M3 measurements

> To be filled in after M3 performance work is complete.

| metric | 0 msg | 100 msg | 1000 msg | 10000 msg | met? |
|--------|-------|---------|----------|-----------|------|
| keystroke p50 (ms) | — | — | — | — | — |
| keystroke p95 (ms) | — | — | — | — | — |
| scroll FPS | — | — | — | — | — |
| streaming CPU% | — | — | — | — | — |
| RSS (MB) | — | — | — | — | — |
