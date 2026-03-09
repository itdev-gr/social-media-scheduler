/**
 * Multi-tenant helpers — extract admin uid and verify document ownership.
 */

export function requireAdmin(locals: App.Locals): string {
  const user = locals.user;
  if (!user || user.type !== 'admin') {
    throw new Error('Forbidden');
  }
  return user.uid;
}

export function verifyOwnership(
  doc: FirebaseFirestore.DocumentSnapshot,
  userId: string
): void {
  const data = doc.data();
  if (!data || data.userId !== userId) {
    throw new Error('Forbidden');
  }
}
