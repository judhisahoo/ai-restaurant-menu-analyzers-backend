import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  importDatabaseSnapshot,
  loadSnapshot,
  resolveDataFilePath,
} from './data-utils';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const args = process.argv.slice(2);
  const replaceExisting = args.includes('--replace');
  const inputPath = args.find((arg) => arg !== '--replace');
  const filePath = resolveDataFilePath(inputPath);

  try {
    const snapshot = loadSnapshot(filePath);
    await importDatabaseSnapshot(prisma, snapshot, replaceExisting);
    console.log(`Database import completed: ${filePath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
