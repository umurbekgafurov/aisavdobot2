import { auth } from '../src/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

/**
 * Ensures the backend server has an authenticated Firebase worker session
 * to write Firestore documents safely and securely in ai-savdobot.
 */
export async function initWorkerAuth(): Promise<void> {
  const workerEmail = 'telegram_worker@savdobot.uz';
  const workerPass = 'WorkerSecurePass2026!';

  try {
    const cred = await signInWithEmailAndPassword(auth, workerEmail, workerPass);
    console.log(`[Backend Worker] 🔐 Authenticated as: ${cred.user.email} (UID: ${cred.user.uid})`);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const cred = await createUserWithEmailAndPassword(auth, workerEmail, workerPass);
        console.log(`[Backend Worker] 🔐 Created and authenticated worker account: ${cred.user.uid}`);
      } catch (createErr: any) {
        console.warn('[Backend Worker] Notice creating worker auth:', createErr.message);
      }
    } else {
      console.warn('[Backend Worker] Notice authenticating worker:', err.message);
    }
  }
}
