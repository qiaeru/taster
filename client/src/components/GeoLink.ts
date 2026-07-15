// SPDX-License-Identifier: MIT
// GPS coordinates block. The geo: URI lets Android offer the user's preferred
// maps app; iOS handles geo: poorly, so plain OpenStreetMap and Google Maps
// fallbacks are always visible. These are outbound links the visitor clicks:
// the app itself never calls an external host (no embedded tiles).

import type { GeoPoint } from "@taster/shared";
import { icon } from "./Icon.js";
import { t } from "../i18n/index.js";

export function geoLink(location: GeoPoint): HTMLElement {
  const { lat, lng } = location;
  const wrap = document.createElement("div");
  wrap.className = "geo-block";

  const head = document.createElement("h2");
  head.className = "detail-subhead";
  head.appendChild(icon("map-pin", "icon icon-sm"));
  head.appendChild(document.createTextNode(t("detail.location")));
  wrap.appendChild(head);

  const list = document.createElement("div");
  list.className = "geo-links";

  const geo = document.createElement("a");
  geo.href = `geo:${lat},${lng}`;
  geo.className = "btn";
  geo.appendChild(icon("map-pin", "icon icon-sm"));
  geo.appendChild(document.createTextNode(t("detail.location.geo")));
  list.appendChild(geo);

  const osm = document.createElement("a");
  osm.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  osm.target = "_blank";
  osm.rel = "noopener noreferrer";
  osm.className = "btn";
  osm.textContent = t("detail.location.osm");
  list.appendChild(osm);

  const gmaps = document.createElement("a");
  gmaps.href = `https://www.google.com/maps?q=${lat},${lng}`;
  gmaps.target = "_blank";
  gmaps.rel = "noopener noreferrer";
  gmaps.className = "btn";
  gmaps.textContent = t("detail.location.gmaps");
  list.appendChild(gmaps);

  wrap.appendChild(list);
  return wrap;
}
