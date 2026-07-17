# Syncing with upstream Shopify/horizon

This fork tracks [Shopify/horizon](https://github.com/Shopify/horizon) and layers
Lantern Sol customizations on top. Because this repo is a *real* GitHub fork of
Horizon (not a copy), upstream updates merge cleanly via standard git.

## Remote layout

| Remote     | URL                                         | Role                                 |
| ---------- | ------------------------------------------- | ------------------------------------ |
| `origin`   | `dev-lanternsol/horizon`                    | Our fork — push here                 |
| `upstream` | `Shopify/horizon`                           | Shopify's official theme — read-only |

First-time setup on a new clone:

```bash
git clone https://github.com/dev-lanternsol/horizon.git
cd horizon
git remote add upstream https://github.com/Shopify/horizon.git
git fetch upstream
```

## Updating to a new Horizon release

When Shopify ships a new Horizon version (e.g. v3.5.0):

```bash
# 1. Pull the latest upstream
git fetch upstream

# 2. Create a sync branch from main
git checkout main
git pull origin main
git checkout -b sync/horizon-v<version>

# 3. Merge upstream
git merge upstream/main

# 4. Resolve any conflicts
#    - Customizations in shared files may collide with upstream changes
#    - See CUSTOMIZATIONS.md below for what's expected to be ours
#    - Prefer LS customizations, but adopt upstream refactors when the
#      surrounding code has moved on

# 5. Commit and push
git push -u origin sync/horizon-v<version>

# 6. Open a PR against main and merge after review/QA
```

Alternative using GitHub's "Sync fork" button: for upstream releases that don't
touch any files we customize, the GitHub web UI can auto-merge. For anything
else, use the CLI flow above so you get the chance to review conflicts.

## Customizations overview

Files added or modified by Lantern Sol relative to stock Horizon. When a new
upstream release changes any of these, expect a conflict to resolve.

### Added files (LS-owned, won't conflict)

**Sections**
- `sections/animated-slideshow.liquid`
- `sections/circular-arc.liquid`
- `sections/scroll-image-sequence.liquid`

**Blocks**
- `blocks/_arc-feature.liquid`
- `blocks/ai_gen_block_9b1a4f7.liquid`
- `blocks/article-card.liquid`, `article-icon.liquid`, `article-image.liquid`, `article-text.liquid`
- `blocks/hovering-text.liquid`
- `blocks/slideshow.liquid`

**Snippets**
- `snippets/dialog-popup-page.liquid`
- `snippets/spacing-marging.liquid`

**Assets**
- `assets/component-parallax.js`
- `assets/icon-slider-arrow.svg`

**Templates**
- `templates/page.about-us.json`

### Shared-file customizations (will conflict on upstream refactor)

| File                                    | LS change                                            |
| --------------------------------------- | ---------------------------------------------------- |
| `config/settings_schema.json`           | Branded as "Horizon: LS Mod" by Lantern Sol          |
| `assets/base.css`                       | Responsive mobile font-size for primary button       |
| `assets/utilities.js`                   | `isTouchPrimary()`; header drawer gated on it        |
| `layout/theme.liquid`                   | Inline `setHeaderMenuStyle` mirrors `isTouchPrimary` |
| `sections/hero.liquid`                  | `parallax` + `hidden--mobile` modifier classes       |
| `snippets/text.liquid`                  | `mobile_text` support + ® superscript replacement    |
| `snippets/slideshow.liquid`             | Expanded timeline scope, slides-to-scroll, auto-hide |
| `snippets/slideshow-controls.liquid`    | Expanded pagination/scroll-mode/arrow options        |
| `snippets/theme-styles-variables.liquid`| Expanded font-weight variants (thin/extra-light/etc) |
| `blocks/_product-card-gallery.liquid`   | `has_applied_colour_filter` logic                    |
| `templates/product.json`                | LS-specific block layout                             |

## How this fork came to be

The previous Lantern Sol theme repo was `Lantern-Sol/ls-horizon`, seeded as a
copy of Horizon v3.0.0 (no shared git history with Shopify/horizon). It never
received upstream updates — the "Update from Shopify" bot commits in that repo
are Shopify admin theme-editor autosaves, not Horizon releases.

On 2026-04-20 the repo was retired in favor of this fresh fork at
`dev-lanternsol/horizon`, and customizations were ported forward via a 3-way
merge using Horizon v3.0.0 as the merge base. Formatting noise (leading blank
lines from an earlier auto-formatter pass) was stripped during the port to
minimize drift.

## Why not just copy-fork again next time?

A real GitHub fork lets us:
- Merge upstream Horizon releases with `git merge` (no manual file copying)
- See "N commits behind" indicators in the GitHub UI
- Use the "Sync fork" button for clean releases
- Let Shopify's `shopify[bot]` theme-editor integration push admin changes back

Copy-forks fight every one of these.
