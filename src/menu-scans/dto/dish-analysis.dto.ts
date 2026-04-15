import { ApiProperty } from '@nestjs/swagger';

export class DishDto {
  @ApiProperty({
    example: 'Biryani',
    description: 'Name of the dish',
  })
  name: string;

  @ApiProperty({
    example:
      'A fragrant rice dish layered with basmati rice, spices, and tender meat or vegetables. Slow cooking helps the flavors deepen, giving each bite warmth, aroma, and richness. It is commonly served as a filling main course and is known for its balanced mix of texture, spice, and comforting taste.',
    description: 'Short description of the dish (approximately 50 words)',
  })
  short_description: string;

  @ApiProperty({
    example:
      'https://example-public.blob.vercel-storage.com/item_image/item-3c8e55a1.jpg',
    description:
      'Existing dish image URL from menu_items when a matching name is found',
    nullable: true,
  })
  image: string | null;

  constructor(name: string, shortDescription: string, image: string | null) {
    this.name = name;
    this.short_description = shortDescription;
    this.image = image;
  }
}

export class MenuAnalysisResponseDto {
  @ApiProperty({
    example: 'Menu scan saved and dish data prepared successfully.',
    description: 'Response message',
  })
  message: string;

  @ApiProperty({
    type: 'object',
    description: 'Menu scan and analysis data',
    properties: {
      menu_scan: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 101 },
          user_id: { type: 'number', example: 12 },
          scan_photo: {
            type: 'string',
            example:
              'https://example-public.blob.vercel-storage.com/scan_photo/scan-7d5f9f7a.jpg',
          },
          captured_at: {
            type: 'string',
            example: '2026-04-08T10:22:30.000Z',
          },
        },
      },
      dishes: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/DishDto',
        },
        example: [
          {
            name: 'Biryani',
            short_description: 'A fragrant rice dish...',
            image:
              'https://example-public.blob.vercel-storage.com/item_image/item-3c8e55a1.jpg',
          },
          {
            name: 'Samosa',
            short_description: 'A crispy pastry...',
            image: null,
          },
        ],
      },
    },
  })
  data: {
    menu_scan: {
      id: number;
      user_id: number;
      scan_photo: string;
      captured_at: string;
    };
    dishes: DishDto[];
  };

  constructor(message: string, data: { menu_scan: { id: number; user_id: number; scan_photo: string; captured_at: string; }; dishes: DishDto[]; }) {
    this.message = message;
    this.data = data;
  }
}
