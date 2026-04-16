import { Injectable, BadRequestException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DishDto } from '../../menu-scans/dto/dish-analysis.dto';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;

  async analyzeMenuImage(
    imageUrl: string,
  ): Promise<DishDto[]> {
    try {
      const model = this.getClient().getGenerativeModel({
        model: 'gemini-1.5-flash',
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

      const responseText =
        response.response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        throw new BadRequestException(
          'Failed to analyze menu image. No response from Gemini.',
        );
      }

      // Parse the JSON response
      const dishes = JSON.parse(responseText) as DishDto[];

      // Validate that we got an array of dishes
      if (!Array.isArray(dishes)) {
        throw new BadRequestException(
          'Gemini response was not in the expected format.',
        );
      }

      return dishes.map((dish) => ({
        name: dish.name,
        short_description: dish.short_description,
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
