// Photos taken or chosen on the inventory home go to the import page's document reader (Q190). They cross a
// client-side navigation in memory, so they are gone after a reload, and the reader then asks for them as usual.

let handed: File[] = [];

export function handOverPhotos(files: File[]) {
  handed = files;
}

/** The photos handed over, once: a second call returns none. */
export function takeHandedPhotos() {
  const files = handed;
  handed = [];
  return files;
}
