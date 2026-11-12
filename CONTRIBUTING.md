# Contributing to StoryTeller X

Thanks for helping out! A few rules keep the module maintainable and legally clean.

## Rules

1. **Do not overuse `!important`.** Fix specificity or ordering instead. An
   `!important` needs a short comment saying why it cannot be avoided. The PR
   check warns for any added `!important` and fails above 3 per PR.
2. **Third-party content needs a license that clearly allows its use.** That covers
   images, fonts, sounds and code. Allowed: CC0, public domain, CC-BY, MIT,
   Apache-2.0, BSD, OFL. Not allowed: unspecified or unclear licenses,
   "free for personal use", NC (non-commercial) and ND (no derivatives)
   licenses, and asset store licenses that forbid redistribution.
3. **New assets come with their license.** Put a `LICENSE.md` in the asset
   folder with the author, the source URL, the license name and the license
   link. Credit the author even where the license doesn't require it.
   Files in `img/git/` (module showcase screenshots) and `img/nav/` are
   excluded from this check.
4. **Every PR updates `CHANGELOG.md`** under `## [Unreleased]`. Use the sections
   Added, Changed, Fixed, Removed. PRs that truly need no entry (CI only,
   typos) carry the `skip-changelog` label.

## Releases

Pushing a tag such as `2.1.0` (or `v2.1.0`) builds and publishes the release.
Before tagging, rename `## [Unreleased]` in `CHANGELOG.md` to
`## [2.1.0] - YYYY-MM-DD` and add a fresh empty `Unreleased` section. The
section for the tag becomes the release notes.

## Checks you can run locally

```sh
node scripts/ci/check-important.mjs origin/main
node scripts/ci/check-licenses.mjs origin/main   # or "--all"
node scripts/ci/changelog-section.mjs 2.1.0
```
