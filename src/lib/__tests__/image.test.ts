/**
 * El tamaño se lee del encabezado, sin decodificar la imagen.
 *
 * Se prueba contra archivos de verdad y no contra bytes escritos a mano: lo
 * que tiene que aguantar son los archivos que salen de un teléfono, y esos
 * traen el encabezado que traen. Si esto se equivoca, se le pide al navegador
 * que decodifique al tamaño equivocado y la foto sale estirada o gigante.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readSize } from "../image";

const muestras = join(import.meta.dirname, "muestras");

async function medir(nombre: string) {
  return await readSize(new Blob([await readFile(join(muestras, nombre))]));
}

describe("readSize", () => {
  it("lee un JPEG", async () => {
    expect(await medir("foto.jpg")).toEqual({ width: 640, height: 480 });
  });

  it("no confunde el ancho con el alto en una foto vertical", async () => {
    expect(await medir("alta.jpg")).toEqual({ width: 3000, height: 4000 });
  });

  it("pasa por encima de un EXIF largo hasta el marco", async () => {
    // Una foto de teléfono trae miniatura, GPS y modelo antes del tamaño. Un
    // lector que se quede en el primer bloque no encuentra nada.
    expect(await medir("conexif.jpg")).toEqual({ width: 1234, height: 567 });
  });

  it("lee un PNG", async () => {
    expect(await medir("imagen.png")).toEqual({ width: 321, height: 123 });
  });

  it("lee un WebP", async () => {
    expect(await medir("imagen.webp")).toEqual({ width: 200, height: 100 });
  });

  it("devuelve null en un formato que no conoce, sin reventar", async () => {
    // Un HEIC de iPhone cae aquí. Devolver null es lo correcto: se decodifica
    // sin pedir tamaño y se reduce después.
    expect(await readSize(new Blob([new Uint8Array(64)]))).toBeNull();
  });

  it("devuelve null en un archivo truncado, sin quedarse dando vueltas", async () => {
    const jpeg = await readFile(join(muestras, "foto.jpg"));
    expect(await readSize(new Blob([jpeg.subarray(0, 3)]))).toBeNull();
  });
});
