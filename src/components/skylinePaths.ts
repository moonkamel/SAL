// Silhouette stylisée de Lille, de gauche à droite : Porte de Paris, maisons à pignons
// à redents, Beffroi de l'hôtel de ville, Vieille Bourse, colonne de la Déesse,
// Opéra, cathédrale Notre-Dame-de-la-Treille. Repère 400 × 140, sol à y = 140.

const GROUND = 140;

/** Pignon flamand à redents (« pas de moineaux ») posé sur une façade. */
function steppedGable(x: number, width: number, wallTop: number, steps: number): string {
  const stepW = width / (steps * 2 + 1);
  const stepH = 6;
  let d = `M${x} ${GROUND} L${x} ${wallTop}`;
  let cx = x;
  let cy = wallTop;
  for (let i = 0; i < steps; i++) {
    cx += stepW;
    d += ` L${cx} ${cy} L${cx} ${cy - stepH}`;
    cy -= stepH;
  }
  cx += stepW; // sommet
  d += ` L${cx} ${cy}`;
  for (let i = 0; i < steps; i++) {
    d += ` L${cx} ${cy + stepH}`;
    cy += stepH;
    cx += stepW;
    d += ` L${cx} ${cy}`;
  }
  d += ` L${x + width} ${GROUND} Z`;
  return d;
}

const rect = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y} h${w} v${h} h${-w} Z`;

export const SILHOUETTE = [
  // Porte de Paris : arc de triomphe, l'arche est évidée (fill-rule evenodd).
  rect(6, 96, 44, GROUND - 96),
  rect(2, 90, 52, 7),
  'M20 140 L20 116 Q28 104 36 116 L36 140 Z',
  // Maisons à pignons à redents.
  steppedGable(56, 22, 112, 3),
  steppedGable(78, 20, 108, 3),
  steppedGable(98, 22, 114, 3),
  // Beffroi (104 m) : fût, galerie, flèche et couronne.
  rect(124, 46, 20, GROUND - 46),
  rect(121, 44, 26, 5),
  'M126 44 L134 12 L142 44 Z',
  rect(132.5, 4, 3, 9),
  rect(146, 100, 18, GROUND - 100),
  // Vieille Bourse : longue façade, lucarnes ouvragées et lanterne centrale.
  rect(166, 104, 66, GROUND - 104),
  steppedGable(166, 16, 104, 2),
  steppedGable(216, 16, 104, 2),
  'M190 104 L190 92 Q199 80 208 92 L208 104 Z',
  rect(197, 74, 4, 10),
  'M195 76 L199 66 L203 76 Z',
  // Colonne de la Déesse.
  rect(240, 72, 5, GROUND - 72),
  rect(237, 132, 11, 8),
  'M240 72 L242.5 60 L245 72 Z',
  // Opéra : façade à fronton triangulaire.
  rect(252, 98, 50, GROUND - 98),
  'M250 99 L277 80 L304 99 Z',
  rect(270, 72, 14, 10),
  // Cathédrale de la Treille : nef, pignon pointu et rosace évidée.
  rect(308, 90, 46, GROUND - 90),
  'M306 91 L331 60 L356 91 Z',
  'M331 72 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z',
  // Maisons de fin de rue.
  steppedGable(358, 20, 110, 3),
  steppedGable(378, 22, 116, 3),
].join(' ');

// Fenêtres éclairées (or de la Vieille Bourse).
export const WINDOWS = [
  [128, 60], [138, 60], [128, 76], [138, 76], [128, 92], [138, 92],
  [62, 122], [70, 122], [84, 118], [104, 124], [112, 124],
  [172, 114], [182, 114], [212, 114], [222, 114], [195, 114], [203, 114],
  [258, 108], [268, 108], [284, 108], [294, 108], [276, 124],
  [316, 104], [344, 104], [364, 122], [386, 126],
]
  .map(([x, y]) => rect(x!, y!, 3.2, 5))
  .join(' ');

export const STARS: [number, number, number][] = [
  [30, 30, 1], [70, 58, 0.8], [96, 22, 1.2], [168, 30, 0.9], [214, 48, 1],
  [262, 24, 1.1], [300, 42, 0.8], [352, 20, 1], [388, 52, 0.9],
];
