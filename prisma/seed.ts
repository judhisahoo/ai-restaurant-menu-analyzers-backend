import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  importDatabaseSnapshot,
  loadSnapshot,
  resolveDataFilePath,
} from './data-utils';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const filePath = resolveDataFilePath('prisma/seed-data.json');

  try {
    const snapshot = loadSnapshot(filePath);
    await importDatabaseSnapshot(prisma, snapshot, false);
    console.log(`Seed completed using ${filePath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
