// SPDX-License-Identifier: MIT
// Heroicons wrapper. SVGs are imported raw from the npm package and bundled;
// no external request ever. Category icons are stored by name in the
// database, resolved through CATEGORY_ICONS with a safe fallback.

import filmO from "heroicons/24/outline/film.svg?raw";
import tvO from "heroicons/24/outline/tv.svg?raw";
import puzzleO from "heroicons/24/outline/puzzle-piece.svg?raw";
import cakeO from "heroicons/24/outline/cake.svg?raw";
import bookOpenO from "heroicons/24/outline/book-open.svg?raw";
import musicalNoteO from "heroicons/24/outline/musical-note.svg?raw";
import tagO from "heroicons/24/outline/tag.svg?raw";
import sparklesO from "heroicons/24/outline/sparkles.svg?raw";
import beakerO from "heroicons/24/outline/beaker.svg?raw";
import globeO from "heroicons/24/outline/globe-alt.svg?raw";
import paintBrushO from "heroicons/24/outline/paint-brush.svg?raw";
import cameraO from "heroicons/24/outline/camera.svg?raw";
import trophyO from "heroicons/24/outline/trophy.svg?raw";
import rocketO from "heroicons/24/outline/rocket-launch.svg?raw";
import mapPinO from "heroicons/24/outline/map-pin.svg?raw";
import sunO from "heroicons/24/outline/sun.svg?raw";
import moonO from "heroicons/24/outline/moon.svg?raw";
import languageO from "heroicons/24/outline/language.svg?raw";
import magnifyingGlassO from "heroicons/24/outline/magnifying-glass.svg?raw";
import funnelO from "heroicons/24/outline/funnel.svg?raw";
import xMarkO from "heroicons/24/outline/x-mark.svg?raw";
import squares2x2O from "heroicons/24/outline/squares-2x2.svg?raw";
import listBulletO from "heroicons/24/outline/list-bullet.svg?raw";
import chartBarO from "heroicons/24/outline/chart-bar.svg?raw";
import starO from "heroicons/24/outline/star.svg?raw";
import heartO from "heroicons/24/outline/heart.svg?raw";
import plusO from "heroicons/24/outline/plus.svg?raw";
import pencilO from "heroicons/24/outline/pencil.svg?raw";
import trashO from "heroicons/24/outline/trash.svg?raw";
import arrowUpO from "heroicons/24/outline/arrow-up.svg?raw";
import arrowDownO from "heroicons/24/outline/arrow-down.svg?raw";
import arrowTopRightO from "heroicons/24/outline/arrow-top-right-on-square.svg?raw";
import arrowPathO from "heroicons/24/outline/arrow-path.svg?raw";
import arrowLeftO from "heroicons/24/outline/arrow-left.svg?raw";
import lockClosedO from "heroicons/24/outline/lock-closed.svg?raw";
import arrowRightStartO from "heroicons/24/outline/arrow-right-start-on-rectangle.svg?raw";
import documentArrowDownO from "heroicons/24/outline/document-arrow-down.svg?raw";
import documentArrowUpO from "heroicons/24/outline/document-arrow-up.svg?raw";
import photoO from "heroicons/24/outline/photo.svg?raw";
import eyeO from "heroicons/24/outline/eye.svg?raw";
import eyeSlashO from "heroicons/24/outline/eye-slash.svg?raw";
import bars3O from "heroicons/24/outline/bars-3.svg?raw";
import starS from "heroicons/24/solid/star.svg?raw";
import heartS from "heroicons/24/solid/heart.svg?raw";
import starS20 from "heroicons/20/solid/star.svg?raw";
import heartS20 from "heroicons/20/solid/heart.svg?raw";

const ICONS: Record<string, string> = {
  film: filmO,
  tv: tvO,
  "puzzle-piece": puzzleO,
  cake: cakeO,
  "book-open": bookOpenO,
  "musical-note": musicalNoteO,
  tag: tagO,
  sparkles: sparklesO,
  beaker: beakerO,
  "globe-alt": globeO,
  "paint-brush": paintBrushO,
  camera: cameraO,
  trophy: trophyO,
  "rocket-launch": rocketO,
  "map-pin": mapPinO,
  sun: sunO,
  moon: moonO,
  language: languageO,
  "magnifying-glass": magnifyingGlassO,
  funnel: funnelO,
  "x-mark": xMarkO,
  "squares-2x2": squares2x2O,
  "list-bullet": listBulletO,
  "chart-bar": chartBarO,
  star: starO,
  heart: heartO,
  plus: plusO,
  pencil: pencilO,
  trash: trashO,
  "arrow-up": arrowUpO,
  "arrow-down": arrowDownO,
  "arrow-top-right-on-square": arrowTopRightO,
  "arrow-path": arrowPathO,
  "arrow-left": arrowLeftO,
  "lock-closed": lockClosedO,
  "arrow-right-start-on-rectangle": arrowRightStartO,
  "document-arrow-down": documentArrowDownO,
  "document-arrow-up": documentArrowUpO,
  photo: photoO,
  eye: eyeO,
  "eye-slash": eyeSlashO,
  "bars-3": bars3O,
  "star-solid": starS,
  "heart-solid": heartS,
  "star-solid-20": starS20,
  "heart-solid-20": heartS20,
};

// Icons offered in the admin category editor (all resolvable above).
export const CATEGORY_ICONS = [
  "film",
  "tv",
  "puzzle-piece",
  "cake",
  "book-open",
  "musical-note",
  "tag",
  "sparkles",
  "beaker",
  "globe-alt",
  "paint-brush",
  "camera",
  "trophy",
  "rocket-launch",
  "map-pin",
] as const;

export function icon(name: string, className = "icon"): SVGElement {
  const raw = ICONS[name] ?? ICONS.tag;
  const holder = document.createElement("div");
  holder.innerHTML = raw;
  const svg = holder.querySelector("svg")!;
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  return svg;
}
