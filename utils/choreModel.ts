// The chore data model: ONE chore document per child.
//
// "All Children" used to create a single shared document with assignedTo: 'all'. That one
// document caused most of the chore bugs: deleting it removed the chore for everyone, a child
// added later inherited every old chore, and approvals for a deleted chore were left behind.
// Now "All Children" creates one document per child. Those documents share a `groupId` so the
// parent can still delete the chore for the whole group when they want to.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { isPastDue, isRecurring, submissionDay, todayStr } from './choreSchedule';
import { deletePhotoFromStorage } from './photoCleanup';

type ChoreFields = {
  title: string;
  coins: number;
  description: string;
  choreType: string;
  repeatable: boolean;
  repeat?: string;
  repeatDays?: number[];
  priority: string;
  deadline: string;
};

// Creates one chore per child. All of them share a groupId.
export async function createChores(parentId: string, childIds: string[], fields: ChoreFields) {
  const groupId = `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  for (const childId of childIds) {
    await addDoc(collection(db, 'chores'), {
      ...fields,
      assignedTo: childId,
      groupId,
      status: 'pending',
      parentId,
      createdAt: new Date(),
    });
  }
  return groupId;
}

// Removes the submissions of the given chores, photo first. A submission is only deleted once
// its photo is gone, so a failed photo delete leaves the record and the parent can retry.
async function deleteSubmissionsForChore(choreId: string, parentId: string, onlyStatuses?: string[]) {
  const snap = await getDocs(
    query(collection(db, 'submissions'), where('parentId', '==', parentId), where('choreId', '==', choreId))
  );
  let failed = 0;
  for (const d of snap.docs) {
    const data: any = d.data();
    if (onlyStatuses && !onlyStatuses.includes(data.status)) continue;
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
    throw new Error(`${failed} photo${failed === 1 ? '' : 's'} could not be deleted. Please try again.`);
  }
}

// Deletes ONE chore (one child's copy), plus its pending approvals and history and photos.
export async function deleteChoreEverywhere(choreId: string, parentId: string) {
  await deleteSubmissionsForChore(choreId, parentId);
  await deleteDoc(doc(db, 'chores', choreId));
}

// Deletes the chore for every child that got it in the same "All Children" group.
export async function deleteChoreGroup(groupId: string, parentId: string) {
  const snap = await getDocs(
    query(collection(db, 'chores'), where('parentId', '==', parentId), where('groupId', '==', groupId))
  );
  for (const d of snap.docs) {
    await deleteChoreEverywhere(d.id, parentId);
  }
}

// Turns old shared 'all' chores into per-child chores. Safe to run again: the copies use
// fixed ids (`${originalId}_${childId}`) and the original is reassigned LAST, so if this is
// interrupted the chore is still 'all' and the next run finishes the job.
export async function migrateLegacyAllChores(parentId: string, children: { id: string }[]) {
  if (children.length === 0) return 0;
  const snap = await getDocs(
    query(collection(db, 'chores'), where('parentId', '==', parentId), where('assignedTo', '==', 'all'))
  );
  let migrated = 0;
  for (const d of snap.docs) {
    const data: any = d.data();
    const [first, ...others] = children;
    for (const child of others) {
      const newId = `${d.id}_${child.id}`;
      await setDoc(doc(db, 'chores', newId), { ...data, assignedTo: child.id, groupId: d.id });
      // Move this child's submissions for the chore over to their own copy
      const subs = await getDocs(
        query(
          collection(db, 'submissions'),
          where('parentId', '==', parentId),
          where('childId', '==', child.id),
          where('choreId', '==', d.id)
        )
      );
      for (const s of subs.docs) await updateDoc(s.ref, { choreId: newId });
    }
    await updateDoc(d.ref, { assignedTo: first.id, groupId: d.id });
    migrated++;
  }
  return migrated;
}

// "Delete history": removes finished chores (approved, not repeatable, nothing waiting for
// review) together with all of their submissions and photos. Chores still to do, pending or
// rejected-and-not-yet-redone are kept. Returns how many chores were removed.
export async function clearChoreHistory(parentId: string, childId?: string) {
  const subsSnap = await getDocs(query(collection(db, 'submissions'), where('parentId', '==', parentId)));
  const approved = new Set<string>();
  const pending = new Set<string>();
  subsSnap.docs.forEach(s => {
    const x: any = s.data();
    if (childId && x.childId !== childId) return;
    if (x.status === 'approved') approved.add(x.choreId);
    if (x.status === 'pending') pending.add(x.choreId);
  });

  const choresSnap = await getDocs(query(collection(db, 'chores'), where('parentId', '==', parentId)));
  const today = todayStr();
  let removed = 0;
  for (const c of choresSnap.docs) {
    const data: any = c.data();
    if (childId && data.assignedTo !== childId) continue;
    // Recurring chores stay, but their finished records from past days are cleared
    if (isRecurring(data)) {
      for (const s of subsSnap.docs) {
        const x: any = s.data();
        if (x.choreId !== c.id || x.status === 'pending' || submissionDay(x) >= today) continue;
        if (x.photoPath || x.photoURL) {
          const ok = await deletePhotoFromStorage({ photoPath: x.photoPath, photoURL: x.photoURL });
          if (!ok) continue;
        }
        await deleteDoc(s.ref);
      }
      continue;
    }
    if (!approved.has(c.id) || pending.has(c.id)) continue;
    await deleteChoreEverywhere(c.id, parentId);
    removed++;
  }
  return removed;
}

// "Delete overdue": removes one-time chores whose day has passed and that were never approved
// and have nothing waiting for review, plus any rejected attempts and their photos.
// Recurring chores are never removed: a missed day just resets. Returns how many were removed.
export async function deleteOverdueChores(parentId: string, childId?: string) {
  const today = todayStr();
  const subsSnap = await getDocs(query(collection(db, 'submissions'), where('parentId', '==', parentId)));
  const keep = new Set<string>();
  subsSnap.docs.forEach(s => {
    const x: any = s.data();
    if (x.status === 'approved' || x.status === 'pending') keep.add(x.choreId);
  });

  const choresSnap = await getDocs(query(collection(db, 'chores'), where('parentId', '==', parentId)));
  let removed = 0;
  for (const c of choresSnap.docs) {
    const data: any = c.data();
    if (childId && data.assignedTo !== childId) continue;
    if (!isPastDue(data, today) || keep.has(c.id)) continue;
    await deleteChoreEverywhere(c.id, parentId);
    removed++;
  }
  return removed;
}