export function resolveDatabasePath(): never {
  throw new Error(
    'resolveDatabasePath is deprecated. This application now uses Prisma with PostgreSQL.',
  );
}

export function ensureApplicationDirectories(): void {
  // No-op: Prisma with PostgreSQL does not require local database directories.
}
