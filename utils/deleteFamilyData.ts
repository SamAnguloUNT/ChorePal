
// Deletes everything ChorePal stores about a child (or a whole family), not just the profile.
// COPPA lets a parent have their child's information deleted, so "Delete child" has to remove
// the submissions, photos still in Storage, purchases and the child's own chores as well.
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { deletePhotoFromStorage } from './photoCleanup';

// Deletes every document in `name` where `field == value`.
async function deleteWhere(name: string, field: string, value: string) {
  const snap = await getDocs(query(collection(db, name), where(field, '==', value)));
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
}

// Deletes a child's submissions. A submission is only removed once its photo is gone, so if a
// photo can't be deleted the record stays and the parent can try again.
async function deleteSubmissions(field: 'childId' | 'parentId', value: string) {
  const snap = await getDocs(query(collection(db, 'submissions'), where(field, '==', value)));
  let failed = 0;
  for (const d of snap.docs) {
    const data: any = d.data();
    if (data.photoPath || data.photoURL) {
      const ok = await deletePhotoFromStorage({ photoPath: data.photoPath, photoURL: data.photoURL });
      if (!ok) {
        failed++;
        continue;
      }
    }
    await deleteDoc(d.ref);
  }
  if (failed > 0) {
    throw new Error(
      `${failed} photo${failed === 1 ? '' : 's'} could not be deleted. Nothing else was removed, so please try again.`
    );
  }
}

export async function deleteChildData(childId: string, parentId: string) {
  // Photos and submissions first, so a failure leaves the child profile in place to retry
  await deleteSubmissions('childId', childId);
  await deleteWhere('purchases', 'childId', childId);

  // Chores and rewards made only for this child (ones for "all children" stay)
  const chores = await getDocs(query(collection(db, 'chores'), where('assignedTo', '==', childId)));
  for (const d of chores.docs) {
    if ((d.data() as any).parentId === parentId) await deleteDoc(d.ref);
  }
  const rewards = await getDocs(query(collection(db, 'rewards'), where('availableTo', '==', childId)));
  for (const d of rewards.docs) {
    if ((d.data() as any).parentId === parentId) await deleteDoc(d.ref);
  }

  // The profile itself (name, avatar, PIN, code, push tokens, home location) goes last
  await deleteDoc(doc(db, 'children', childId));
}

// Used by "Delete Account": removes every child and everything else the parent created.
// It can be run again safely if it is interrupted.
export async function deleteAllFamilyData(parentId: string) {
  const kids = await getDocs(query(collection(db, 'children'), where('parentId', '==', parentId)));
  for (const k of kids.docs) {
    await deleteChildData(k.id, parentId);
  }
  await deleteSubmissions('parentId', parentId);
  await deleteWhere('purchases', 'parentId', parentId);
  await deleteWhere('chores', 'parentId', parentId);
  await deleteWhere('rewards', 'parentId', parentId);
}