# Workflow: icons

Every `icon:` line comes out of this ladder, never from memory. Rules,
families, verified names and placement: `${CLAUDE_SKILL_DIR}/reference/icons.md`.

## Ladder

1. Decide (reference/icons.md sections 1-2): which nodes get an icon, if
   any, and which ONE family (lucide by default; k8s for Kubernetes; logos
   only when every icon node is a named product).
2. Name each concept from the tables (reference/icons.md sections 6-8).
   Table names are verified; go to step 5.
3. Not in a table: search, one keyword per concept.

   ```sh
   sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh search cart
   sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh search "credit card"
   sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh search cosmos tt
   ```

   It prints `prefix:name` lines, best first: the exact name, names that
   match every word, lucide, then the other prefixes. The second argument
   picks the sets: default `lucide,logos,k8s`, any Iconify list (`gcp`),
   `all`, or `tt` (Terrastruct AWS/Azure/GCP stencils, printed as URLs).
   Iconify matches ALL the words of a query, so the script also queries
   each word alone. Take names from the diagram's family only.
4. Verify every searched name, all in one call. Each must print `200` with
   no note:

   ```sh
   sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh verify lucide:shopping-cart lucide:truck
   ```

5. Fetch local copies into an `icons/` folder next to the .d2, in one call.
   The color defaults to `475569` (neutral theme); pass `--color 11567F`
   for the Snowflake theme. logos and k8s icons keep their colors. Files are
   named `<name>.svg` for lucide, `<prefix>-<name>.svg` otherwise
   (`k8s-pod.svg`) and `terrastruct-<name>.svg` for a URL from `search ... tt`,
   which lets semcheck see the family. A failed ref is reported and skipped.

   ```sh
   sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh get lucide:server lucide:mail <dir-of-d2>/icons/
   ```

6. Reference each file by a path relative to the .d2 file
   (`./icons/server.svg`): d2 resolves it from the file, not from the
   working directory. Never an absolute path: it breaks for anyone else.
7. Render with d2check. Fix `E-icon-collision` and `S-src-icon-family`
   with `${CLAUDE_SKILL_DIR}/workflows/review-and-fix.md`.

```d2
# cwd: ../assets
vars: {d2-config: {layout-engine: elk; pad: 24}}
# icon-top: the compact card of reference/icons.md section 5
classes: {icon-top: {height: 64; icon.near: top-center; label.near: bottom-center}}
api: "Orders API\nGo" {class: icon-top; icon: ./icons/server.svg}
mail: "Email\nSendGrid" {class: icon-top; icon: ./icons/mail.svg}
api -> mail: receipts
```

Local copies instead of `icon: https://...` URLs: d2 fetches remote icons on
every render (no cache) and fails the render when the host is down or rate
limits (Iconify answers bursts with 429), and rsvg drops remote icons. Local
files render offline, and rsvg shows them.

## Failure ladder

| Symptom | Next step |
|---|---|
| `search` prints `no results` (exit 1) | a synonym or broader word (`throttle` -> `gauge`, `revert` -> `undo`); then the nearest table concept; then no icon |
| results are off-topic (`load` also matches `upload`) | a more specific single word, or the nearest table concept |
| `verify` prints 404 | the name does not exist: back to step 3 |
| `verify` note `alias: prefer <name>` | use the name it prefers |
| `verify` note `deprecated` | search again for the current name |
| exit 3, `host unreachable` | offline: for lucide, `get` falls back to unpkg, then to the 40 pack names (reference/icons.md section 9); other families: no icon |
| exit 3, `rate limited (429)` | a logos or k8s ref (lucide falls back to unpkg): wait a minute and rerun |
| `get` note `has fixed colors` | a logo or k8s icon: expected, colors are kept |
| render error `failed to bundle ./icons/x.svg: ... no such file` | the path is relative to the .d2 file: fix it or re-run step 5 |
| render error `failed to bundle https://...: expected status 200 but got 404` (or 429) | unverified or rate-limited remote URL: steps 4-5 |
| an icon renders black | an unpinned lucide icon (a URL without `?color=%23<hex>`, or `get` with `-`): fetch it with step 5 |
| no icon fits the concept or the family | no icon: the label carries the meaning. Never an emoji. |

To re-color the icons of a finished diagram (for example, a neutral diagram
moving to the Snowflake theme):
`sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh tint 11567F <dir-of-d2>/icons <dir-of-d2>/icons`.
