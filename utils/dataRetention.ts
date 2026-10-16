

// Keeps ChorePal from holding on to children's information longer than it is needed.
// Runs in the background when a parent opens the dashboard, at most once a day:
//   1. Photos: deleted from Storage as soon as a submission has been reviewed, and after
//      PHOTO_MAX_DAYS for any submission nobody reviewed. (Also cleans up older photos.)
//   2. Old records: after RECORD_MAX_DAYS a reviewed submission keeps only what the chore list
//      needs (which chore, which child, approved or rejected). Names, avatars, ChorePal's
//      description and the parent's comment are erased.
//   3. Age: ChorePal no longer collects a child's age, so any saved ages are removed.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, deleteField, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { deletePhotoFromStorage } from './photoCleanup';

export const PHOTO_MAX_DAYS = 30;
export const RECORD_MAX_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

const toMillis = (v: any): number => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};

export async function runRetentionCleanup(parentId: string) {
  try {
    // Once a day is plenty
    const key = `retentionLastRun_${parentId}`;
    const today = new Date().toDateString();
    if ((await AsyncStorage.getItem(key)) === today) return;

    const now = Date.now();

    const subs = await getDocs(query(collection(db, 'submissions'), where('parentId', '==', parentId)));
    for (const d of subs.docs) {
      const s: any = d.data();
      const reviewed = s.status === 'approved' || s.status === 'rejected';
      const submitted = toMillis(s.submittedAt);
      const reviewedAt = Math.max(toMillis(s.approvedAt), toMillis(s.rejectedAt), submitted);
      const updates: any = {};

      // 1. Photos
      const hasPhoto = !!(s.photoPath || s.photoURL);
      const photoTooOld = submitted > 0 && now - submitted > PHOTO_MAX_DAYS * DAY_MS;
      if (hasPhoto && (reviewed || photoTooOld)) {
        const ok = await deletePhotoFromStorage({ photoPath: s.photoPath, photoURL: s.photoURL });
        if (ok) {
          updates.photoURL = null;
          updates.photoPath = null;
          updates.photoDeletedAt = new Date();
        }
      }

      // 2. Old reviewed records
      if (reviewed && !s.scrubbedAt && reviewedAt > 0 && now - reviewedAt > RECORD_MAX_DAYS * DAY_MS) {
        updates.childName = null;
        updates.childAvatar = null;
        updates.aiDescription = null;
        updates.parentComment = null;
        updates.scrubbedAt = new Date();
      }

      if (Object.keys(updates).length > 0) await updateDoc(d.ref, updates);
    }

    // 3. Ages that were collected before this was removed
    const kids = await getDocs(query(collection(db, 'children'), where('parentId', '==', parentId)));
    for (const k of kids.docs) {
      if ((k.data() as any).age !== undefined) await updateDoc(k.ref, { age: deleteField() });
    }

    await AsyncStorage.setItem(key, today);
  } catch (error) {
    // Cleanup must never get in the way of using the app
    console.log('Retention cleanup skipped:', error);
  }
}