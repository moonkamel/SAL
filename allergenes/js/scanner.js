// Lecteur de code-barres par la caméra.
// Utilise le BarcodeDetector natif (Chrome / Android) et, à défaut (iPhone,
// Firefox), la bibliothèque ZXing embarquée dans vendor/, chargée à la demande.

import { isValidBarcode } from './core.js';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

let zxingPromise = null;
function loadZxing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  zxingPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../vendor/zxing.min.js', import.meta.url).href;
    script.onload = () => resolve(window.ZXing);
    script.onerror = () => {
      zxingPromise = null;
      reject(new Error('Lecteur de code-barres indisponible'));
    };
    document.head.appendChild(script);
  });
  return zxingPromise;
}

async function createDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) {
        const detector = new window.BarcodeDetector({ formats });
        return async (video) => {
          const codes = await detector.detect(video);
          return codes[0]?.rawValue ?? null;
        };
      }
    } catch {
      // On bascule sur ZXing.
    }
  }
  const ZX = await loadZxing();
  const hints = new Map();
  hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
    ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A, ZX.BarcodeFormat.UPC_E,
  ]);
  hints.set(ZX.DecodeHintType.TRY_HARDER, true);
  const reader = new ZX.MultiFormatReader();
  reader.setHints(hints);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    // On ne lit que la bande centrale, là où se trouve le cadre de visée.
    const cropH = Math.round(h * 0.5);
    canvas.width = w;
    canvas.height = cropH;
    ctx.drawImage(video, 0, Math.round((h - cropH) / 2), w, cropH, 0, 0, w, cropH);
    try {
      const source = new ZX.HTMLCanvasElementLuminanceSource(canvas);
      const bitmap = new ZX.BinaryBitmap(new ZX.HybridBinarizer(source));
      return reader.decodeWithState(bitmap).getText();
    } catch {
      return null;
    } finally {
      reader.reset();
    }
  };
}

/**
 * Démarre la caméra dans `video` et appelle `onCode(code)` au premier code-barres
 * valide (clé de contrôle vérifiée). Renvoie une fonction d'arrêt.
 */
export async function startScanner(video, { onCode, onStatus }) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Caméra inaccessible : ouvrez l’outil en https (ou saisissez le code à la main).');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  let stopped = false;
  const stop = () => {
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
  try {
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    video.muted = true;
    await video.play();
    onStatus?.('Chargement du lecteur…');
    const detect = await createDetector();
    onStatus?.('Visez le code-barres du produit.');
    let last = null;
    const tick = async () => {
      if (stopped) return;
      try {
        const code = await detect(video);
        // Deux lectures identiques d'affilée : évite les lectures partielles.
        if (code && isValidBarcode(code)) {
          if (code === last) {
            navigator.vibrate?.(80);
            stop();
            onCode(code);
            return;
          }
          last = code;
        }
      } catch {
        // Image illisible : on réessaie à la prochaine.
      }
      setTimeout(tick, 120);
    };
    tick();
  } catch (err) {
    stop();
    throw err;
  }
  return stop;
}
