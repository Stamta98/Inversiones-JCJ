/**
 * Preparación de la foto en el navegador, antes de subirla.
 *
 * Una foto de un teléfono de hoy no es "una imagen grande": es 50 o 108
 * megapíxeles y entre 10 y 25 MB. Subirla tal cual por datos móviles no
 * termina nunca, y guardarla no sirve de nada — nadie necesita una cédula de
 * cuatro mil píxeles de ancho. Aquí se reduce antes de salir del teléfono.
 *
 * Lo que hace difícil esta parte no es reducirla, es reducirla en un teléfono.
 * Decodificar 108 MP pide más de 400 MB de memoria solo para el mapa de bits,
 * y Android le corta la mano a la pestaña antes de llegar: el navegador de
 * escritorio hace esto sin despeinarse y el teléfono se rinde. Por eso el
 * camino principal es `createImageBitmap` con `resizeWidth`, que decodifica ya
 * reducido y nunca arma la imagen completa en memoria.
 *
 * Y una regla que vale más que todas: si no se puede reducir, no se sube el
 * original. Antes se subía, y una foto de 15 MB solo llegaba hasta el servidor
 * para que la rechazara; el cobrador veía "el archivo pesa demasiado" sin
 * entender por qué, con la única foto que tenía del documento.
 */

/** Lado más largo, en píxeles, de una foto guardada. */
const MAX_DIMENSION = 1600;

const JPEG_QUALITY = 0.85;

/**
 * Lo máximo que se manda por la red.
 *
 * Muy por debajo de lo que aguanta el servidor, a propósito: entre el teléfono
 * y la aplicación hay una plataforma que corta los envíos grandes por su
 * cuenta, y ese corte no deja ningún mensaje que se pueda mostrar. Es más
 * barato bajar un poco la calidad que dejar al cobrador sin poder guardar.
 */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Calidades a probar, en orden, si la primera pasada pesa mucho. */
const FALLBACK_QUALITIES = [0.7, 0.55, 0.4];

export class ImagePreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagePreparationError";
  }
}

export interface PreparedImage {
  file: File;
  /** Object URL para la vista previa. Quien llama debe revocarlo. */
  previewUrl: string;
}

interface Size {
  width: number;
  height: number;
}

/**
 * El tamaño leído del encabezado del archivo, sin decodificar la imagen.
 *
 * Hace falta antes de decodificar, que es justo el paso que no se puede dar a
 * ciegas: para pedirle al navegador que decodifique reducido hay que decirle a
 * cuánto, y para eso hay que saber de cuánto viene. Leer treinta bytes del
 * encabezado cuesta nada; decodificar para medir cuesta la memoria que se está
 * tratando de no gastar.
 */
export async function readSize(file: Blob): Promise<Size | null> {
  const head = new Uint8Array(await file.slice(0, 1024 * 128).arrayBuffer());
  return readJpegSize(head) ?? readPngSize(head) ?? readWebpSize(head);
}

function readJpegSize(bytes: Uint8Array): Size | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    // SOF0..SOF15 llevan el tamaño; SOF4, SOF8 y SOF12 no son marcos.
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrame) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function readPngSize(bytes: Uint8Array): Size | null {
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readWebpSize(bytes: Uint8Array): Size | null {
  if (bytes.length < 30) return null;
  const tag = String.fromCharCode(...bytes.slice(0, 4));
  const format = String.fromCharCode(...bytes.slice(8, 12));
  if (tag !== "RIFF" || format !== "WEBP") return null;

  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (chunk === "VP8X") {
    return {
      width: (view.getUint32(24, true) & 0xffffff) + 1,
      height: ((view.getUint32(26, true) >> 8) & 0xffffff) + 1,
    };
  }
  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8 ") {
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }
  return null;
}

/** El tamaño de destino: el lado más largo cabe en `limit`, sin agrandar. */
function scaleTo(size: Size, limit: number): Size {
  const longest = Math.max(size.width, size.height);
  const scale = longest > limit ? limit / longest : 1;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

type Source = ImageBitmap | HTMLImageElement;

/**
 * Decodifica ya reducido cuando se puede.
 *
 * `createImageBitmap` con `resizeWidth` es el único camino que en un teléfono
 * no arma la imagen entera en memoria. Si no está —o si el formato no lo
 * entiende, como un HEIC de iPhone— se cae al `<img>` de toda la vida, que en
 * fotos normales funciona bien.
 */
async function decode(file: File, target: Size | null): Promise<Source> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(
        file,
        target
          ? {
              resizeWidth: target.width,
              resizeHeight: target.height,
              resizeQuality: "high",
            }
          : {},
      );
    } catch {
      // Formato que no entiende, o memoria: se intenta con el <img>.
    }
  }
  return await loadImage(file);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImagePreparationError("No se pudo leer la imagen"));
    };
    image.src = url;
  });
}

function sizeOf(source: Source): Size {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new ImagePreparationError("No se pudo procesar la imagen")),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Dibuja a `size` y devuelve el JPEG.
 *
 * Un lienzo demasiado grande no falla: sale en blanco, que es peor, porque la
 * foto se sube y nadie se entera hasta que alguien la abre. Por eso el tamaño
 * ya viene acotado por `MAX_DIMENSION` desde arriba.
 */
async function render(
  source: Source,
  size: Size,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const draw = canvas.getContext("2d");
  if (!draw) {
    throw new ImagePreparationError("No se pudo procesar la imagen");
  }
  draw.drawImage(source, 0, 0, size.width, size.height);

  return await encode(canvas, quality);
}

/**
 * Reduce la foto y la vuelve a codificar como JPEG.
 *
 * Devuelve siempre algo que cabe por la red, o lanza. Nunca el original sin
 * tocar: si se llegó aquí es porque el original no servía para subir.
 */
export async function prepareImage(input: File): Promise<PreparedImage> {
  const size = await readSize(input).catch(() => null);
  const target = size ? scaleTo(size, MAX_DIMENSION) : null;

  // Ya venía pequeña, ya es JPEG y ya cabe: no hay nada que mejorar, y volver
  // a codificarla solo le quitaría calidad.
  if (
    size &&
    target &&
    size.width === target.width &&
    size.height === target.height &&
    input.type === "image/jpeg" &&
    input.size <= MAX_UPLOAD_BYTES
  ) {
    return { file: input, previewUrl: URL.createObjectURL(input) };
  }

  const source = await decode(input, target);

  try {
    // Si `createImageBitmap` ya redujo, esto sale igual; si se cayó al `<img>`,
    // aquí es donde se reduce.
    let drawn = scaleTo(sizeOf(source), MAX_DIMENSION);
    let blob = await render(source, drawn, JPEG_QUALITY);

    // Todavía pesada: primero se baja calidad, que casi no se nota en una foto
    // de un documento, y solo después se achica.
    for (const quality of FALLBACK_QUALITIES) {
      if (blob.size <= MAX_UPLOAD_BYTES) break;
      blob = await render(source, drawn, quality);
    }
    while (
      blob.size > MAX_UPLOAD_BYTES &&
      Math.max(drawn.width, drawn.height) > 640
    ) {
      drawn = scaleTo(
        drawn,
        Math.round(Math.max(drawn.width, drawn.height) * 0.7),
      );
      blob = await render(source, drawn, FALLBACK_QUALITIES.at(-1) ?? 0.4);
    }

    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new ImagePreparationError(
        "No se pudo reducir la foto lo suficiente. Tómala otra vez con menos resolución.",
      );
    }

    const name = input.name.replace(/\.[^.]+$/, "") || "foto";
    const file = new File([blob], `${name}.jpg`, { type: "image/jpeg" });
    return { file, previewUrl: URL.createObjectURL(file) };
  } finally {
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      source.close();
    }
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
