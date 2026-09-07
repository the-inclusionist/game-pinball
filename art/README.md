<!-- SPDX-License-Identifier: CC0-1.0 -->
# The table art

**Seven playfield pictures, one per playable table.** They are dedicated under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) and **no copyright is
claimed over them**.

| | |
|---|---|
| tool | Google Gemini ("Nano Banana") |
| prompted by | José Rocha |
| when | September 2026 |
| dedication | CC0 1.0 Universal |
| copyright claimed | none |

## Why CC0 and not a share-alike licence

The Dev's first choice was CC BY-SA 4.0, to match the reason the engine is AGPL: work that stays open
when someone reuses it. It was changed on one fact — the pictures are machine-generated.

A Creative Commons licence operates **on a copyright**, and a copyright needs a human author (Lei
9.610/98 art. 11). Putting ShareAlike on purely machine-generated images would assert a restriction
nobody would have standing to enforce. CC0 works whether or not a copyright exists: it dedicates any
rights that may exist and carries a permissive fallback for jurisdictions where a dedication is not
possible. It asserts nothing that might turn out to be false.

Using the output is a separate and simpler question: Google's terms for Gemini do not claim ownership
and permit use. That is *permission*, not *copyright*, and only the second decides what licence can be
applied.

The full argument, and what would change the answer, is in [`docs/LICENSES.md` §4.1](../docs/LICENSES.md).

## What these files are for

Each picture is the **playfield**, not the screen. The game's screen is 320×180 and the camera scrolls;
the playfield is the canvas the art has to fit, at these exact sizes:

| table | playfield | visible at once | camera travel |
|---|---|---|---|
| `low-orbit` | 183 × 235 | 183 × 180 | 55 px vertical |
| `ion-storm` | 183 × 250 | 183 × 180 | 70 px vertical |
| `crater-run` | 183 × 260 | 183 × 180 | 80 px vertical |
| `slipstream` | 183 × 245 | 183 × 180 | 65 px vertical |
| `long-climb` | 183 × 300 | 183 × 180 | 120 px vertical |
| `ring-belt` | 360 × 240 | 320 × 180 | 40 px horizontal + 60 vertical |

## How a picture becomes an asset

```bash
python scripts/import-art.py            # every table
python scripts/import-art.py low-orbit  # just one
```

It reads `art/<table>.jpg`, area-averages it down to the playfield, places the picture's **median**
lightness at CIE L\* 25, holds every pixel under the ceiling the **ball** sets (3:1 against
(238, 242, 248) allows L\* 58.2), quantises to 192 colours and writes `app/assets/tables/<table>.png`.

⚠️ **That script exists because the one that made the first six did not.** It lived in a scratch
directory and is gone, and nobody could say afterwards what dim it had applied — measured after the
fact, it was seven per cent lightness, which is what "as cores das mesas ficaram escuras demais" was
about. The reasoning for both numbers is in the script's own header and in
[`ADR-0008`](../docs/2-Architecture/adr/ADR-0008-contrast-is-measured-at-the-boundary-not-over-the-picture.yaml).

⚠️ **Source art is downscaled, so its size should be an exact multiple of the target.** A 4:1 reduction
is a clean box filter — every output pixel is exactly sixteen input pixels — and preserves the pixel
grid. A ratio like 4.37:1 destroys it. The 4× sizes are 732 × 940, 732 × 1000, 732 × 1040, 732 × 980,
732 × 1200 and 1440 × 960.
