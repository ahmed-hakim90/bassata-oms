# Activity matrix smoke results

**Date:** 2026-08-08  
**Plan:** Top 5 gaps — P2  
**Environment:** Automated local/CI checks + staging browser (manual)

## Honesty gate

Browser end-to-end for all 10 activities was **not** executed in this agent session (no paired device / cashier staging session). Automated unit gates related to activity flags **Pass**. Manual rows stay open until an operator signs them on staging.

## Automated

| Check | Result |
|-------|--------|
| `tests/unit/business-activity-flags.test.ts` (10 activities matrix) | **Pass** |
| `tests/unit/custom-domain.test.ts` (host rules + credit copy) | **Pass** |
| Presets / templates for bakery + pharmacy in `constants.ts` | **Present** |

## Manual matrix (staging)

Path per activity: Settings → apply activity → template product → open session → sale mode → close → daily/sessions report.

| Activity | Expected sale mode | Manual status |
|----------|-------------------|---------------|
| cafe | retail (+ variants) | **Not run** |
| ice_cream | retail + recipes/FEFO | **Not run** |
| juice_bar | retail + recipes | **Not run** |
| supermarket | retail + weight/amount | **Not run** |
| restaurant | retail + modifiers/KDS | **Not run** |
| retail | retail | **Not run** |
| wholesale | wholesale + credit | **Not run** |
| mixed | retail/wholesale + credit | **Not run** |
| bakery | retail + recipes/weight optional | **Not run** |
| pharmacy | retail + batch expiry block | **Not run** |

## Operator sign-off

| Field | Value |
|-------|-------|
| Operator | _pending_ |
| Staging URL | _pending_ |
| Date signed | _pending_ |

When complete: set each row to **Pass** / **Fail** with one-line notes; do not mark Milestone exit until all required activities are Pass.
