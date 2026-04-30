import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../database/prisma.service'; // Ensure PrismaService is imported here

// Explicitly define the type for a transaction client that can be used within Prisma transactions.
type TransactionClient = Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$transaction' | '$extends' | '$use'>;

type MockDishRow = {
  dish_name?: unknown;
  component_details?: unknown;
  ingredient_details?: unknown;
};

import { generateId } from '../common/utils/id.util';
import { persistImageValue } from '../common/utils/image-storage.util';
import { AiService } from '../common/ai/ai.service';
import {
  ItemComponentReportDto,
  ItemIngredientReportDto,
} from '../common/ai/menu-image-analysis.util';
import {
  assertObject,
  getArray,
  getRequiredIdentifier,
  getRequiredInteger,
  getOptionalString,
  getRequiredString,
  unwrapSinglePayload,
} from '../common/utils/request-parsing.util';
import { UserService } from '../user/user.service';
import { ItemSearchDto } from './dto/item-search.dto';

@Injectable()
export class DishService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly userService: UserService,
    private readonly aiService: AiService,
  ) {}

  async createItems(payload: unknown) {
    const wrapper = unwrapSinglePayload(payload, 'dish items payload');
    const userId = getRequiredInteger(wrapper.user_id, 'user_id');
    const rawItems = getArray(wrapper.itemdata, 'itemdata');

    await this.userService.ensureUserExists(userId);

    return this.prismaService.$transaction(async (tx: TransactionClient): Promise<any> => {
      const createdItems: Array<Record<string, unknown>> = [];
      const reusedItems: Array<Record<string, unknown>> = [];
      const userLinks: Array<Record<string, unknown>> = [];

      for (const rawItem of rawItems) {
        const item = assertObject(rawItem, 'itemdata[]');
        const name = getRequiredString(item.name, 'itemdata[].name');
        const shortDescription = getRequiredString(
          item.short_description,
          'itemdata[].short_description',
        );
        const rawImage = getOptionalString(item.image, 'itemdata[].image');

        const existingItem = await tx.menuItem.findFirst({
          where: {
            name: {
              equals: name,
              mode: 'insensitive',
            },
          },
          select: {
            id: true,
            name: true,
          },
        });

        let itemId: string;
        if (existingItem) {
          itemId = existingItem.id;
          reusedItems.push({
            id: existingItem.id,
            name: existingItem.name,
            reason: 'Item name already exists. Existing row reused.',
          });
        } else {
          itemId = generateId();
          const now = new Date();
          const storedImage = rawImage
            ? await persistImageValue(rawImage, 'item_image', 'item')
            : null;
          await tx.menuItem.create({
            data: {
              id: itemId,
              name,
              shortDescription,
              image: storedImage,
              createdAt: now,
              updatedAt: now,
            },
          });

          createdItems.push({
            id: itemId,
            name,
            short_description: shortDescription,
            image: storedImage,
          });
        }

        const existingLink = await tx.userMenuItem.findFirst({
          where: {
            itemId,
            userId,
          },
          select: {
            id: true,
          },
        });

        if (!existingLink) {
          const now = new Date();
          const linkId = generateId();
          await tx.userMenuItem.create({
            data: {
              id: linkId,
              itemId,
              userId,
              createdAt: now,
              updatedAt: now,
            },
          });

          userLinks.push({
            id: linkId,
            item_id: itemId,
            user_id: userId,
          });
        }
      }

      return {
        message: 'Dish items processed successfully.',
        data: {
          user_id: userId,
          created_items: createdItems,
          reused_items: reusedItems,
          user_menu_item_links: userLinks,
        },
      };
    });
  }

  async searchItems(payload: ItemSearchDto) {
    const searchTerm = payload.item_title.trim();
    if (!searchTerm) {
      throw new BadRequestException('item_title must be a non-empty string.');
    }

    const items = await this.prismaService.menuItem.findMany({
      where: {
        name: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    if (items.length === 0) {
      throw new NotFoundException(
        `Menu item "${searchTerm}" is not available yet because it has not been found in any scanned menu card.`,
      );
    }

    return {
      message: 'Dish search completed successfully.',
      data: items.map((item: { id: string; name: string; shortDescription: string; image: string | null; createdAt: Date; updatedAt: Date; }) => ({
        id: item.id,
        name: item.name,
        short_description: item.shortDescription,
        image: item.image,
        created_at: item.createdAt.toISOString(),
        updated_at: item.updatedAt.toISOString(),
      })),
    };
  }

  async getItemComponents(itemName: string) {
    if (this.shouldUseMuckData()) {
      return this.getItemComponentsFromMockData(itemName);
    }

    const item = await this.getItemByNameSlug(itemName);
    let components = await this.findItemComponents(item.id);

    if (components.length === 0) {
      const componentReport = await this.aiService.generateItemComponentReport(
        item.normalizedName,
      );

      await this.createGeneratedItemComponents(item.id, componentReport);

      return {
        message: 'Item components generated successfully.',
        data: {
          item: {
            item_id: item.id,
            item_name: item.normalizedName,
          },
          component: componentReport.map((component) => ({
            name: component.name,
            detail: component.detail,
          })),
        },
      };
    }

    return {
      message: 'Item components fetched successfully.',
      data: {
        item: {
          item_id: item.id,
          item_name: item.normalizedName,
        },
        component: this.formatItemComponentsForResponse(components),
      },
    };
  }

  async createItemComponents(routeItemId: string, payload: unknown) {
    const wrapper = unwrapSinglePayload(payload, 'item component payload');
    const itemId = this.resolveItemId(routeItemId, wrapper.item_id);
    const normalizedItemId = await this.ensureItemExists(itemId);
    const rawComponents = getArray(wrapper.componentData, 'componentData');

    return this.prismaService.$transaction(async (tx: TransactionClient): Promise<any> => {
      const createdComponents: Array<Record<string, unknown>> = [];
      const skippedComponents: Array<Record<string, unknown>> = [];
      let currentOrder = await this.getNextOrderValue(
        tx,
        'item_components',
        normalizedItemId,
      );

      for (const rawComponent of rawComponents) {
        const component = assertObject(rawComponent, 'componentData[]');
        const name = getRequiredString(
          component.name,
          'componentData[].name',
        );
        const summary = getRequiredString(
          component.summary,
          'componentData[].summary',
        );

        const existingComponent = await tx.itemComponent.findFirst({
          where: {
            itemId: normalizedItemId,
            name: {
              equals: name,
              mode: 'insensitive',
            },
          },
          select: {
            id: true,
            rowOrder: true,
          },
        });

        if (existingComponent) {
          skippedComponents.push({
            id: existingComponent.id,
            name,
            reason: 'Component name already exists for this item.',
          });
          continue;
        }

        currentOrder += 1;
        const now = new Date();
        const componentId = generateId();
        await tx.itemComponent.create({
          data: {
            id: componentId,
            itemId: normalizedItemId,
            name,
            summary,
            rowOrder: currentOrder,
            createdAt: now,
            updatedAt: now,
          },
        });

        createdComponents.push({
          id: componentId,
          item_id: normalizedItemId,
          name,
          summary,
          row_order: currentOrder,
        });
      }

      return {
        message: 'Item components processed successfully.',
        data: {
          item_id: normalizedItemId,
          created_components: createdComponents,
          skipped_components: skippedComponents,
        },
      };
    });
  }

  async getItemIngredients(itemName: string) {
    if (this.shouldUseMuckData()) {
      return this.getItemIngredientsFromMockData(itemName);
    }

    const item = await this.getItemByNameSlug(itemName);
    const ingredients = await this.findItemIngredients(item.id);

    if (ingredients.length === 0) {
      const ingredientReport = await this.aiService.generateItemIngredientReport(
        item.normalizedName,
      );

      await this.createGeneratedItemIngredients(item.id, ingredientReport);

      return {
        message: 'Ingredient details generated successfully.',
        data: {
          item: {
            item_id: item.id,
            item_name: item.normalizedName,
          },
          ingredient: ingredientReport.map((ingredient) => ({
            name: ingredient.name,
            detail: ingredient.detail,
          })),
        },
      };
    }

    return {
      message: 'Ingredient details fetched successfully.',
      data: {
        item: {
          item_id: item.id,
          item_name: item.normalizedName,
        },
        ingredient: this.formatItemIngredientsForResponse(ingredients),
      },
    };
  }

  async createItemIngredients(routeItemId: string, payload: unknown) {
    const wrapper = unwrapSinglePayload(payload, 'item ingredient payload');
    const itemId = this.resolveItemId(routeItemId, wrapper.item_id);
    const normalizedItemId = await this.ensureItemExists(itemId);
    const rawIngredients = getArray(wrapper.ingredientData, 'ingredientData');

    return this.prismaService.$transaction(async (tx: TransactionClient): Promise<any> => {
      const createdIngredients: Array<Record<string, unknown>> = [];
      const skippedIngredients: Array<Record<string, unknown>> = [];
      let currentOrder = await this.getNextOrderValue(
        tx,
        'ingredient_details',
        normalizedItemId,
      );

      for (const rawIngredient of rawIngredients) {
        const ingredient = assertObject(rawIngredient, 'ingredientData[]');
        const name = getRequiredString(
          ingredient.name,
          'ingredientData[].name',
        );
        const detail = getRequiredString(
          ingredient.detail,
          'ingredientData[].detail',
        );

        const existingIngredient = await tx.ingredientDetail.findFirst({
          where: {
            itemId: normalizedItemId,
            name: {
              equals: name,
              mode: 'insensitive',
            },
          },
          select: {
            id: true,
            rowOrder: true,
          },
        });

        if (existingIngredient) {
          skippedIngredients.push({
            id: existingIngredient.id,
            name,
            reason: 'Ingredient name already exists for this item.',
          });
          continue;
        }

        currentOrder += 1;
        const now = new Date();
        const ingredientId = generateId();
        await tx.ingredientDetail.create({
          data: {
            id: ingredientId,
            itemId: normalizedItemId,
            name,
            detail,
            rowOrder: currentOrder,
            createdAt: now,
            updatedAt: now,
          },
        });

        createdIngredients.push({
          id: ingredientId,
          item_id: normalizedItemId,
          name,
          detail,
          row_order: currentOrder,
        });
      }

      return {
        message: 'Ingredient details processed successfully.',
        data: {
          item_id: normalizedItemId,
          created_ingredients: createdIngredients,
          skipped_ingredients: skippedIngredients,
        },
      };
    });
  }

  private async ensureItemExists(itemId: string): Promise<string> {
    const normalizedItemId = getRequiredIdentifier(itemId, 'item_id');
    const item = await this.prismaService.menuItem.findUnique({
      where: { id: normalizedItemId },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException(`Menu item ${normalizedItemId} was not found.`);
    }

    return normalizedItemId;
  }

  private async getItemByNameSlug(
    itemName: string,
  ): Promise<{ id: string; normalizedName: string }> {
    const normalizedItemName = this.normalizeItemNameSlug(itemName);
    const item = await this.prismaService.menuItem.findFirst({
      where: {
        name: {
          equals: normalizedItemName,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    if (!item) {
      throw new NotFoundException(
        `Menu item "${normalizedItemName}" is not available yet because it has not been found in any scanned menu card.`,
      );
    }

    return {
      id: item.id,
      normalizedName: normalizedItemName,
    };
  }

  private normalizeItemNameSlug(itemName: string): string {
    const normalizedItemName = getRequiredIdentifier(
      itemName,
      'item_name',
    )
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!normalizedItemName) {
      throw new BadRequestException('item_name must be a non-empty string.');
    }

    return normalizedItemName;
  }

  private shouldUseMuckData(): boolean {
    return process.env.USE_MUCK_DATA?.trim().toLowerCase() === 'true';
  }

  private async getItemComponentsFromMockData(itemName: string) {
    console.log('Using mock data for item components, getItemComponentsFromMockData(). This is not based on real AI analysis and is only for testing purposes.');
    console.log('Item name received:', itemName);
    const normalizedItemName = this.normalizeItemNameSlug(itemName);
    console.log('Normalized item name for mock data lookup:', normalizedItemName);
    const fakeDataPath = join(process.cwd(), 'data', 'dish_data.json');
    const fileContents = await readFile(fakeDataPath, 'utf8');
    const parsed = JSON.parse(fileContents) as MockDishRow[];

    if (!Array.isArray(parsed)) {
      throw new Error('data/dish_data.json must contain a JSON array.');
    }

    const dish = parsed.find((row) => {
      if (typeof row.dish_name !== 'string') {
        return false;
      }

      return this.normalizeDishName(row.dish_name) === normalizedItemName;
    });

    if (!dish) {
      throw new NotFoundException(
        `Menu item "${normalizedItemName}" is not available in data/dish_data.json.`,
      );
    }

    return {
      message: 'Item components generated successfully.',
      data: {
        item: {
          item_id: this.createMockItemId(normalizedItemName),
          item_name: normalizedItemName,
        },
        component: this.parseMockComponentDetails(dish.component_details),
      },
    };
  }

  private async getItemIngredientsFromMockData(itemName: string) {
    const normalizedItemName = this.normalizeItemNameSlug(itemName);
    const fakeDataPath = join(process.cwd(), 'data', 'dish_data.json');
    const fileContents = await readFile(fakeDataPath, 'utf8');
    const parsed = JSON.parse(fileContents) as MockDishRow[];

    if (!Array.isArray(parsed)) {
      throw new Error('data/dish_data.json must contain a JSON array.');
    }

    const dish = parsed.find((row) => {
      if (typeof row.dish_name !== 'string') {
        return false;
      }

      return this.normalizeDishName(row.dish_name) === normalizedItemName;
    });

    if (!dish) {
      throw new NotFoundException(
        `Menu item "${normalizedItemName}" is not available in data/dish_data.json.`,
      );
    }

    return {
      message: 'Ingredient details generated successfully.',
      data: {
        item: {
          item_id: this.createMockItemId(normalizedItemName),
          item_name: normalizedItemName,
        },
        ingredient: this.parseMockIngredientDetails(dish.ingredient_details),
      },
    };
  }

  private normalizeDishName(dishName: string): string {
    return dishName.replace(/-/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private createMockItemId(itemName: string): string {
    const hash = createHash('sha256').update(itemName).digest('hex');

    return [
      hash.slice(0, 8),
      hash.slice(8, 12),
      `4${hash.slice(13, 16)}`,
      `8${hash.slice(17, 20)}`,
      hash.slice(20, 32),
    ].join('-');
  }

  private parseMockComponentDetails(
    rawComponentDetails: unknown,
  ): Array<{ name: string; detail: string }> {
    if (typeof rawComponentDetails !== 'string') {
      return [];
    }

    const parsed = JSON.parse(rawComponentDetails.replace(/'/g, '"')) as Record<
      string,
      unknown
    >;

    return Object.entries(parsed).map(([key, value]) => ({
      name: this.formatComponentName(key),
      detail: String(value),
    }));
  }

  private parseMockIngredientDetails(
    rawIngredientDetails: unknown,
  ): Array<{ name: string; detail: string }> {
    if (typeof rawIngredientDetails !== 'string') {
      return this.buildIngredientResponse({});
    }

    const parsed = JSON.parse(rawIngredientDetails.replace(/'/g, '"')) as Record<
      string,
      unknown
    >;

    return this.buildIngredientResponse(parsed);
  }

  private buildIngredientResponse(
    parsed: Record<string, unknown>,
  ): Array<{ name: string; detail: string }> {
    const mainIngredients = this.getStringArray(parsed.main_ingredients);
    const protein = this.getNumberValue(parsed.protein_g);
    const carbohydrates = this.getNumberValue(parsed.carbohydrates_g);
    const fats = this.getNumberValue(parsed.fats_g);

    return [
      {
        name: 'Primary Ingredients',
        detail: this.formatIngredientCounts(mainIngredients),
      },
      {
        name: 'Binding & Leavening',
        detail: this.pickIngredients(
          mainIngredients,
          ['flour', 'yogurt', 'cream', 'rice', 'lentils'],
          'None',
        ),
      },
      {
        name: 'Flavorings',
        detail: this.pickIngredients(
          mainIngredients,
          [
            'onions',
            'garlic',
            'ginger',
            'coriander',
            'cumin',
            'turmeric',
            'chili',
            'garam masala',
            'tomatoes',
          ],
          mainIngredients.length > 0 ? mainIngredients.join(', ') : 'None',
        ),
      },
      {
        name: 'Fats & Cooking Medium',
        detail: this.pickIngredients(
          mainIngredients,
          ['oil', 'ghee', 'cream', 'coconut milk'],
          fats === null ? 'None' : `Estimated fat: ${fats}g`,
        ),
      },
      {
        name: 'Texture Analysis',
        detail: 'Texture varies by cooking method and ingredient preparation.',
      },
      {
        name: 'Nutritional Profile',
        detail: this.formatNutritionProfile(protein, carbohydrates, fats),
      },
      {
        name: 'Accompaniments',
        detail: 'Chutney, raita, pickle, or rice/bread depending on serving style.',
      },
      {
        name: 'Allergy & Dietary Notes',
        detail:
          mainIngredients.length > 0
            ? `Contains ${mainIngredients.join(', ')}. Check dietary restrictions before serving.`
            : 'Check dietary restrictions before serving.',
      },
    ];
  }

  private getStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private getNumberValue(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private formatIngredientCounts(ingredients: string[]): string {
    if (ingredients.length === 0) {
      return 'None';
    }

    const counts = new Map<string, number>();
    for (const ingredient of ingredients) {
      const key = ingredient.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([ingredient, count]) => `${ingredient}:${count}`)
      .join(', ');
  }

  private pickIngredients(
    ingredients: string[],
    allowedIngredients: string[],
    fallback: string,
  ): string {
    const allowed = new Set(allowedIngredients);
    const matched = ingredients.filter((ingredient) =>
      allowed.has(ingredient.toLowerCase()),
    );

    return matched.length > 0 ? matched.join(', ') : fallback;
  }

  private formatNutritionProfile(
    protein: number | null,
    carbohydrates: number | null,
    fats: number | null,
  ): string {
    const nutritionParts = [
      protein === null ? null : `Protein ${protein}g`,
      carbohydrates === null ? null : `Carbohydrates ${carbohydrates}g`,
      fats === null ? null : `Fat ${fats}g`,
    ].filter((part): part is string => part !== null);

    return nutritionParts.length > 0
      ? nutritionParts.join(', ')
      : 'Nutrition data not available.';
  }

  private formatComponentName(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  private async findItemComponents(itemId: string) {
    return this.prismaService.itemComponent.findMany({
      where: {
        itemId,
      },
      orderBy: {
        rowOrder: 'asc',
      },
    });
  }

  private async findItemIngredients(itemId: string) {
    return this.prismaService.ingredientDetail.findMany({
      where: {
        itemId,
      },
      orderBy: {
        rowOrder: 'asc',
      },
    });
  }

  private async createGeneratedItemComponents(
    itemId: string,
    componentReport: ItemComponentReportDto[],
  ): Promise<void> {
    const existingComponents = await this.prismaService.itemComponent.findMany({
      where: { itemId },
      select: {
        name: true,
        rowOrder: true,
      },
    });

    const existingNames = new Set(
      existingComponents.map((component) => component.name.toLowerCase()),
    );
    const newNames = new Set<string>();
    let currentOrder = existingComponents.reduce(
      (maxOrder, component) => Math.max(maxOrder, component.rowOrder),
      0,
    );
    const now = new Date();

    const componentsToCreate = componentReport
      .filter((component) => {
        const nameKey = component.name.trim().toLowerCase();

        if (!nameKey || existingNames.has(nameKey) || newNames.has(nameKey)) {
          return false;
        }

        newNames.add(nameKey);
        return true;
      })
      .map((component) => {
        currentOrder += 1;

        return {
          id: generateId(),
          itemId,
          name: component.name,
          summary: component.detail,
          rowOrder: currentOrder,
          createdAt: now,
          updatedAt: now,
        };
      });

    if (componentsToCreate.length === 0) {
      return;
    }

    await this.prismaService.itemComponent.createMany({
      data: componentsToCreate,
      skipDuplicates: true,
    });
  }

  private async createGeneratedItemIngredients(
    itemId: string,
    ingredientReport: ItemIngredientReportDto[],
  ): Promise<void> {
    const existingIngredients =
      await this.prismaService.ingredientDetail.findMany({
        where: { itemId },
        select: {
          name: true,
          rowOrder: true,
        },
      });

    const existingNames = new Set(
      existingIngredients.map((ingredient) => ingredient.name.toLowerCase()),
    );
    const newNames = new Set<string>();
    let currentOrder = existingIngredients.reduce(
      (maxOrder, ingredient) => Math.max(maxOrder, ingredient.rowOrder),
      0,
    );
    const now = new Date();

    const ingredientsToCreate = ingredientReport
      .filter((ingredient) => {
        const nameKey = ingredient.name.trim().toLowerCase();

        if (!nameKey || existingNames.has(nameKey) || newNames.has(nameKey)) {
          return false;
        }

        newNames.add(nameKey);
        return true;
      })
      .map((ingredient) => {
        currentOrder += 1;

        return {
          id: generateId(),
          itemId,
          name: ingredient.name,
          detail: ingredient.detail,
          rowOrder: currentOrder,
          createdAt: now,
          updatedAt: now,
        };
      });

    if (ingredientsToCreate.length === 0) {
      return;
    }

    await this.prismaService.ingredientDetail.createMany({
      data: ingredientsToCreate,
      skipDuplicates: true,
    });
  }

  private formatItemComponents(
    components: Array<{
      id: string;
      itemId: string;
      name: string;
      summary: string;
      rowOrder: number;
      createdAt: Date;
      updatedAt: Date;
    }>,
  ): Array<Record<string, unknown>> {
    return components.map((component) => ({
      id: component.id,
      item_id: component.itemId,
      name: component.name,
      summary: component.summary,
      row_order: component.rowOrder,
      created_at: component.createdAt.toISOString(),
      updated_at: component.updatedAt.toISOString(),
    }));
  }

  private formatItemComponentsForResponse(
    components: Array<{
      name: string;
      summary: string;
    }>,
  ): Array<{ name: string; detail: string }> {
    return components.map((component) => ({
      name: component.name,
      detail: component.summary,
    }));
  }

  private formatItemIngredients(
    ingredients: Array<{
      id: string;
      itemId: string;
      name: string;
      detail: string;
      rowOrder: number;
      createdAt: Date;
      updatedAt: Date;
    }>,
  ): Array<Record<string, unknown>> {
    return ingredients.map((ingredient) => ({
      id: ingredient.id,
      item_id: ingredient.itemId,
      name: ingredient.name,
      detail: ingredient.detail,
      row_order: ingredient.rowOrder,
      created_at: ingredient.createdAt.toISOString(),
      updated_at: ingredient.updatedAt.toISOString(),
    }));
  }

  private formatItemIngredientsForResponse(
    ingredients: Array<{
      name: string;
      detail: string;
    }>,
  ): Array<{ name: string; detail: string }> {
    return ingredients.map((ingredient) => ({
      name: ingredient.name,
      detail: ingredient.detail,
    }));
  }

  private async getNextOrderValue(
    tx: TransactionClient,
    tableName: 'item_components' | 'ingredient_details',
    itemId: string,
  ): Promise<number> {
    if (tableName === 'item_components') {
      const result = await tx.itemComponent.aggregate({
        where: { itemId },
        _max: { rowOrder: true },
      });

      return result._max.rowOrder ?? 0;
    }

    const result = await tx.ingredientDetail.aggregate({
      where: { itemId },
      _max: { rowOrder: true },
    });

    return result._max.rowOrder ?? 0;
  }

  private resolveItemId(routeItemId: string, bodyItemId: unknown): string {
    const routeValue = getRequiredIdentifier(routeItemId, 'item_id');

    if (bodyItemId === undefined || bodyItemId === null) {
      return routeValue;
    }

    const bodyValue = getRequiredIdentifier(bodyItemId, 'item_id');
    if (routeValue !== bodyValue) {
      throw new BadRequestException(
        'item_id in the path and request body must match.',
      );
    }

    return routeValue;
  }
}
