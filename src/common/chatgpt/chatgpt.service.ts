import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { DishDto } from "../../menu-scans/dto/dish-analysis.dto";
import {
  buildItemComponentReportPrompt,
  buildItemIngredientReportPrompt,
  buildSingleItemComponentSectionPrompt,
  buildSingleItemIngredientSectionPrompt,
  buildDishDescriptionPrompt,
  ITEM_COMPONENT_REPORT_SECTION_NAMES,
  ITEM_INGREDIENT_REPORT_SECTION_NAMES,
  ItemComponentReportDto,
  ItemIngredientReportDto,
  MENU_DISH_NAME_EXTRACTION_PROMPT,
  NameDetailReportDto,
  normalizeItemComponentReportPayload,
  normalizeItemIngredientReportPayload,
  normalizeDishDescriptionPayload,
  normalizeDishNamePayload,
  orderNameDetailReportBySections,
} from "../ai/menu-image-analysis.util";

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
      "now at analyzeMenuImage() for analyzing menu scan image using ChatGPT Responses API to extract dish data",
    );
    console.log("Menu image URL to analyze:", imageUrl);
    console.log(
      "Using ChatGPT two-step flow: extract dish names, then generate descriptions",
    );

    const dishNames = await this.extractDishNames(imageUrl);
    const dishNamesLog =
      dishNames.length > 0 ? dishNames.join(", ") : "No dish names extracted";
    console.log(`[CHATGPT] Extracted dish names: ${dishNamesLog}`);

    return await this.generateDescriptions(dishNames);
  }

  async generateItemComponentReport(
    dishName: string,
  ): Promise<ItemComponentReportDto[]> {
    console.log(
      `[CHATGPT] Generating item component report for "${dishName}"`,
    );

    const components = await this.requestNameDetailReport(
      buildItemComponentReportPrompt(dishName),
      "item_component_report",
      "components",
      "component",
      "ChatGPT item component report generation failed.",
      normalizeItemComponentReportPayload,
    );

    return this.completeMissingNameDetailSections(
      dishName,
      components,
      ITEM_COMPONENT_REPORT_SECTION_NAMES,
      (sectionName) =>
        this.requestSingleComponentSection(dishName, sectionName),
      "component",
    );
  }

  async generateItemIngredientReport(
    dishName: string,
  ): Promise<ItemIngredientReportDto[]> {
    console.log(
      `[CHATGPT] Generating item ingredient report for "${dishName}"`,
    );

    const ingredients = await this.requestNameDetailReport(
      buildItemIngredientReportPrompt(dishName),
      "item_ingredient_report",
      "ingredients",
      "ingredient",
      "ChatGPT item ingredient report generation failed.",
      normalizeItemIngredientReportPayload,
    );

    return this.completeMissingNameDetailSections(
      dishName,
      ingredients,
      ITEM_INGREDIENT_REPORT_SECTION_NAMES,
      (sectionName) =>
        this.requestSingleIngredientSection(dishName, sectionName),
      "ingredient",
    );
  }

  private async requestSingleComponentSection(
    dishName: string,
    sectionName: string,
  ): Promise<ItemComponentReportDto> {
    const [component] = await this.requestNameDetailReport(
      buildSingleItemComponentSectionPrompt(dishName, sectionName),
      "single_item_component_section",
      "components",
      "component",
      "ChatGPT single component section generation failed.",
      normalizeItemComponentReportPayload,
    );

    return {
      name: sectionName,
      detail:
        component?.detail?.trim() ||
        `${sectionName} detail for ${dishName} could not be generated.`,
    };
  }

  private async requestSingleIngredientSection(
    dishName: string,
    sectionName: string,
  ): Promise<ItemIngredientReportDto> {
    const [ingredient] = await this.requestNameDetailReport(
      buildSingleItemIngredientSectionPrompt(dishName, sectionName),
      "single_item_ingredient_section",
      "ingredients",
      "ingredient",
      "ChatGPT single ingredient section generation failed.",
      normalizeItemIngredientReportPayload,
    );

    return {
      name: sectionName,
      detail:
        ingredient?.detail?.trim() ||
        `${sectionName} detail for ${dishName} could not be generated.`,
    };
  }

  private async requestNameDetailReport<T extends NameDetailReportDto>(
    prompt: string,
    schemaName: string,
    collectionKey: "components" | "ingredients",
    reportLabel: string,
    errorPrefix: string,
    normalizePayload: (parsed: unknown) => T[],
  ): Promise<T[]> {
    console.log(`[CHATGPT] Sending POST request to https://api.openai.com/v1/responses`);
    console.log(`[CHATGPT] Model: ${this.getModelName()}`);
    console.log(`[CHATGPT] prompt:`, prompt);

    const startTime = Date.now();
    const responseJson = await this.createResponse(
      {
        model: this.getModelName(),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                [collectionKey]: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: {
                        type: "string",
                      },
                      detail: {
                        type: "string",
                      },
                    },
                    required: ["name", "detail"],
                  },
                },
              },
              required: [collectionKey],
            },
          },
        },
      },
      errorPrefix,
    );

    const responseTime = Date.now() - startTime;
    console.log(`[CHATGPT] Response received in ${responseTime}ms`);

    const responseText = this.extractResponseText(responseJson);
    console.log(
      `[CHATGPT] Raw ${reportLabel} report response first 300 chars: ${responseText.substring(0, 300)}`,
    );

    const parsed = JSON.parse(responseText) as unknown;
    console.log(`[CHATGPT] Parsed ${reportLabel} report JSON successfully.`);

    return normalizePayload(parsed);
  }

  private async completeMissingNameDetailSections<T extends NameDetailReportDto>(
    dishName: string,
    items: T[],
    sectionNames: readonly string[],
    requestSingleSection: (sectionName: string) => Promise<T>,
    reportLabel: string,
  ): Promise<T[]> {
    const { orderedItems, missingSections } =
      orderNameDetailReportBySections(items, sectionNames);

    if (missingSections.length === 0) {
      return orderedItems;
    }

    console.warn(
      `[CHATGPT] Missing ${reportLabel} sections for "${dishName}": ${missingSections.join(", ")}. Requesting them one by one...`,
    );

    const completedItemsByName = new Map(
      orderedItems.map((item) => [item.name, item]),
    );

    for (const sectionName of missingSections) {
      const sectionItem = await requestSingleSection(sectionName);
      completedItemsByName.set(sectionName, sectionItem);
    }

    return sectionNames.map((sectionName) => completedItemsByName.get(sectionName)!);
  }

  private async extractDishNames(imageUrl: string): Promise<string[]> {
    console.log(`[CHATGPT] ========== STEP 1: EXTRACT DISH NAMES ==========`);

    const responseJson = await this.createResponse(
      {
        model: this.getModelName(),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: MENU_DISH_NAME_EXTRACTION_PROMPT,
              },
              {
                type: "input_image",
                image_url: imageUrl,
                detail: "high",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "menu_dish_names",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                dishes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: {
                        type: "string",
                      },
                    },
                    required: ["name"],
                  },
                },
              },
              required: ["dishes"],
            },
          },
        },
      },
      "ChatGPT dish name extraction failed.",
    );

    const responseText = this.extractResponseText(responseJson);
    const dishNames = normalizeDishNamePayload(JSON.parse(responseText));

    console.log(`[CHATGPT] ========== STEP 1: COMPLETE ==========\n`);

    return dishNames;
  }

  private async generateDescriptions(dishNames: string[]): Promise<DishDto[]> {
    console.log(
      `[CHATGPT] ========== STEP 2: GENERATE DESCRIPTIONS ==========`,
    );
    console.log(`[CHATGPT] Dish names to process:`, dishNames);

    if (dishNames.length === 0) {
      console.log(
        `[CHATGPT] No dish names provided. Skipping description generation.`,
      );
      return [];
    }

    const batchSize = 10;
    const batches = this.chunkArray(dishNames, batchSize);
    const dishes: DishDto[] = [];

    for (const batch of batches) {
      const batchResult = await this.requestDescriptionBatch(batch);
      dishes.push(...batchResult.dishes);

      for (const missingName of batchResult.missingNames) {
        console.warn(
          `[CHATGPT] Missing description for "${missingName}" in batch response. Retrying individually...`,
        );

        const retryResult = await this.requestDescriptionBatch([missingName]);
        if (retryResult.dishes.length > 0) {
          dishes.push(retryResult.dishes[0]);
        } else {
          dishes.push(this.createFallbackDish(missingName));
        }
      }
    }

    console.log(`[CHATGPT] ========== STEP 2: COMPLETE ==========\n`);

    return dishes;
  }

  private async requestDescriptionBatch(dishNames: string[]) {
    const responseJson = await this.createResponse(
      {
        model: this.getModelName(),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildDishDescriptionPrompt(dishNames),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "menu_dish_descriptions",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                dishes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: {
                        type: "string",
                      },
                      short_description: {
                        type: "string",
                      },
                    },
                    required: ["name", "short_description"],
                  },
                },
              },
              required: ["dishes"],
            },
          },
        },
      },
      "ChatGPT description generation failed.",
    );

    const responseText = this.extractResponseText(responseJson);
    const parsed = JSON.parse(responseText) as unknown;

    return normalizeDishDescriptionPayload(parsed, dishNames);
  }

  private async createResponse(
    payload: Record<string, unknown>,
    errorPrefix: string,
  ): Promise<OpenAIResponsesApiResponse> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.getApiKey()}`,
      },
      body: JSON.stringify(payload),
    });
    console.log(
      `[CHATGPT] Response Status: ${response.status} ${response.statusText}`,
    );

    if (!response.ok) {
      const errorBody = await this.readErrorBody(response);
      throw new BadRequestException(`${errorPrefix} ${errorBody}`);
    }

    const responseJson = (await response.json()) as OpenAIResponsesApiResponse;

    if (responseJson.error?.message) {
      throw new BadRequestException(responseJson.error.message);
    }

    const refusal = this.extractRefusal(responseJson);
    if (refusal) {
      throw new BadRequestException(
        `ChatGPT refused to analyze the menu image. ${refusal}`,
      );
    }

    return responseJson;
  }

  private extractResponseText(response: OpenAIResponsesApiResponse): string {
    if (
      typeof response.output_text === "string" &&
      response.output_text.trim()
    ) {
      return response.output_text.trim();
    }

    const text = (
      response.output
        ?.flatMap((item) => item.content ?? [])
        .map((part) =>
          "text" in part && typeof part.text === "string" ? part.text : "",
        )
        .join("\n") ?? ""
    ).trim();

    if (!text) {
      throw new BadRequestException(
        "Failed to analyze menu image. No response from ChatGPT.",
      );
    }

    return text;
  }

  private extractRefusal(response: OpenAIResponsesApiResponse): string | null {
    const refusal = response.output
      ?.flatMap((item) => item.content ?? [])
      .find(
        (part) =>
          "refusal" in part &&
          typeof part.refusal === "string" &&
          part.refusal.trim().length > 0,
      );

    if (
      refusal &&
      "refusal" in refusal &&
      typeof refusal.refusal === "string"
    ) {
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
        "OPENAI_API_KEY is not configured. Please add the OPENAI_API_KEY environment variable.",
      );
    }

    return apiKey;
  }

  private getModelName(): string {
    return process.env.OPENAI_VISION_MODEL ?? "gpt-5.4-nano";
  }

  private createFallbackDish(name: string): DishDto {
    return {
      name,
      short_description: `${name} is a restaurant dish prepared in a familiar style, with flavors and textures suited for a satisfying meal or snack.`,
      image: null,
    };
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }

    return chunks;
  }
}
