import * as fs from 'node:fs';
import * as path from 'node:path';

export function resolveUploadRoot(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_ROOT ?? 'uploads');
}

export function resolveScanPhotoDirectory(): string {
  return path.join(resolveUploadRoot(), 'scan_photo');
}

export function resolveItemImageDirectory(): string {
  return path.join(resolveUploadRoot(), 'item_image');
}

export function resolveDatabasePath(): string {
  return path.resolve(
    process.cwd(),
    process.env.DATABASE_PATH ??
      path.join('data', 'restaurant-menu-ai-app.sqlite'),
  );
}

export function ensureApplicationDirectories(): void {
  const directories = [
    resolveUploadRoot(),
    resolveScanPhotoDirectory(),
    resolveItemImageDirectory(),
    path.dirname(resolveDatabasePath()),
  ];

  for (const directory of directories) {
    fs.mkdirSync(directory, { recursive: true });
  }
}
