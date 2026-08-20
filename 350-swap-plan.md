# Carbureted 350 Swap Plan — 1992 Chevy C1500

**Truck:** 1992 Chevrolet C1500 2WD pickup
**VIN:** 1GCDC14H7NZ174567

## VIN Decode — What You're Starting With

| Position | Value | Meaning |
|---|---|---|
| 1–3 | 1GC | USA, General Motors, Chevrolet truck |
| 4 | D | GVWR class (5,001–6,000 lb) |
| 5 | C | C-series = 2WD |
| 6–7 | 14 | 1/2-ton (1500) pickup |
| 8 | **H** | **5.7L V8 TBI (L05 350)** |
| 9 | 7 | Check digit |
| 10 | N | 1992 model year |
| 11 | Z | Fort Wayne, IN assembly |
| 12–17 | 174567 | Production sequence |

**Key takeaway:** the truck is a factory 350 TBI truck. The engine mounts, frame
brackets, radiator, transmission (4L60 / 700R4), driveshaft, and rear gears are
already sized for a 350. This project is really a **TBI-to-carburetor
conversion**, not a full engine swap in the hard sense — even if you're dropping
in a fresh or different 350 long block, it bolts to everything that's already
there.

---

## Step 0 — Legality Check (Do This First)

A 1992 truck is OBD-era and came with federal emissions equipment. Converting
to a carburetor removes the ECM, catalytic-converter feedback control, and EGR
function, which is **not street legal in most U.S. states** (and California in
particular). Before spending money:

- Check your state's emissions/inspection requirements for a 1992 light truck.
- If your county has no emissions testing, you're likely fine practically, but
  federally the equipment is still required on a road vehicle.
- If it's an off-road, farm, or race truck, none of this applies.

## Step 1 — Plan the Engine Itself

- If reusing the existing L05 350: it's a solid roller-cam block and takes a
  carb intake fine. TBI heads are swirl-port with small valves — fine for a
  stock-ish build, a limitation if you want real power.
- If building/buying a carbureted 350: any Gen I small block bolts to your
  mounts and 4L60. Verify the flexplate matches (1986+ 350s are one-piece rear
  main seal and need the matching flexplate/balance).
- Decide your cam now — it drives carb size, converter stall, and vacuum for
  power brakes. A mild cam (under ~220° @ .050) keeps good idle vacuum for the
  stock brake booster.

## Step 2 — Intake and Carburetor

- Replace the TBI intake manifold with a carbureted dual-plane intake
  (Edelbrock Performer or similar) for a street truck.
- Carb sizing for a mild 350: **600–650 CFM** (Holley 0-80457 600 vacuum
  secondary, or Edelbrock 1406 600). Bigger is not better on a truck.
- Choose electric choke — simplest wiring (one keyed 12V wire).
- Check hood clearance with the air cleaner: use a drop-base air cleaner if the
  stock height doesn't fit under the GMT400 hood.

## Step 3 — Ignition (Mandatory Change)

The factory TBI distributor has **no advance mechanism** — the ECM controls
all spark timing. Remove the ECM and the engine will not run right on that
distributor.

- Install a standalone HEI distributor (with mechanical + vacuum advance) —
  one 12V wire and it's running. Cheap and reliable.
- Run a fresh dedicated 12-gauge keyed 12V feed to the HEI (it wants full
  battery voltage, no resistance wire).
- Set initial timing ~8–12° BTDC, total ~34–36° all in by ~3,000 RPM.

## Step 4 — Fuel System (The Big One)

The factory in-tank TBI pump puts out ~9–13 psi. A carburetor needs
**5–7 psi max** or it will flood. Pick one approach:

1. **Keep the in-tank pump + return-style low-pressure regulator** (e.g.
   Holley 12-804 with the return port plumbed to the factory return line).
   Cleanest option — the truck already has feed and return lines.
2. **Replace with a low-pressure electric pump** (Carter/Holley 4–7 psi) near
   the tank, with an oil-pressure or inertia safety cutoff switch.
3. **Mechanical pump on the block** — only if your block has the fuel pump
   boss drilled and you add the pushrod (and a bolt-on cam eccentric if the
   cam is roller). Many TBI-era blocks have the boss cast but usable; verify
   before counting on it.

Also: keep the charcoal canister and hook the carb's bowl vent/purge to it if
you want to keep fuel smell down (and stay closer to legal).

## Step 5 — Transmission (Don't Skip This)

Your 4L60 (700R4) is hydraulically controlled **except** for two things:

1. **TV cable geometry is critical.** The TV (throttle valve) cable must be
   connected to the carb linkage at the correct ratio and adjusted properly —
   wrong geometry means low line pressure and a burned transmission in weeks.
   Use a corrected-geometry bracket kit made for carb + 700R4 (Sonnax or TV
   Made EZ if you want it idiot-proof).
2. **Torque converter lockup (TCC) was ECM-controlled.** With the ECM gone,
   the converter never locks — it works, but adds heat and hurts highway MPG.
   Install a simple lockup wiring kit (vacuum-switch or 4th-gear-pressure-switch
   type) so it locks in 4th.

Add or verify a transmission cooler while you're in there.

## Step 6 — Wiring and Electronics Cleanup

- Remove the ECM, TBI injector/sensor harness, O2 sensor, and related relays.
  Label everything; don't hack the main harness — depin or tape back.
- **Keep intact:** charging system, starter, gauge senders (oil pressure,
  temp), and the **VSS/speedometer circuit**. The 1992 cluster's electronic
  speedometer is fed by the transmission VSS through the DRAC buffer module —
  that circuit does not need the ECM, so leave it alone and the speedo keeps
  working.
- The Check Engine light will stay dead (fine) — just make sure removing the
  ECM fuse doesn't share a circuit with something you need (check the fuse box
  diagram).
- New throttle cable: the TBI cable may not reach/fit the carb linkage — use a
  universal or Lokar-style cable and bracket that also anchors the TV cable.

## Step 7 — Supporting Details

- **Cooling:** stock V8 radiator carries over; new thermostat (195°F street),
  fresh hoses.
- **Vacuum:** manifold vacuum to brake booster (big port), ported vacuum to
  distributor advance, manifold vacuum to trans modulator if equipped, PCV
  valve to the carb base.
- **Exhaust:** stock manifolds bolt up. If the cats are gutted/removed note the
  legality issue in Step 0.
- **Fluids & first start:** break-in oil with ZDDP if it's a fresh flat-tappet
  cam, prime the oil system, set timing statically, fill the carb bowl before
  cranking.

## Step 8 — Tune and Shake Down

1. Set base timing with vacuum advance disconnected, then total timing.
2. Set idle mixture screws for highest vacuum, then idle speed.
3. Adjust and road-test the TV cable per the bracket kit's procedure —
   verify firm 1–2 shift at part throttle before any hard driving.
4. Verify fuel pressure at the carb inlet (5–7 psi) under load.
5. Confirm TCC lockup engages on the highway.

---

## Rough Parts List

| Item | Notes | Rough Cost |
|---|---|---|
| Dual-plane intake manifold | Edelbrock Performer or equiv. | $250–350 |
| Carburetor 600–650 CFM | Holley or Edelbrock, electric choke | $350–500 |
| HEI distributor + plug wires | Standalone, vacuum advance | $150–300 |
| Fuel pressure regulator (return style) or low-psi pump | See Step 4 | $50–150 |
| TV cable corrected-geometry bracket kit | Critical for 700R4 | $50–100 |
| TCC lockup wiring kit | Vacuum-switch type | $30–80 |
| Throttle cable + bracket | Universal/Lokar style | $40–80 |
| Air cleaner (drop base if needed) | Check hood clearance | $30–80 |
| Gaskets, hoses, thermostat, fluids, misc | — | $100–200 |
| **Total (conversion only, engine not included)** | | **~$1,050–1,850** |

## Suggested Order of Work

1. Legality check (Step 0)
2. Buy parts; verify flexplate/balance match if the engine is changing
3. Engine out (if swapping the long block) or intake off (if converting in place)
4. Intake, carb, distributor on the engine
5. Fuel system conversion at the frame/tank
6. Wiring cleanup + new HEI feed + throttle/TV cables
7. Cooling and vacuum hookups
8. First start, timing, carb tune
9. TV cable adjustment and road test
10. TCC lockup verification
