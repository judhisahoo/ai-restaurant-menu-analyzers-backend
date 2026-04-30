import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { persistUploadedImage } from '../common/utils/image-storage.util';
import { generateId } from '../common/utils/id.util';
import { PrismaService } from '../database/prisma.service';
import { UserService } from '../user/user.service';
import {
  AiService,
  type MenuScanProcessingMode,
} from '../common/ai/ai.service';
import { DishDto } from './dto/dish-analysis.dto';
import { PersistDishDto } from './dto/persist-menu-scan-dishes.dto';

type FakeDishRow = {
  dish_name?: unknown;
  short_description?: unknown;
};

@Injectable()
export class MenuScansService {
  private readonly logger = new Logger(MenuScansService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
    private readonly aiService: AiService,
  ) {}

  async create(
    userId: number,
    file: { buffer: Buffer; mimetype: string },
  ) {
    await this.userService.ensureUserExists(userId);

    const capturedAt = new Date();
    console.log('now at create() for processing menu scan upload to vercel storage and return image url.');
    //const storedPhoto = "https://sx4j6cy16hijedwf.public.blob.vercel-storage.com/scan_photo/scan-f8ca6489-14ad-4a10-916f-7f4f9b52e2ba.jpg";
    const storedPhoto = await persistUploadedImage(
      file.buffer,
      file.mimetype,
      'scan_photo',
      'scan',
    );
    console.log('Menu scan image stored successfully. URL:', storedPhoto);
    console.log('now at create() for saving menu scan record in database and then processing dish data from menu scan image using Gemini API or fake data based on configuration settings');
    const menuScan = await this.prismaService.menuScan.create({
      data: {
        userId,
        scanPhoto: storedPhoto,
        capturedAt,
      },
    });
    
    //console.log('Menu scan record saved successfully. ID:', menuScan.id);
    console.log(' now calling process_ai_for_dis_data() to analyze menu scan image and prepare dish data for response and background persistence.');

    const dishes = await this.process_ai_for_dis_data(userId, storedPhoto);

    return {
      message: 'Menu scan saved and dish data prepared successfully.',
      data: {
        menu_scan: {
          id: menuScan.id,
          user_id: userId,
          scan_photo: storedPhoto,
          captured_at: menuScan.capturedAt.toISOString(),
        },
        dishes,
      },
    };
    
  }

  private async process_ai_for_dis_data(
    userId: number,
    imageUrl: string,
  ): Promise<DishDto[]> {
    console.log('now at process_ai_for_dis_data() for processing dish data from menu scan image using the configured AI provider or fake data based on database settings');
    const processingMode =
      await this.aiService.resolveMenuScanProcessingMode();
    console.log('Resolved menu scan AI processing mode:', processingMode);

    const extractedDishes = await this.getDishDataForProcessingMode(
      imageUrl,
      processingMode,
    );

    const dishesWithImages =
      await this.get_dish_image_by_dish_name(extractedDishes);

    return dishesWithImages;
  }

  async persistDishes(
    userId: number,
    dishes: PersistDishDto[],
  ): Promise<{ message: string; persisted_count: number }> {
    await this.userService.ensureUserExists(userId);

    const normalizedDishes = this.normalizeDishData(
      dishes.map((dish) => ({
        name: dish.name,
        short_description: dish.short_description,
        image: dish.image ?? null,
      })),
    );

    const persistedCount = await this.persistProcessedDishes(
      userId,
      normalizedDishes,
    );

    return {
      message: 'Processed dishes persisted successfully.',
      persisted_count: persistedCount,
    };
  }

  private async getDishDataForProcessingMode(
    imageUrl: string,
    processingMode: MenuScanProcessingMode,
  ): Promise<DishDto[]> {
    if (processingMode === 'offline') {
      return this.readFakeDishData();
    }

    return this.aiService.analyzeMenuImage(imageUrl, processingMode);
  }

  private async readFakeDishData(): Promise<DishDto[]> {
    console.log('now at readFakeDishData() for preparing fakke data for dish analysis');
    const fakeDataPath = join(process.cwd(), 'data', 'dish_data.json');
    const fileContents = await readFile(fakeDataPath, 'utf8');
    const parsed = JSON.parse(fileContents) as FakeDishRow[];

    if (!Array.isArray(parsed)) {
      throw new Error('data/dish_data.json must contain a JSON array.');
    }

    return this.normalizeDishData(
      parsed.map((dish) => ({
        name: typeof dish.dish_name === 'string' ? dish.dish_name : '',
        short_description:
          typeof dish.short_description === 'string'
            ? dish.short_description
            : '',
        image: null,
      })),
    );
  }

  private normalizeDishData(dishes: DishDto[]): DishDto[] {
    const normalizedDishes = new Map<string, DishDto>();

    for (const dish of dishes) {
      const name = dish.name.replace(/\s+/g, ' ').trim();
      const shortDescription = dish.short_description.trim();

      if (!name || !shortDescription) {
        continue;
      }

      normalizedDishes.set(name.toLowerCase(), {
        name,
        short_description: shortDescription,
        image: dish.image ?? null,
      });
    }

    return [...normalizedDishes.values()];
  }

  private async get_dish_image_by_dish_name(
    dishes: DishDto[],
  ): Promise<DishDto[]> {
    // Since dish images are optional, just return normalized dishes without database lookup
    return this.normalizeDishData(dishes);
  }

  private async persistProcessedDishes(
    userId: number,
    dishes: DishDto[],
  ): Promise<number> {
    let persistedCount = 0;

    for (const dish of dishes) {
      try {
        const existingItem = await this.prismaService.menuItem.findFirst({
          where: {
            name: {
              equals: dish.name,
              mode: 'insensitive',
            },
          },
          select: {
            id: true,
            image: true,
          },
        });

        const menuItem = existingItem
          ? await this.prismaService.menuItem.update({
              where: { id: existingItem.id },
              data: {
                shortDescription: dish.short_description,
                image: existingItem.image ?? dish.image ?? null,
              },
              select: {
                id: true,
              },
            })
          : await this.prismaService.menuItem.create({
              data: {
                id: generateId(),
                name: dish.name,
                shortDescription: dish.short_description,
                image: dish.image ?? null,
              },
              select: {
                id: true,
              },
            });

        await this.prismaService.userMenuItem.upsert({
          where: {
            itemId_userId: {
              itemId: menuItem.id,
              userId,
            },
          },
          update: {},
          create: {
            id: generateId(),
            itemId: menuItem.id,
            userId,
          },
        });

        persistedCount += 1;
      } catch (error) {
        this.logger.error(
          `Failed to persist dish "${dish.name}"`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return persistedCount;
  }
}
