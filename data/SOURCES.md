# Data sources

## India admin-1 boundaries — `data/raw/simplemaps-in-admin1.geojson`

- **Source:** SimpleMaps — India GIS data, admin-1 (states and union territories), GeoJSON.
  https://simplemaps.com/gis/country/in
- **Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0).
  https://creativecommons.org/licenses/by/4.0/
- **Downloaded:** 15 Oct 2026. 36 features, properties `source`, `id` (e.g. `INMH`), `name`.
- **Required attribution** (shown in the app footer and README):
  > Map data © SimpleMaps (simplemaps.com), licensed under CC BY 4.0.
- **Modifications:** ids remapped to two-letter codes (see `data/regions.json`), geometry
  simplified with mapshaper and projected with d3-geo into `src/data/map.json`.

### Known quirks

- Uses old labels **Orissa** (`INOR`) and **Uttaranchal** (`INUT`); the app shows Odisha and Uttarakhand.
- Appears to predate the **2014 transfer of seven Khammam mandals** from Telangana to Andhra Pradesh:
  the file shows an Odisha–Telangana contact (~53 km) and no Andhra Pradesh–Chhattisgarh contact.
  See `data/ADJACENCY_NOTES.md` for how the border graph rules on this.
- Ladakh reaches 37.08°N / 80.33°E and J&K 73.4°E, matching India's official depiction (checked 15 Oct 2026).
