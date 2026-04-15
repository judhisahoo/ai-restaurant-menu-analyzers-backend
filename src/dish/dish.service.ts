import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../database/prisma.service'; // Ensure PrismaService is imported here

// Explicitly define the type for a transaction client that can be used within Prisma transactions.
type TransactionClient = Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$transaction' | '$extends' | '$use'>;

import { generateId } from '../common/utils/id.util';
import { persistImageValue } from '../common/utils/image-storage.util';
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

  async getItemComponents(itemId: string) {
    const normalizedItemId = await this.ensureItemExists(itemId);
    const components = await this.prismaService.itemComponent.findMany({
      where: {
        itemId: normalizedItemId,
      },
      orderBy: {
        rowOrder: 'asc',
      },
    });

    return {
      message: 'Item components fetched successfully.',
      data: components.map((component: { id: string; itemId: string; name: string; summary: string; rowOrder: number; createdAt: Date; updatedAt: Date; }) => ({
        id: component.id,
        item_id: component.itemId,
        name: component.name,
        summary: component.summary,
        row_order: component.rowOrder,
        created_at: component.createdAt.toISOString(),
        updated_at: component.updatedAt.toISOString(),
      })),
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

  async getItemIngredients(itemId: string) {
    const normalizedItemId = await this.ensureItemExists(itemId);
    const ingredients = await this.prismaService.ingredientDetail.findMany({
      where: {
        itemId: normalizedItemId,
      },
      orderBy: {
        rowOrder: 'asc',
      },
    });

    return {
      message: 'Ingredient details fetched successfully.',
      data: ingredients.map((ingredient: { id: string; itemId: string; name: string; detail: string; rowOrder: number; createdAt: Date; updatedAt: Date; }) => ({
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
