import { put } from '@vercel/blob';
import { generateId } from './id.util';

type ImageBucket = 'scan_photo' | 'item_image';

const blobDirectoryByBucket: Record<ImageBucket, string> = {
  scan_photo: 'scan_photo',
  item_image: 'item_image',
};

function resolveBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not configured. Connect a Vercel Blob store to this project or add the token manually.',
    );
  }

  return token;
}

function extensionFromMimeType(mimeType: string): string {
  const [, subtype = 'jpg'] = mimeType.split('/');
  return subtype.replace('jpeg', 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
}

async function saveBinaryImage(
  buffer: Buffer,
  bucket: ImageBucket,
  prefix: string,
  extension: string,
  mimeType?: string,
): Promise<string> {
  const sanitizedExtension = extension.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const pathname = `${blobDirectoryByBucket[bucket]}/${prefix}-${generateId()}.${sanitizedExtension}`;
  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType: mimeType,
    token: resolveBlobToken(),
  });

  return blob.url;
}

async function tryPersistDataUrlImage(
  value: string,
  bucket: ImageBucket,
  prefix: string,
): Promise<string | null> {
  const dataUrlMatch = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!dataUrlMatch) {
    return null;
  }

  const [, mimeType, base64Payload] = dataUrlMatch;
  const buffer = Buffer.from(base64Payload, 'base64');
  return await saveBinaryImage(
    buffer,
    bucket,
    prefix,
    extensionFromMimeType(mimeType),
    mimeType,
  );
}

async function tryPersistRawBase64Image(
  value: string,
  bucket: ImageBucket,
  prefix: string,
): Promise<string | null> {
  const cleaned = value.replace(/\s+/g, '');
  const looksLikeBase64 =
    cleaned.length > 128 && /^[A-Za-z0-9+/=]+$/.test(cleaned);

  if (!looksLikeBase64) {
    return null;
  }

  return await saveBinaryImage(
    Buffer.from(cleaned, 'base64'),
    bucket,
    prefix,
    'jpg',
    'image/jpeg',
  );
}

export async function persistImageValue(
  rawValue: string,
  bucket: ImageBucket,
  prefix: string,
): Promise<string> {
  const trimmedValue = rawValue.trim();

  const storedFromDataUrl = await tryPersistDataUrlImage(
    trimmedValue,
    bucket,
    prefix,
  );
  if (storedFromDataUrl) {
    return storedFromDataUrl;
  }

  const storedFromRawBase64 = await tryPersistRawBase64Image(
    trimmedValue,
    bucket,
    prefix,
  );
  if (storedFromRawBase64) {
    return storedFromRawBase64;
  }

  return trimmedValue;
}

export async function persistUploadedImage(
  buffer: Buffer,
  mimeType: string,
  bucket: ImageBucket,
  prefix: string,
): Promise<string> {
  return saveBinaryImage(
    buffer,
    bucket,
    prefix,
    extensionFromMimeType(mimeType),
    mimeType,
  );
}
