# CompConf — Bus → Searchable Owner's Manual

**Project:** VendorCompare  
**Brief:** VendorCompare_Brief_BusOwnersManual_2026-05-11.md  
**Date:** 2026-05-11  
**Executed by:** Heph (Subagent)  
**Status:** PASS

---

## Files Changed

| File | Action |
|---|---|
| `frontend/src/ownersManualContent.js` | **New** — Full manual content (v1.1) structured as 13 sections with subsections, exported as JS array |
| `frontend/src/components/ManualDrawer.jsx` | **New** — Searchable full-manual drawer component, dark theme, accordion sections |
| `frontend/src/components/Header.jsx` | **Modified** — Bus button rewired to `setManualOpen(true)`; removed `useTour`, `DEMO_MODE`, `showBadge`, badge span, `badgeDismissed` state; added `ManualDrawer` |
| `frontend/src/pages/Home.jsx` | **Modified** — Same bus button changes as Header.jsx; added `ManualDrawer` |

**Untouched:** `TourGuide.jsx`, `TourContext.jsx`, `main.jsx`, auth, PIN, ToS gate, HelpDrawer, backend.

---

## Implementation Summary

The bus icon (🚌) in both `Header.jsx` and `Home.jsx` previously called `startTour()` from `TourContext`, which launched the Joyride demo tour. It also showed a pulsing "Take A Tour!! 🚌" badge when `DEMO_MODE` was true.

For the John-local beta:
1. **Bus → Manual:** Both bus buttons now call `setManualOpen(true)`, opening `ManualDrawer`.
2. **Badge removed:** The `showBadge` expression, `badgeDismissed` state, `useTour()` hook, and `DEMO_MODE` import were removed from both files. No badge copy remains.
3. **ManualDrawer:** Slide-in drawer (right, full-height, `w-full sm:w-[420px]`). Matches VendorCompare dark theme (`#0E1214` background, `#2A343C` borders, `#F0EDE8` text, `#00C0C8` accent). Search input filters sections/subsections case-insensitively. Sections are accordion-expandable; search auto-expands all matching sections. Footer shows "VendorCompare Owner's Manual v1.1".
4. **Content:** All 13 sections from `VendorCompare_OwnersManual_v1.1.md` are embedded in `ownersManualContent.js`, structured as section/subsection objects with full text content. No network access required — fully static.

---

## Verification Commands & Results

### 1. Source Grep

**Bus no longer calls `startTour()`:**
```
grep -rn "startTour" src/components/Header.jsx src/pages/Home.jsx
→ CLEAN: no startTour in Header or Home
```

**"Take A Tour!!" absent:**
```
grep -rn "Take A Tour" src/components/Header.jsx src/pages/Home.jsx
→ CLEAN: no Tour badge copy in Header or Home
```

**ManualDrawer wired in both files:**
```
grep -rn "ManualDrawer\|setManualOpen" src/components/Header.jsx src/pages/Home.jsx
→ Header.jsx: import ManualDrawer, useState(false), onClick={() => setManualOpen(true)}, <ManualDrawer isOpen=.../>
→ Home.jsx: same pattern confirmed
```

### 2. Frontend Build

```
npm run build
→ ✓ 524 modules transformed.
→ ✓ built in 6.95s
→ Exit code 0
```

### 3. Artifact Grep

**Manual content present in built JS:**
```
grep -c "Owner's Manual" dist/assets/index-DOhnT0MV.js        → 2
grep -c "VendorCompare is a procurement management tool"       → 1
grep -c "Periodic Automatic Replenishment"                     → 4
```

**"Take A Tour" absent from artifact:**
```
grep "Take A Tour" dist/assets/index-DOhnT0MV.js
→ NOT FOUND — clean
```

---

## Commit

```
commit 2603904
Replace demo tour bus with searchable Owner's Manual
```

Files: `Header.jsx`, `Home.jsx`, `ManualDrawer.jsx` (new), `ownersManualContent.js` (new)

---

## Known Caveats

1. **TourGuide still in bundle:** `TourGuide.jsx` and `TourContext.jsx` remain in `main.jsx`. The Joyride tour is still mounted in the React tree (runs if `tourRunning` is set to true via `TourContext`). The bus no longer triggers it, but the code is not dead-stripped. This is per-spec ("Leave TourGuide.jsx and TourContext alone unless clean removal is low-risk. Disabling bus launch is sufficient.").
2. **Chunk size warning:** The main bundle is 1,047 kB before gzip (325 kB gzip). This is a pre-existing condition unrelated to this change (manual content adds ~30 KB raw). Not a blocker.
3. **dist/ excluded from commit:** `.gitignore` excludes `frontend/dist/`. The build artifact is local only — consistent with existing project convention.
4. **No VITE_DEMO_MODE environment variable check required:** `DEMO_MODE` was only used for the badge. With the badge removed from Header and Home, the variable has no visible effect on the bus path even if set in an env file.

---

## Final Status: PASS

All positive ACs met. No negative ACs violated. Build clean. Manual content present in artifact. Tour launch copy absent from artifact.
