import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { currentTimestamp } from '../common/utils/timestamps.util';
import { DatabaseService } from '../database/database.service';
import { UserService } from '../user/user.service';
import { ItemSearchDto } from './dto/item-search.dto';

interface MenuItemRow {
  id: string;
  name: string;
  short_description: string;
  image: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class DishService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly userService: UserService,
  ) {}

  async createItems(payload: unknown) {
    const wrapper = unwrapSinglePayload(payload, 'dish items payload');
    const userId = getRequiredInteger(wrapper.user_id, 'user_id');
    const rawItems = getArray(wrapper.itemdata, 'itemdata');

    await this.userService.ensureUserExists(userId);

    return this.databaseService.withTransaction(async () => {
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

        const existingItem = await this.databaseService.get<Pick<MenuItemRow, 'id' | 'name'>>(
          'SELECT id, name FROM menu_items WHERE lower(name) = lower(?);',
          [name],
        );

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
          const timestamp = currentTimestamp();
          const storedImage = rawImage
            ? persistImageValue(rawImage, 'item_image', 'item')
            : null;
          await this.databaseService.run(
            `INSERT INTO menu_items (id, name, short_description, image, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [itemId, name, shortDescription, storedImage, timestamp, timestamp],
          );

          createdItems.push({
            id: itemId,
            name,
            short_description: shortDescription,
            image: storedImage,
          });
        }

        const existingLink = await this.databaseService.get<{ id: string }>(
          `SELECT id FROM user_menu_items
           WHERE item_id = ? AND user_id = ?;`,
          [itemId, userId],
        );

        if (!existingLink) {
          const timestamp = currentTimestamp();
          const linkId = generateId();
          await this.databaseService.run(
            `INSERT INTO user_menu_items (id, item_id, user_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?);`,
            [linkId, itemId, userId, timestamp, timestamp],
          );

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

    const items = await this.databaseService.all<MenuItemRow>(
      `SELECT id, name, short_description, image, created_at, updated_at
       FROM menu_items
       WHERE name LIKE ?
       ORDER BY name ASC;`,
      [`%${searchTerm}%`],
    );

    return {
      message: 'Dish search completed successfully.',
      data: items,
    };
  }

  async getItemComponents(itemId: string) {
    const normalizedItemId = await this.ensureItemExists(itemId);
    const components = await this.databaseService.all<{
      id: string;
      item_id: string;
      name: string;
      summary: string;
      row_order: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, item_id, name, summary, row_order, created_at, updated_at
       FROM item_components
       WHERE item_id = ?
       ORDER BY row_order ASC;`,
      [normalizedItemId],
    );

    return {
      message: 'Item components fetched successfully.',
      data: components,
    };
  }

  async createItemComponents(routeItemId: string, payload: unknown) {
    const wrapper = unwrapSinglePayload(payload, 'item component payload');
    const itemId = this.resolveItemId(routeItemId, wrapper.item_id);
    const normalizedItemId = await this.ensureItemExists(itemId);
    const rawComponents = getArray(wrapper.componentData, 'componentData');

    return this.databaseService.withTransaction(async () => {
      const createdComponents: Array<Record<string, unknown>> = [];
      const skippedComponents: Array<Record<string, unknown>> = [];
      let currentOrder = await this.getNextOrderValue(
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

        const existingComponent = await this.databaseService.get<{
          id: string;
          row_order: number;
        }>(
          `SELECT id, row_order FROM item_components
           WHERE item_id = ? AND lower(name) = lower(?);`,
          [normalizedItemId, name],
        );

        if (existingComponent) {
          skippedComponents.push({
            id: existingComponent.id,
            name,
            reason: 'Component name already exists for this item.',
          });
          continue;
        }

        currentOrder += 1;
        const timestamp = currentTimestamp();
        const componentId = generateId();
        await this.databaseService.run(
          `INSERT INTO item_components (id, item_id, name, summary, row_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            componentId,
            normalizedItemId,
            name,
            summary,
            currentOrder,
            timestamp,
            timestamp,
          ],
        );

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
    const ingredients = await this.databaseService.all<{
      id: string;
      item_id: string;
      name: string;
      detail: string;
      row_order: number;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, item_id, name, detail, row_order, created_at, updated_at
       FROM ingredient_details
       WHERE item_id = ?
       ORDER BY row_order ASC;`,
      [normalizedItemId],
    );

    return {
      message: 'Ingredient details fetched successfully.',
      data: ingredients,
    };
  }

  async createItemIngredients(routeItemId: string, payload: unknown) {
    const wrapper = unwrapSinglePayload(payload, 'item ingredient payload');
    const itemId = this.resolveItemId(routeItemId, wrapper.item_id);
    const normalizedItemId = await this.ensureItemExists(itemId);
    const rawIngredients = getArray(wrapper.ingredientData, 'ingredientData');

    return this.databaseService.withTransaction(async () => {
      const createdIngredients: Array<Record<string, unknown>> = [];
      const skippedIngredients: Array<Record<string, unknown>> = [];
      let currentOrder = await this.getNextOrderValue(
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

        const existingIngredient = await this.databaseService.get<{
          id: string;
          row_order: number;
        }>(
          `SELECT id, row_order FROM ingredient_details
           WHERE item_id = ? AND lower(name) = lower(?);`,
          [normalizedItemId, name],
        );

        if (existingIngredient) {
          skippedIngredients.push({
            id: existingIngredient.id,
            name,
            reason: 'Ingredient name already exists for this item.',
          });
          continue;
        }

        currentOrder += 1;
        const timestamp = currentTimestamp();
        const ingredientId = generateId();
        await this.databaseService.run(
          `INSERT INTO ingredient_details (id, item_id, name, detail, row_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            ingredientId,
            normalizedItemId,
            name,
            detail,
            currentOrder,
            timestamp,
            timestamp,
          ],
        );

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
    const item = await this.databaseService.get<{ id: string }>(
      'SELECT id FROM menu_items WHERE id = ?;',
      [normalizedItemId],
    );

    if (!item) {
      throw new NotFoundException(`Menu item ${normalizedItemId} was not found.`);
    }

    return normalizedItemId;
  }

  private async getNextOrderValue(
    tableName: 'item_components' | 'ingredient_details',
    itemId: string,
  ): Promise<number> {
    const row = await this.databaseService.get<{ maxOrder: number }>(
      `SELECT COALESCE(MAX(row_order), 0) AS maxOrder
       FROM ${tableName}
       WHERE item_id = ?;`,
      [itemId],
    );

    return row?.maxOrder ?? 0;
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
