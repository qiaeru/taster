// SPDX-License-Identifier: MIT
// Heroicons wrapper. The icons used by the UI itself are imported raw and
// bundled; any other outline icon (category icons are stored by name in the
// database) resolves through a lazy per-icon chunk, so every Heroicons name
// works without bloating the initial bundle. No external request ever.

import filmO from "heroicons/24/outline/film.svg?raw";
import tvO from "heroicons/24/outline/tv.svg?raw";
import puzzleO from "heroicons/24/outline/puzzle-piece.svg?raw";
import cakeO from "heroicons/24/outline/cake.svg?raw";
import storefrontO from "heroicons/24/outline/building-storefront.svg?raw";
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
import xMarkO from "heroicons/24/outline/x-mark.svg?raw";
import chevronDownO from "heroicons/24/outline/chevron-down.svg?raw";
import squares2x2O from "heroicons/24/outline/squares-2x2.svg?raw";
import listBulletO from "heroicons/24/outline/list-bullet.svg?raw";
import starO from "heroicons/24/outline/star.svg?raw";
import heartO from "heroicons/24/outline/heart.svg?raw";
import plusO from "heroicons/24/outline/plus.svg?raw";
import pencilO from "heroicons/24/outline/pencil.svg?raw";
import trashO from "heroicons/24/outline/trash.svg?raw";
import arrowUpO from "heroicons/24/outline/arrow-up.svg?raw";
import arrowsUpDownO from "heroicons/24/outline/arrows-up-down.svg?raw";
import arrowDownO from "heroicons/24/outline/arrow-down.svg?raw";
import barsArrowUpO from "heroicons/24/outline/bars-arrow-up.svg?raw";
import barsArrowDownO from "heroicons/24/outline/bars-arrow-down.svg?raw";
import arrowTopRightO from "heroicons/24/outline/arrow-top-right-on-square.svg?raw";
import arrowLeftO from "heroicons/24/outline/arrow-left.svg?raw";
import arrowRightO from "heroicons/24/outline/arrow-right.svg?raw";
import keyO from "heroicons/24/outline/key.svg?raw";
import chartPieO from "heroicons/24/outline/chart-pie.svg?raw";
import arrowRightStartO from "heroicons/24/outline/arrow-right-start-on-rectangle.svg?raw";
import arrowRightEndO from "heroicons/24/outline/arrow-right-end-on-rectangle.svg?raw";
import documentArrowDownO from "heroicons/24/outline/document-arrow-down.svg?raw";
import documentArrowUpO from "heroicons/24/outline/document-arrow-up.svg?raw";
import photoO from "heroicons/24/outline/photo.svg?raw";
import eyeO from "heroicons/24/outline/eye.svg?raw";
// Hand-drawn die (five face) in the Heroicons outline style; Heroicons has no
// dice icon and the random button should not look like an AI sparkle.
const dieO =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">' +
  '<rect x="3.75" y="3.75" width="16.5" height="16.5" rx="2.25" />' +
  '<circle cx="8.25" cy="8.25" r="1.1" fill="currentColor" stroke="none" />' +
  '<circle cx="15.75" cy="8.25" r="1.1" fill="currentColor" stroke="none" />' +
  '<circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />' +
  '<circle cx="8.25" cy="15.75" r="1.1" fill="currentColor" stroke="none" />' +
  '<circle cx="15.75" cy="15.75" r="1.1" fill="currentColor" stroke="none" />' +
  "</svg>";

import starS from "heroicons/24/solid/star.svg?raw";
import heartS from "heroicons/24/solid/heart.svg?raw";
import starS20 from "heroicons/20/solid/star.svg?raw";
import heartS20 from "heroicons/20/solid/heart.svg?raw";

const ICONS: Record<string, string> = {
  film: filmO,
  tv: tvO,
  "puzzle-piece": puzzleO,
  cake: cakeO,
  "building-storefront": storefrontO,
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
  "x-mark": xMarkO,
  "chevron-down": chevronDownO,
  "squares-2x2": squares2x2O,
  "list-bullet": listBulletO,
  star: starO,
  heart: heartO,
  plus: plusO,
  pencil: pencilO,
  trash: trashO,
  "arrow-up": arrowUpO,
  "arrows-up-down": arrowsUpDownO,
  "arrow-down": arrowDownO,
  "bars-arrow-up": barsArrowUpO,
  "bars-arrow-down": barsArrowDownO,
  "arrow-top-right-on-square": arrowTopRightO,
  "arrow-left": arrowLeftO,
  "arrow-right": arrowRightO,
  key: keyO,
  "chart-pie": chartPieO,
  "arrow-right-start-on-rectangle": arrowRightStartO,
  "arrow-right-end-on-rectangle": arrowRightEndO,
  die: dieO,
  "document-arrow-down": documentArrowDownO,
  "document-arrow-up": documentArrowUpO,
  photo: photoO,
  eye: eyeO,
  "star-solid": starS,
  "heart-solid": heartS,
  "star-solid-20": starS20,
  "heart-solid-20": heartS20,
};

// Every Heroicons 24/outline SVG as a lazy raw-string chunk; the initial
// bundle only pays for the keys, each icon downloads on first use.
const OUTLINE_ICONS = import.meta.glob<string>(
  "../../../node_modules/heroicons/24/outline/*.svg",
  { query: "?raw", import: "default" }
);

function outlineKey(name: string): string {
  return `../../../node_modules/heroicons/24/outline/${name}.svg`;
}

export function isOutlineIcon(name: string): boolean {
  return name in ICONS || outlineKey(name) in OUTLINE_ICONS;
}

// Icons showcased in the admin category editor; any other Heroicons outline
// name can still be typed in manually (see isOutlineIcon).
export const CATEGORY_ICONS = [
  "film",
  "tv",
  "video-camera",
  "camera",
  "photo",
  "musical-note",
  "microphone",
  "speaker-wave",
  "radio",
  "book-open",
  "newspaper",
  "document-text",
  "pencil",
  "paint-brush",
  "swatch",
  "scissors",
  "puzzle-piece",
  "rocket-launch",
  "trophy",
  "ticket",
  "cake",
  "beaker",
  "fire",
  "building-storefront",
  "building-library",
  "home-modern",
  "globe-alt",
  "globe-americas",
  "map-pin",
  "map",
  "paper-airplane",
  "truck",
  "computer-desktop",
  "device-phone-mobile",
  "cpu-chip",
  "command-line",
  "code-bracket",
  "wifi",
  "light-bulb",
  "academic-cap",
  "briefcase",
  "wrench-screwdriver",
  "shopping-bag",
  "shopping-cart",
  "gift",
  "banknotes",
  "credit-card",
  "calendar-days",
  "clock",
  "sun",
  "moon",
  "cloud",
  "bolt",
  "star",
  "heart",
  "sparkles",
  "flag",
  "bookmark",
  "tag",
  "archive-box",
  "cube",
  "circle-stack",
  "chart-pie",
  "bug-ant",
  "face-smile",
  "hand-thumb-up",
  "user-group",
  "chat-bubble-left-right",
  "envelope",
  "scale",
  "key",
  "bell",
] as const;

function buildSvg(raw: string, className: string): SVGElement {
  const holder = document.createElement("div");
  holder.innerHTML = raw;
  const svg = holder.querySelector("svg")!;
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  return svg;
}

export function icon(name: string, className = "icon"): SVGElement {
  const raw = ICONS[name];
  if (raw) return buildSvg(raw, className);
  // Unknown name: render the tag fallback now, swap in the real icon once its
  // chunk arrives (all outline icons share the same root attributes).
  const svg = buildSvg(ICONS.tag, className);
  const loader = OUTLINE_ICONS[outlineKey(name)];
  if (loader) {
    void loader().then((loaded) => {
      const holder = document.createElement("div");
      holder.innerHTML = loaded;
      const fresh = holder.querySelector("svg");
      if (fresh) svg.innerHTML = fresh.innerHTML;
    });
  }
  return svg;
}
