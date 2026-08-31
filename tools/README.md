# Verification harness

Run everything:

    node tools/verify.js            # all checks
    node tools/verify.js --quick    # skip the ~8min responsive sweep
    node tools/verify.js smoke cursor

Prove the harness still detects bugs:

    node tools/selftest.js

## The checks

| Script | Catches |
|---|---|
| `smoke.js` | Pages that fail to load, 404s on images/CSS/JS, console errors |
| `cursor-check.js` | The custom cursor drifting away from the real pointer |
| `behaviour.js` | Mode resolution, mobile menu, floorplan dialog, focus handling |
| `link-check.js` | Internal links that 404 on case-sensitive hosting |
| `responsive.js` | Sideways overflow, clipped text, sub-24px tap targets, at 11 widths |
| `shoot.js` | Before/after screenshot diffing for refactors |

## Why selftest.js exists

A suite that always passes is indistinguishable from one that *cannot*
pass. That failure mode has already bitten this rebuild three times:

- the cursor drifted half a screen off the pointer on 25 pages while every
  check stayed green, because screenshots hide the cursor and nothing
  measured its position;
- the screenshot differ was trusted before anyone confirmed it could
  report a difference at all;
- an image-reference audit passed while missing refs sat hidden inside
  entity-encoded inline styles.

`selftest.js` deliberately breaks the site in five known ways and asserts
the matching check goes red. **If you add a check to `verify.js`, add a
mutation for it here**, or there is no evidence the check works.

Mutations are restored in a `finally` block *and* on SIGINT/SIGTERM/exit,
because an earlier version was killed by a timeout mid-mutation and left a
broken `craft.html` behind. The suite also refuses to start if `dist/` has
uncommitted changes, so a crash can never be confused with your own edits.

## Screenshots

`shoot.js` writes to `.screens/` (gitignored):

    node tools/shoot.js baseline    # before a refactor
    node tools/shoot.js after       # after
    node tools/shoot.js diff        # report pixel deltas

Fonts and analytics are blocked during capture so shots are deterministic
regardless of network.

## Image tooling

    node tools/convert-to-webp.js <dir> [quality]   # skips existing .webp
    node tools/audit-image-refs.js                  # resolves refs like a browser
    node tools/rewrite-raw-refs.js --write          # repoint jpg/png at .webp
