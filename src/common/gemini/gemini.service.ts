import { Injectable, BadRequestException } from '@nestjs/common';
import {
  GoogleGenerativeAI,
  SchemaType,
  type EnhancedGenerateContentResponse,
  type ResponseSchema,
} from '@google/generative-ai';
import { DishDto } from '../../menu-scans/dto/dish-analysis.dto';
import {
  MENU_IMAGE_ANALYSIS_PROMPT,
  parseDishArray,
} from '../ai/menu-image-analysis.util';

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
        model: 'gemini-2.0-flash-lite',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: this.dishResponseSchema,
          temperature: 0.2,
        },
      });

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
        MENU_IMAGE_ANALYSIS_PROMPT,
      ]);

      const responseText = this.extractResponseText(response.response);
      const dishes = parseDishArray(responseText);

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
