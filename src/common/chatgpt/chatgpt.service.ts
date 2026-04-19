import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DishDto } from '../../menu-scans/dto/dish-analysis.dto';
import {
  MENU_IMAGE_ANALYSIS_PROMPT,
  normalizeDishPayload,
} from '../ai/menu-image-analysis.util';

type OpenAIResponsesApiResponse = {
  error?: {
    message?: string;
  } | null;
  output_text?: string;
  output?: Array<{
    content?: Array<
      | {
          type?: string;
          text?: string;
        }
      | {
          type?: string;
          refusal?: string;
        }
    >;
  }>;
};

@Injectable()
export class ChatgptService {
  async analyzeMenuImage(imageUrl: string): Promise<DishDto[]> {
    console.log(
      'now at analyzeMenuImage() for analyzing menu scan image using ChatGPT Responses API to extract dish data',
    );
    console.log('Menu image URL to analyze:', imageUrl);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getApiKey()}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL ?? 'gpt-5.4-nano',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: MENU_IMAGE_ANALYSIS_PROMPT,
              },
              {
                type: 'input_image',
                image_url: imageUrl,
                detail: 'high',
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'menu_dishes',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                dishes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      name: {
                        type: 'string',
                      },
                      short_description: {
                        type: 'string',
                      },
                    },
                    required: ['name', 'short_description'],
                  },
                },
              },
              required: ['dishes'],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await this.readErrorBody(response);
      throw new BadRequestException(
        `ChatGPT image analysis failed. ${errorBody}`,
      );
    }

    const responseJson =
      (await response.json()) as OpenAIResponsesApiResponse;

    if (responseJson.error?.message) {
      throw new BadRequestException(responseJson.error.message);
    }

    const refusal = this.extractRefusal(responseJson);
    if (refusal) {
      throw new BadRequestException(
        `ChatGPT refused to analyze the menu image. ${refusal}`,
      );
    }

    const responseText = this.extractResponseText(responseJson);
    return normalizeDishPayload(JSON.parse(responseText));
  }

  private extractResponseText(response: OpenAIResponsesApiResponse): string {
    if (typeof response.output_text === 'string' && response.output_text.trim()) {
      return response.output_text.trim();
    }

    const text = (
      response.output
        ?.flatMap((item) => item.content ?? [])
        .map((part) =>
          'text' in part && typeof part.text === 'string' ? part.text : '',
        )
        .join('\n') ?? ''
    ).trim();

    if (!text) {
      throw new BadRequestException(
        'Failed to analyze menu image. No response from ChatGPT.',
      );
    }

    return text;
  }

  private extractRefusal(response: OpenAIResponsesApiResponse): string | null {
    const refusal = response.output
      ?.flatMap((item) => item.content ?? [])
      .find(
        (part) =>
          'refusal' in part &&
          typeof part.refusal === 'string' &&
          part.refusal.trim().length > 0,
      );

    if (refusal && 'refusal' in refusal && typeof refusal.refusal === 'string') {
      return refusal.refusal.trim();
    }

    return null;
  }

  private async readErrorBody(response: Response): Promise<string> {
    const responseText = await response.text();
    if (!responseText.trim()) {
      return `Received ${response.status} ${response.statusText} from OpenAI.`;
    }

    try {
      const parsed = JSON.parse(responseText) as {
        error?: { message?: string };
      };

      if (parsed.error?.message) {
        return parsed.error.message;
      }
    } catch {
      // Fall through and return the raw response text.
    }

    return responseText;
  }

  private getApiKey(): string {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY is not configured. Please add the OPENAI_API_KEY environment variable.',
      );
    }

    return apiKey;
  }
}
