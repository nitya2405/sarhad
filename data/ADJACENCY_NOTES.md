# Adjacency notes — `adjacency.v1.json`

The border graph is **hand-curated** and reviewed edge by edge (DESIGN, "Adjacency data").
The map geometry is used to draw the map and as a cross-check, never as the source of truth.

- 33 playable regions (28 states + CH, DD, DL, JK, LA), **64 undirected edges**, symmetric.
- Not playable, no guess spent: **AN, LD, PY**.
- Separate pieces of one UT never connect to each other.

## Cross-check against the map file (15 Oct 2026)

Source: `data/raw/simplemaps-in-admin1.geojson` (see `SOURCES.md`).
`scripts/check-adjacency.ts` recomputes touching pairs from the raw geometry (~1 km tolerance).

**63 borders agree** with the geometry. Deliberate differences:

| Pair | Geometry | Graph | Ruling |
| --- | --- | --- | --- |
| HR–UK | no contact | removed | Draft edge dropped: Haryana and Uttarakhand do not touch. |
| AP–CG | no contact | **kept** | File appears to predate the 2014 transfer of seven Khammam mandals (incl. Bhadrachalam area) from Telangana to Andhra Pradesh, which gave AP a border with Chhattisgarh. Pending confirmation on the official political map. |
| OD–TG | ~53 km contact | **excluded** | Same cause: after the 2014 transfer, that stretch borders Andhra Pradesh, not Telangana. Pending confirmation on the official political map. |
| PY–AP, PY–KL, PY–TN | contact | excluded | Puducherry's pieces (Puducherry/Karaikal, Mahé, Yanam) each touch a different state; pieces never connect to each other, so PY is not playable. |

## Other notes

- **HP–UP** is a real border but only ~5 km long. Kept.
- **DD** (Dadra & Nagar Haveli and Daman & Diu) is playable via its **Dadra & Nagar Haveli** piece,
  which touches both Gujarat and Maharashtra. Daman and Diu touch only Gujarat (and Diu only the sea).
- **JK–LA**, **HP–LA**, **JK–HP**, **JK–PB** agree with the geometry.
- **DL** touches only HR and UP; **CH** touches only PB and HR.

## Changing the graph

Any change bumps the version (`adjacency.v2.json`), re-runs `npm run data:build`, and must never edit
past entries of `daily.json`.

## Latest `check-adjacency.ts` run

64 edges; 67 touching pairs in the file (≤ 1 km); 63 agree. Contact lengths as measured by the script
(approximate; segments within 1 km): OD–TG ~46 km, PY–TN ~160 km, PY–KL ~57 km, PY–AP ~27 km,
HP–UP ~3.5 km. HR–UK: no contact. AP–CG: no contact in the file (kept, see above).
