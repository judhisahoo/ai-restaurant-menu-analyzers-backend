import { Injectable, BadRequestException } from '@nestjs/common';
import {
  GoogleGenerativeAI,
  SchemaType,
  type EnhancedGenerateContentResponse,
  type ResponseSchema,
} from '@google/generative-ai';
import { DishDto } from '../../menu-scans/dto/dish-analysis.dto';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private readonly dishResponseSchema: ResponseSchema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
        },
        short_description: {
          type: SchemaType.STRING,
        },
      },
      required: ['name', 'short_description'],
    },
  };

  async analyzeMenuImage(
    imageUrl: string,
  ): Promise<DishDto[]> {
    try {
      console.log('now at analyzeMenuImage() for analyzing menu scan image using Gemini API to extract dish data');
      console.log('Menu image URL to analyze:', imageUrl);
      console.log('Initializing Gemini API client and preparing prompt for menu image analysis');
      const model = this.getClient().getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: this.dishResponseSchema,
          temperature: 0.2,
        },
      });

      const prompt = `You are a restaurant menu OCR and dish extraction assistant. Analyze the provided restaurant menu image and extract one object per visible dish.

For each dish you can identify in the menu:
1. Extract the dish name exactly as written on the menu.
2. Write a short_description of about 50 words.
3. Focus on a practical food description, likely ingredients, style, and taste.
4. Do not invent prices, categories, or image URLs.

IMPORTANT: Your response MUST be a valid JSON array only, with no additional text. Do not include markdown code blocks.

Format your response as a JSON array like this:
[
  {
    "name": "Biryani",
    "short_description": "A fragrant rice dish made with long grain rice, whole spices, and marinated meat or vegetables. It is slow cooked so the flavors blend deeply, creating a rich, aromatic main course that feels hearty, layered, and satisfying in both texture and taste."
  }
]

If you cannot identify any dishes, return an empty array: []`;

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new BadRequestException(
          `Failed to fetch menu image. Received ${imageResponse.status} from image URL.`,
        );
      }

      const imageMimeType =
        imageResponse.headers.get('content-type') ?? 'image/jpeg';
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      const response = await model.generateContent([
        {
          inlineData: {
            mimeType: imageMimeType,
            data: imageBuffer.toString('base64'),
          },
        },
        prompt,
      ]);

      const responseText = this.extractResponseText(response.response);
      const dishes = this.parseDishArray(responseText);

      return dishes.map((dish) => ({
        name: dish.name.trim(),
        short_description: dish.short_description.trim(),
        image: null,
      }));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BadRequestException(
          'Failed to parse Gemini response. Invalid JSON format.',
        );
      }

      throw error;
    }
  }

  private extractResponseText(
    response: EnhancedGenerateContentResponse,
  ): string {
    try {
      const text = response.text().trim();
      if (text) {
        return text;
      }
    } catch {
      // Fall back to direct candidate parts when the helper cannot assemble text.
    }

    const text = (
      response.candidates?.[0]?.content?.parts
        ?.map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
        .join('\n') ?? ''
    ).trim();

    if (!text) {
      throw new BadRequestException(
        'Failed to analyze menu image. No response from Gemini.',
      );
    }

    return text;
  }

  private parseDishArray(responseText: string): DishDto[] {
    const sanitizedJson = this.extractJsonPayload(responseText);
    const parsed = JSON.parse(sanitizedJson) as unknown;

    const dishes = Array.isArray(parsed)
      ? parsed
      : this.hasDishesArray(parsed)
        ? parsed.dishes
        : null;

    if (!dishes) {
      throw new BadRequestException(
        'Gemini response was not in the expected format.',
      );
    }

    return dishes
      .filter((dish): dish is Record<string, unknown> => !!dish && typeof dish === 'object')
      .map((dish) => ({
        name: typeof dish.name === 'string' ? dish.name : '',
        short_description:
          typeof dish.short_description === 'string'
            ? dish.short_description
            : '',
        image: null,
      }))
      .filter(
        (dish) =>
          dish.name.trim().length > 0 &&
          dish.short_description.trim().length > 0,
      );
  }

  private extractJsonPayload(responseText: string): string {
    const trimmed = responseText.trim();
    if (!trimmed) {
      throw new BadRequestException(
        'Failed to analyze menu image. No response from Gemini.',
      );
    }

    const fencedJsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedJsonMatch?.[1]) {
      return fencedJsonMatch[1].trim();
    }

    const firstArrayBracket = trimmed.indexOf('[');
    const lastArrayBracket = trimmed.lastIndexOf(']');
    if (firstArrayBracket !== -1 && lastArrayBracket !== -1) {
      return trimmed.slice(firstArrayBracket, lastArrayBracket + 1);
    }

    const firstObjectBracket = trimmed.indexOf('{');
    const lastObjectBracket = trimmed.lastIndexOf('}');
    if (firstObjectBracket !== -1 && lastObjectBracket !== -1) {
      return trimmed.slice(firstObjectBracket, lastObjectBracket + 1);
    }

    return trimmed;
  }

  private hasDishesArray(
    value: unknown,
  ): value is { dishes: Record<string, unknown>[] } {
    return (
      !!value &&
      typeof value === 'object' &&
      'dishes' in value &&
      Array.isArray(value.dishes)
    );
  }

  private getClient(): GoogleGenerativeAI {
    console.log('now at getClient() for initializing Gemini API client with API key from environment variable');
    if (this.genAI) {
      return this.genAI;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured. Please add the GEMINI_API_KEY environment variable.',
      );
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    return this.genAI;
  }
}
