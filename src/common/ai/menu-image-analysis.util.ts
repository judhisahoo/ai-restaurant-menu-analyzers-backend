import { BadRequestException } from '@nestjs/common';
import { DishDto } from '../../menu-scans/dto/dish-analysis.dto';

export const MENU_IMAGE_ANALYSIS_PROMPT = `You are an AI assistant specialized Restaurant Menu OCR, Culinary Analysis Assistant and structured dish extractor. Analyze the provided restaurant menu image and extract one object per visible dish.

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

export function parseDishArray(responseText: string): DishDto[] {
  const sanitizedJson = extractJsonPayload(responseText);
  const parsed = JSON.parse(sanitizedJson) as unknown;
  return normalizeDishPayload(parsed);
}

export function normalizeDishPayload(parsed: unknown): DishDto[] {
  const dishes = Array.isArray(parsed)
    ? parsed
    : hasDishesArray(parsed)
      ? parsed.dishes
      : null;

  if (!dishes) {
    throw new BadRequestException(
      'AI response was not in the expected dish array format.',
    );
  }

  return dishes
    .filter(
      (dish): dish is Record<string, unknown> =>
        !!dish && typeof dish === 'object',
    )
    .map((dish) => ({
      name: typeof dish.name === 'string' ? dish.name.trim() : '',
      short_description:
        typeof dish.short_description === 'string'
          ? dish.short_description.trim()
          : '',
      image: null,
    }))
    .filter(
      (dish) =>
        dish.name.length > 0 && dish.short_description.length > 0,
    );
}

function extractJsonPayload(responseText: string): string {
  const trimmed = responseText.trim();
  if (!trimmed) {
    throw new BadRequestException('Failed to analyze menu image. No AI response.');
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

function hasDishesArray(
  value: unknown,
): value is { dishes: Record<string, unknown>[] } {
  return (
    !!value &&
    typeof value === 'object' &&
    'dishes' in value &&
    Array.isArray(value.dishes)
  );
}
