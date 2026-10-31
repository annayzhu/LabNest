import { fitWithin } from './protocol-photo';

/**
 * A chosen picture as a JPEG whose longest side is at most 2000 pixels. Drawing it on a canvas turns an iPhone's HEIC
 * into JPEG, applies the camera's rotation, and makes a phone upload small. Runs in the browser only.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('这个浏览器不能处理图片');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片转换失败')), 'image/jpeg', 0.85));
  } finally { bitmap.close(); }
}

/** `shrinkPhoto` as an upload: a JPEG under the picture's own name. */
export async function shrinkPhotoFile(file: File) {
  return new File([await shrinkPhoto(file)], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}
