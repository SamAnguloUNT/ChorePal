// Turns Firebase errors into plain messages so users never see text like
// "Firebase: Error (auth/invalid-credential)."
const MESSAGES: Record<string, string> = {
  // Wrong email/password. Firebase now returns invalid-credential for both, on purpose,
  // so we don't reveal whether an email has an account.
  'auth/invalid-credential': 'Incorrect email or password. Please try again.',
  'auth/invalid-login-credentials': 'Incorrect email or password. Please try again.',
  'auth/wrong-password': 'Incorrect email or password. Please try again.',
  'auth/user-not-found': 'Incorrect email or password. Please try again.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/user-disabled': 'This account has been disabled. Please contact support@chorepal.com.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Could not connect. Check your internet connection and try again.',
  'auth/email-already-in-use': 'An account with this email already exists. Try logging in instead.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/operation-not-allowed': 'This sign-in method is not available right now.',
  unavailable: 'Could not connect. Check your internet connection and try again.',
  'permission-denied': 'You do not have access to that. Please log in again.',
};

const FALLBACK = 'Something went wrong. Please try again.';

export function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  // Keep the real error in the logs for debugging, but never show it on screen
  console.log('Unhandled auth error:', error);
  return FALLBACK;
}
