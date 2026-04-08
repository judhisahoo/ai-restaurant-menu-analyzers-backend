import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ItemSearchDto } from './dto/item-search.dto';
import { DishService } from './dish.service';

@ApiTags('Dish')
@Controller('dish')
export class DishController {
  constructor(private readonly dishService: DishService) {}

  @Post('items')
  @ApiOperation({
    summary:
      'Store multiple AI-generated menu items and link them to a user.',
    description:
      'Swagger UI documents the multipart form variant for testing file upload. The backend still accepts the existing JSON payload used by the frontend.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    description:
      'Created item image fields are returned as public Vercel Blob URLs when an image payload is uploaded.',
    schema: {
      example: {
        message: 'Dish items processed successfully.',
        data: {
          user_id: 12,
          created_items: [
            {
              id: 'itm_01',
              name: 'Paneer Butter Masala',
              short_description: 'Tomato-based paneer curry.',
              image:
                'https://example-public.blob.vercel-storage.com/item_image/item-3c8e55a1.jpg',
            },
          ],
          reused_items: [],
          user_menu_item_links: [
            {
              id: 'lnk_01',
              item_id: 'itm_01',
              user_id: 12,
            },
          ],
        },
      },
    },
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['user_id', 'name', 'short_description'],
      properties: {
        user_id: {
          type: 'integer',
          example: 12,
        },
        name: {
          type: 'string',
          example: 'Paneer Butter Masala',
        },
        short_description: {
          type: 'string',
          example: 'Tomato-based paneer curry.',
        },
        image: {
          type: 'string',
          format: 'binary',
          description:
            'Optional image file. Stored in Vercel Blob under the item_image/ folder.',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  createItems(
    @Body() payload: Record<string, unknown>,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ): Promise<unknown> {
    return this.dishService.createItems(
      this.normalizeCreateItemsPayload(payload, file),
    );
  }

  @Post('item-search')
  @ApiOperation({
    summary: 'Search menu items by title.',
    description:
      'When an item has an image, the image field contains the public Vercel Blob URL.',
  })
  @ApiOkResponse({
    description: 'Matching menu items.',
    schema: {
      example: {
        message: 'Dish search completed successfully.',
        data: [
          {
            id: 'itm_01',
            name: 'Paneer Butter Masala',
            short_description: 'Tomato-based paneer curry.',
            image:
              'https://example-public.blob.vercel-storage.com/item_image/item-3c8e55a1.jpg',
            created_at: '2026-04-08T10:22:30.000Z',
            updated_at: '2026-04-08T10:22:30.000Z',
          },
        ],
      },
    },
  })
  searchItems(@Body() payload: ItemSearchDto): Promise<unknown> {
    return this.dishService.searchItems(payload);
  }

  @Get('item-component/:itemId')
  @ApiOperation({ summary: 'Fetch components for a menu item.' })
  @ApiParam({ name: 'itemId', example: '1' })
  getItemComponents(@Param('itemId') itemId: string): Promise<unknown> {
    return this.dishService.getItemComponents(itemId);
  }

  @Post('item-component/:itemId')
  @ApiOperation({ summary: 'Store multiple components for a menu item.' })
  @ApiParam({ name: 'itemId', example: '1' })
  @ApiBody({
    schema: {
      example: [
        {
          item_id: '1',
          componentData: [
            {
              name: 'component name1',
              summary: 'component summary1',
            },
          ],
        },
      ],
    },
  })
  createItemComponents(
    @Param('itemId') itemId: string,
    @Body() payload: unknown,
  ): Promise<unknown> {
    return this.dishService.createItemComponents(itemId, payload);
  }

  @Get('item-ingredient/:itemId')
  @ApiOperation({ summary: 'Fetch ingredient details for a menu item.' })
  @ApiParam({ name: 'itemId', example: '1' })
  getItemIngredients(@Param('itemId') itemId: string): Promise<unknown> {
    return this.dishService.getItemIngredients(itemId);
  }

  @Post('item-ingredient/:itemId')
  @ApiOperation({
    summary: 'Store multiple ingredient details for a menu item.',
  })
  @ApiParam({ name: 'itemId', example: '1' })
  @ApiBody({
    schema: {
      example: [
        {
          item_id: '1',
          ingredientData: [
            {
              name: 'ingredient name1',
              detail: 'ingredient detail1',
            },
          ],
        },
      ],
    },
  })
  createItemIngredients(
    @Param('itemId') itemId: string,
    @Body() payload: unknown,
  ): Promise<unknown> {
    return this.dishService.createItemIngredients(itemId, payload);
  }

  private normalizeCreateItemsPayload(
    payload: Record<string, unknown>,
    file?: { buffer: Buffer; mimetype: string },
  ): unknown {
    const parsedItemData = this.tryParseMultipartItemData(payload.itemdata);

    if (parsedItemData) {
      if (file && parsedItemData.length > 1) {
        throw new BadRequestException(
          'Multipart image upload supports exactly one itemdata entry.',
        );
      }

      if (file && parsedItemData.length === 1) {
        parsedItemData[0].image = this.fileToDataUrl(file);
      }

      return {
        ...payload,
        itemdata: parsedItemData,
      };
    }

    if (typeof payload.name === 'string' && typeof payload.short_description === 'string') {
      return {
        user_id: payload.user_id,
        itemdata: [
          {
            name: payload.name,
            short_description: payload.short_description,
            image: file ? this.fileToDataUrl(file) : undefined,
          },
        ],
      };
    }

    return payload;
  }

  private tryParseMultipartItemData(value: unknown): Array<Record<string, unknown>> | null {
    if (Array.isArray(value)) {
      return value as Array<Record<string, unknown>>;
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('itemdata must be a JSON array.');
      }

      return parsed as Array<Record<string, unknown>>;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('itemdata must be valid JSON when sent as text.');
    }
  }

  private fileToDataUrl(file: { buffer: Buffer; mimetype: string }): string {
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  }
}
