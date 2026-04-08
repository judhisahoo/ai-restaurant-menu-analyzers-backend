import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  exportDatabaseSnapshot,
  resolveDataFilePath,
  saveSnapshot,
} from './data-utils';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const filePath = resolveDataFilePath(process.argv[2]);

  try {
    const snapshot = await exportDatabaseSnapshot(prisma);
    saveSnapshot(filePath, snapshot);
    console.log(`Database export completed: ${filePath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
