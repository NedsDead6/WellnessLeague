/** Crops a picture to a centered square and shrinks it, so uploads stay small. Returns a JPEG. */
export async function squareJpeg(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't resize pictures.");
  ctx.fillStyle = "#0a1226";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't prepare that picture."))), "image/jpeg", 0.86),
  );
}
