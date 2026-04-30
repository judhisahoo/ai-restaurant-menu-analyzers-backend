import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { persistUploadedImage } from '../common/utils/image-storage.util';
import { generateId } from '../common/utils/id.util';
import { PrismaService } from '../database/prisma.service';
import { UserService } from '../user/user.service';
import {
  AiService,
  type MenuScanAiProvider,
  type MenuScanProcessingMode,
} from '../common/ai/ai.service';
import { DishDto } from './dto/dish-analysis.dto';

type FakeDishRow = {
  dish_name?: unknown;
  short_description?: unknown;
};

const DEFAULT_MENU_SCAN_AI_TIMEOUT_MS = 240_000;

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
    
    console.log('Menu scan record saved successfully. ID:', menuScan.id);
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

    const extractedDishes =
      processingMode === 'offline'
        ? await this.readFakeDishData()
        : await this.getDishDataWithTimeout(imageUrl, processingMode);

    const dishesWithImages =
      await this.get_dish_image_by_dish_name(extractedDishes);

    if (this.shouldPersistProcessedDishes()) {
      void this.persistProcessedDishes(userId, dishesWithImages).catch(
        (error: unknown) => {
          const message =
            error instanceof Error ? error.stack ?? error.message : String(error);
          this.logger.error(
            'Background dish persistence failed after menu scan processing.',
            message,
          );
        },
      );
    }

    return dishesWithImages;
  }

  private async getDishDataWithTimeout(
    imageUrl: string,
    processingMode: MenuScanAiProvider,
  ): Promise<DishDto[]> {
    const timeoutMs = this.getMenuScanAiTimeoutMs();
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Menu scan AI processing timed out.'));
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        this.aiService.analyzeMenuImage(imageUrl, processingMode),
        timeoutPromise,
      ]);
    } catch (error) {
      this.logger.warn(
        `Menu scan AI processing did not complete within ${timeoutMs}ms. Returning sample dish data to avoid a Vercel function timeout. Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return this.readFakeDishData();
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
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

  private getMenuScanAiTimeoutMs(): number {
    const configuredValue = Number(process.env.MENU_SCAN_AI_TIMEOUT_MS);

    if (Number.isFinite(configuredValue) && configuredValue > 0) {
      return configuredValue;
    }

    return DEFAULT_MENU_SCAN_AI_TIMEOUT_MS;
  }

  private shouldPersistProcessedDishes(): boolean {
    const configuredValue = process.env.MENU_SCAN_PERSIST_DISHES;

    if (configuredValue) {
      return configuredValue.toLowerCase() === 'true';
    }

    return process.env.VERCEL !== '1';
  }

  private async persistProcessedDishes(
    userId: number,
    dishes: DishDto[],
  ): Promise<void> {
    for (const dish of dishes) {
      try {
        await this.prismaService.$transaction(async (tx) => {
          const existingItem = await tx.menuItem.findFirst({
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

          const itemId = existingItem?.id ?? generateId();

          if (existingItem) {
            await tx.menuItem.update({
              where: { id: itemId },
              data: {
                shortDescription: dish.short_description,
                image: existingItem.image ?? dish.image ?? null,
              },
            });
          } else {
            await tx.menuItem.create({
              data: {
                id: itemId,
                name: dish.name,
                shortDescription: dish.short_description,
                image: dish.image ?? null,
              },
            });
          }

          const existingUserLink = await tx.userMenuItem.findFirst({
            where: {
              itemId,
              userId,
            },
            select: {
              id: true,
            },
          });

          if (!existingUserLink) {
            await tx.userMenuItem.create({
              data: {
                id: generateId(),
                itemId,
                userId,
              },
            });
          }
        });
      } catch (error) {
        this.logger.error(
          `Failed to persist dish "${dish.name}" in background`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
