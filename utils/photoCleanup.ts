// Save as utils/photoCleanup.ts
//
// Deletes a chore photo from Firebase Storage. Accepts either the storage path we save on
// new submissions (`photoPath`) or the download URL (`photoURL`) that older submissions have.
// Returns true when the photo is gone (or was already gone), false if it could not be deleted.
import { deleteObject, getStorage, ref } from 'firebase/storage';

export async function deletePhotoFromStorage(source: {
  photoPath?: string | null;
  photoURL?: string | null;
}): Promise<boolean> {
  const target = source.photoPath || source.photoURL;
  if (!target) return true; // nothing stored

  try {
    // ref() accepts a plain path, a gs:// URL, or an https download URL
    await deleteObject(ref(getStorage(), target));
    return true;
  } catch (error: any) {
    if (error?.code === 'storage/object-not-found') return true; // already deleted
    console.log('Could not delete photo from Storage:', error?.code || error);
    return false;
  }
}