# Space Cadet Pinball — TypeScript port

The pinball engine of *3D Pinball for Windows — Space Cadet*, ported from the
[k4zmu2a decompilation](https://github.com/k4zmu2a/SpaceCadetPinball) (MIT) to TypeScript, running as a
consumer of the Inclusionist accessibility engine.

## What this is, and what it is not

It is the **engine**: physics, collision, the z-buffer compositor and the mission state machine, transcribed
faithfully. It is **not** a redistribution of the game. No Microsoft asset is vendored here, ever.

The port runs in two configurations:

| | table data | screen | purpose |
|---|---|---|---|
| **validation** | original `PINBALL.DAT`, supplied locally by you | playfield 365x470 halved to 183x235 inside 320x180 | prove the physics matches the original |
| **shipping** | original table authored for 320x180 | authored to fit | the game that ships |

The validation configuration exists for one reason: physics and table are two variables, and changing both
at once leaves no way to isolate a bug.

## Original game data

`PINBALL.DAT`, the ~60 WAV files and the 2 MIDI files are third-party work and are listed in
`.gitignore`. To run the validation configuration you supply them yourself:

```
npm run data:extract
```

## License

Code: **AGPL-3.0-or-later** (see `LICENSE`). Art follows its own author's terms — see the license note in
`docs/`. The upstream decompilation is MIT; attribution is preserved in `docs/CREDITS.md`.
