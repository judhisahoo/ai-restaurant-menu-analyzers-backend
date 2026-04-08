import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateId } from './id.util';
import {
  resolveItemImageDirectory,
  resolveScanPhotoDirectory,
} from './app-paths.util';

type ImageBucket = 'scan_photo' | 'item_image';

const directoryByBucket: Record<ImageBucket, string> = {
  scan_photo: resolveScanPhotoDirectory(),
  item_image: resolveItemImageDirectory(),
};

function extensionFromMimeType(mimeType: string): string {
  const [, subtype = 'jpg'] = mimeType.split('/');
  return subtype.replace('jpeg', 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
}

function saveBinaryImage(
  buffer: Buffer,
  bucket: ImageBucket,
  prefix: string,
  extension: string,
): string {
  const sanitizedExtension = extension.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const fileName = `${prefix}-${generateId()}.${sanitizedExtension}`;
  const filePath = path.join(directoryByBucket[bucket], fileName);
  fs.writeFileSync(filePath, buffer);
  return `${bucket}/${fileName}`;
}

function tryPersistDataUrlImage(
  value: string,
  bucket: ImageBucket,
  prefix: string,
): string | null {
  const dataUrlMatch = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!dataUrlMatch) {
    return null;
  }

  const [, mimeType, base64Payload] = dataUrlMatch;
  const buffer = Buffer.from(base64Payload, 'base64');
  return saveBinaryImage(
    buffer,
    bucket,
    prefix,
    extensionFromMimeType(mimeType),
  );
}

function tryPersistRawBase64Image(
  value: string,
  bucket: ImageBucket,
  prefix: string,
): string | null {
  const cleaned = value.replace(/\s+/g, '');
  const looksLikeBase64 =
    cleaned.length > 128 && /^[A-Za-z0-9+/=]+$/.test(cleaned);

  if (!looksLikeBase64) {
    return null;
  }

  return saveBinaryImage(Buffer.from(cleaned, 'base64'), bucket, prefix, 'jpg');
}

export function persistImageValue(
  rawValue: string,
  bucket: ImageBucket,
  prefix: string,
): string {
  const trimmedValue = rawValue.trim();

  const storedFromDataUrl = tryPersistDataUrlImage(trimmedValue, bucket, prefix);
  if (storedFromDataUrl) {
    return storedFromDataUrl;
  }

  const storedFromRawBase64 = tryPersistRawBase64Image(
    trimmedValue,
    bucket,
    prefix,
  );
  if (storedFromRawBase64) {
    return storedFromRawBase64;
  }

  return trimmedValue;
}

export function persistUploadedImage(
  buffer: Buffer,
  mimeType: string,
  bucket: ImageBucket,
  prefix: string,
): string {
  return saveBinaryImage(buffer, bucket, prefix, extensionFromMimeType(mimeType));
}
