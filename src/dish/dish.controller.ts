import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBody,
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
  })
  @ApiBody({
    schema: {
      example: [
        {
          user_id: 12,
          itemdata: [
            {
              name: 'title one',
              short_description: 'item description',
            },
          ],
        },
      ],
    },
  })
  createItems(@Body() payload: unknown): Promise<unknown> {
    return this.dishService.createItems(payload);
  }

  @Post('item-search')
  @ApiOperation({ summary: 'Search menu items by title.' })
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
}
