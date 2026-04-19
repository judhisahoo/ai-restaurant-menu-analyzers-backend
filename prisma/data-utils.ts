import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

type ConfigSnapshotRow = {
  id: number;
  name: string;
  value: string;
  status: boolean;
};

export interface DatabaseSnapshot {
  config: ConfigSnapshotRow[];
  users: Array<{
    id: number;
    email: string;
    created_at: string;
    updated_at: string;
    verified_at: string;
  }>;
  location_history: Array<{
    id: number;
    user_id: number | null;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    captured_at: string;
  }>;
  menu_items: Array<{
    id: string;
    name: string;
    short_description: string;
    image: string | null;
    created_at: string;
    updated_at: string;
  }>;
  user_menu_items: Array<{
    id: string;
    item_id: string;
    user_id: number;
    created_at: string;
    updated_at: string;
  }>;
  menu_scans: Array<{
    id: number;
    user_id: number | null;
    scan_photo: string;
    captured_at: string;
  }>;
  item_components: Array<{
    id: string;
    item_id: string;
    name: string;
    summary: string;
    row_order: number;
    created_at: string;
    updated_at: string;
  }>;
  ingredient_details: Array<{
    id: string;
    item_id: string;
    name: string;
    detail: string;
    row_order: number;
    created_at: string;
    updated_at: string;
  }>;
}

export const EMPTY_SNAPSHOT: DatabaseSnapshot = {
  config: [],
  users: [],
  location_history: [],
  menu_items: [],
  user_menu_items: [],
  menu_scans: [],
  item_components: [],
  ingredient_details: [],
};

export function resolveDataFilePath(inputPath?: string): string {
  return path.resolve(
    process.cwd(),
    inputPath ?? path.join('prisma', 'data', 'database-export.json'),
  );
}

export function loadSnapshot(filePath: string): DatabaseSnapshot {
  const contents = fs.readFileSync(filePath, 'utf8');
  return {
    ...EMPTY_SNAPSHOT,
    ...(JSON.parse(contents) as Partial<DatabaseSnapshot>),
  };
}

export function saveSnapshot(filePath: string, snapshot: DatabaseSnapshot): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
}

export async function exportDatabaseSnapshot(
  prisma: PrismaClient,
): Promise<DatabaseSnapshot> {
  const [
    config,
    users,
    locations,
    menuItems,
    userMenuItems,
    menuScans,
    itemComponents,
    ingredientDetails,
  ] = await Promise.all([
    prisma.$queryRaw<ConfigSnapshotRow[]>`
      SELECT "id", "name", "value", "status"
      FROM "config"
      ORDER BY "id" ASC
    `,
    prisma.user.findMany({ orderBy: { id: 'asc' } }),
    prisma.locationHistory.findMany({ orderBy: { id: 'asc' } }),
    prisma.menuItem.findMany({ orderBy: { name: 'asc' } }),
    prisma.userMenuItem.findMany({ orderBy: { id: 'asc' } }),
    prisma.menuScan.findMany({ orderBy: { id: 'asc' } }),
    prisma.itemComponent.findMany({
      orderBy: [{ itemId: 'asc' }, { rowOrder: 'asc' }],
    }),
    prisma.ingredientDetail.findMany({
      orderBy: [{ itemId: 'asc' }, { rowOrder: 'asc' }],
    }),
  ]);

  return {
    config: config.map((entry) => ({
      id: entry.id,
      name: entry.name,
      value: entry.value,
      status: entry.status,
    })),
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
      verified_at: user.verifiedAt.toISOString(),
    })),
    location_history: locations.map((location) => ({
      id: location.id,
      user_id: location.userId,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      captured_at: location.capturedAt.toISOString(),
    })),
    menu_items: menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      short_description: item.shortDescription,
      image: item.image,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    })),
    user_menu_items: userMenuItems.map((link) => ({
      id: link.id,
      item_id: link.itemId,
      user_id: link.userId,
      created_at: link.createdAt.toISOString(),
      updated_at: link.updatedAt.toISOString(),
    })),
    menu_scans: menuScans.map((menuScan) => ({
      id: menuScan.id,
      user_id: menuScan.userId,
      scan_photo: menuScan.scanPhoto,
      captured_at: menuScan.capturedAt.toISOString(),
    })),
    item_components: itemComponents.map((component) => ({
      id: component.id,
      item_id: component.itemId,
      name: component.name,
      summary: component.summary,
      row_order: component.rowOrder,
      created_at: component.createdAt.toISOString(),
      updated_at: component.updatedAt.toISOString(),
    })),
    ingredient_details: ingredientDetails.map((ingredient) => ({
      id: ingredient.id,
      item_id: ingredient.itemId,
      name: ingredient.name,
      detail: ingredient.detail,
      row_order: ingredient.rowOrder,
      created_at: ingredient.createdAt.toISOString(),
      updated_at: ingredient.updatedAt.toISOString(),
    })),
  };
}

export async function importDatabaseSnapshot(
  prisma: PrismaClient,
  snapshot: DatabaseSnapshot,
  replaceExisting: boolean,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (replaceExisting) {
      await tx.$executeRaw`DELETE FROM "config"`;
      await tx.ingredientDetail.deleteMany();
      await tx.itemComponent.deleteMany();
      await tx.menuScan.deleteMany();
      await tx.userMenuItem.deleteMany();
      await tx.locationHistory.deleteMany();
      await tx.menuItem.deleteMany();
      await tx.user.deleteMany();
    }

    if (snapshot.config.length > 0) {
      for (const entry of snapshot.config) {
        await tx.$executeRaw`
          INSERT INTO "config" ("id", "name", "value", "status")
          VALUES (${entry.id}, ${entry.name}, ${entry.value}, ${entry.status})
        `;
      }
    }

    if (snapshot.users.length > 0) {
      await tx.user.createMany({
        data: snapshot.users.map((user) => ({
          id: user.id,
          email: user.email,
          createdAt: new Date(user.created_at),
          updatedAt: new Date(user.updated_at),
          verifiedAt: new Date(user.verified_at),
        })),
      });
    }

    if (snapshot.menu_items.length > 0) {
      await tx.menuItem.createMany({
        data: snapshot.menu_items.map((item) => ({
          id: item.id,
          name: item.name,
          shortDescription: item.short_description,
          image: item.image,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at),
        })),
      });
    }

    if (snapshot.location_history.length > 0) {
      await tx.locationHistory.createMany({
        data: snapshot.location_history.map((location) => ({
          id: location.id,
          userId: location.user_id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          capturedAt: new Date(location.captured_at),
        })),
      });
    }

    if (snapshot.user_menu_items.length > 0) {
      await tx.userMenuItem.createMany({
        data: snapshot.user_menu_items.map((link) => ({
          id: link.id,
          itemId: link.item_id,
          userId: link.user_id,
          createdAt: new Date(link.created_at),
          updatedAt: new Date(link.updated_at),
        })),
      });
    }

    if (snapshot.menu_scans.length > 0) {
      await tx.menuScan.createMany({
        data: snapshot.menu_scans.map((menuScan) => ({
          id: menuScan.id,
          userId: menuScan.user_id,
          scanPhoto: menuScan.scan_photo,
          capturedAt: new Date(menuScan.captured_at),
        })),
      });
    }

    if (snapshot.item_components.length > 0) {
      await tx.itemComponent.createMany({
        data: snapshot.item_components.map((component) => ({
          id: component.id,
          itemId: component.item_id,
          name: component.name,
          summary: component.summary,
          rowOrder: component.row_order,
          createdAt: new Date(component.created_at),
          updatedAt: new Date(component.updated_at),
        })),
      });
    }

    if (snapshot.ingredient_details.length > 0) {
      await tx.ingredientDetail.createMany({
        data: snapshot.ingredient_details.map((ingredient) => ({
          id: ingredient.id,
          itemId: ingredient.item_id,
          name: ingredient.name,
          detail: ingredient.detail,
          rowOrder: ingredient.row_order,
          createdAt: new Date(ingredient.created_at),
          updatedAt: new Date(ingredient.updated_at),
        })),
      });
    }
  });

  await resetSequence(prisma, 'config', 'id');
  await resetSequence(prisma, '"user"', 'id');
  await resetSequence(prisma, 'location_history', 'id');
  await resetSequence(prisma, 'menu_scans', 'id');
}

async function resetSequence(
  prisma: PrismaClient,
  tableName: string,
  columnName: string,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('${tableName}', '${columnName}'),
      COALESCE((SELECT MAX(${columnName}) FROM ${tableName}), 1),
      EXISTS(SELECT 1 FROM ${tableName})
    );
  `);
}
