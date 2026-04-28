import { Injectable, BadRequestException } from "@nestjs/common";
import {
  GoogleGenerativeAI,
  SchemaType,
  type EnhancedGenerateContentResponse,
  type ResponseSchema,
} from "@google/generative-ai";
import { DishDto } from "../../menu-scans/dto/dish-analysis.dto";
import {
  buildItemComponentReportPrompt,
  buildItemIngredientReportPrompt,
  buildSingleItemComponentSectionPrompt,
  buildSingleItemIngredientSectionPrompt,
  buildMissingDishNameReviewPrompt,
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
  orderNameDetailReportBySections,
  parseDishNameArray,
} from "../ai/menu-image-analysis.util";

type GeminiImagePart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private readonly dishNameResponseSchema: ResponseSchema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
        },
      },
      required: ["name"],
    },
  };

  private readonly dishDescriptionResponseSchema: ResponseSchema = {
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
      required: ["name", "short_description"],
    },
  };

  private readonly itemComponentReportResponseSchema: ResponseSchema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
        },
        detail: {
          type: SchemaType.STRING,
        },
      },
      required: ["name", "detail"],
    },
  };

  async analyzeMenuImage(imageUrl: string): Promise<DishDto[]> {
    try {
      console.log(
        "now at analyzeMenuImage() for analyzing menu scan image using Gemini API to extract dish data",
      );
      console.log("Menu image URL to analyze:", imageUrl);
      console.log(
        "Using Gemini two-step flow: extract dish names, then generate descriptions",
      );

      const imagePart = await this.fetchImagePart(imageUrl);
      const dishNames = await this.extractDishNames(imagePart);
      const dishNamesLog =
        dishNames.length > 0 ? dishNames.join(", ") : "No dish names extracted";
      console.log(`[GEMINI] Extracted dish names: ${dishNamesLog}`);

      return await this.generateDescriptions(dishNames);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new BadRequestException(
          "Failed to parse Gemini response. Invalid JSON format.",
        );
      }

      throw error;
    }
  }

  async generateItemComponentReport(
    dishName: string,
  ): Promise<ItemComponentReportDto[]> {
    console.log(
      `[GEMINI] Generating item component report for "${dishName}"`,
    );

    const components = await this.requestNameDetailReport(
      buildItemComponentReportPrompt(dishName),
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
      `[GEMINI] Generating item ingredient report for "${dishName}"`,
    );

    const ingredients = await this.requestNameDetailReport(
      buildItemIngredientReportPrompt(dishName),
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
    normalizePayload: (parsed: unknown) => T[],
  ): Promise<T[]> {
    console.log(`[GEMINI] Sending request to Gemini generateContent`);
    console.log(`[GEMINI] Model: gemini-2.0-flash-lite`);
    console.log(`[GEMINI] prompt:`, prompt);

    const model = this.getClient().getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: this.itemComponentReportResponseSchema,
        temperature: 0.2,
      },
    });

    const startTime = Date.now();
    const response = await model.generateContent([prompt]);
    const responseTime = Date.now() - startTime;
    console.log(`[GEMINI] Response received in ${responseTime}ms`);

    const responseText = this.extractResponseText(response.response);
    console.log(
      `[GEMINI] Raw name/detail report response first 300 chars: ${responseText.substring(0, 300)}`,
    );

    const parsed = JSON.parse(responseText) as unknown;
    console.log(`[GEMINI] Parsed name/detail report JSON successfully.`);

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
      `[GEMINI] Missing ${reportLabel} sections for "${dishName}": ${missingSections.join(", ")}. Requesting them one by one...`,
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

  private async extractDishNames(
    imagePart: GeminiImagePart,
  ): Promise<string[]> {
    console.log(`[GEMINI] ========== STEP 1: EXTRACT DISH NAMES ==========`);

    let dishNames = await this.requestDishNamesFromImagePart(
      imagePart,
      MENU_DISH_NAME_EXTRACTION_PROMPT,
    );

    if (dishNames.length === 0) {
      console.warn(
        `[GEMINI] Dish name extraction returned an empty array. Retrying with stricter OCR instructions...`,
      );

      dishNames = await this.requestDishNamesFromImagePart(
        imagePart,
        `${MENU_DISH_NAME_EXTRACTION_PROMPT}

IMPORTANT:
The previous response was an empty array.
Look again at the image text and return every readable unique food item name.
Return [] only if there are truly no readable food item names in the image.`,
      );
    }

    const missingDishNames = await this.requestMissingDishNamesFromImagePart(
      imagePart,
      dishNames,
    );

    if (missingDishNames.length > 0) {
      console.log(
        `[GEMINI] Additional dish names found on review: ${missingDishNames.join(", ")}`,
      );
      dishNames = this.uniqueDishNames([...dishNames, ...missingDishNames]);
    }

    console.log(`[GEMINI] ========== STEP 1: COMPLETE ==========\n`);

    return dishNames;
  }

  private async requestDishNamesFromImagePart(
    imagePart: GeminiImagePart,
    prompt: string,
  ): Promise<string[]> {
    const model = this.getClient().getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: this.dishNameResponseSchema,
        temperature: 0.2,
      },
    });

    const response = await model.generateContent([
      imagePart,
      prompt,
    ]);

    const responseText = this.extractResponseText(response.response);
    const dishNames = this.uniqueDishNames(parseDishNameArray(responseText));

    return dishNames;
  }

  private async requestMissingDishNamesFromImagePart(
    imagePart: GeminiImagePart,
    existingDishNames: string[],
  ): Promise<string[]> {
    if (existingDishNames.length === 0) {
      return [];
    }

    try {
      return await this.requestDishNamesFromImagePart(
        imagePart,
        buildMissingDishNameReviewPrompt(existingDishNames),
      );
    } catch (error) {
      console.warn(
        `[GEMINI] Missing dish review failed. Continuing with first-pass dish names. Error: ${this.getErrorMessage(error)}`,
      );
      return [];
    }
  }

  private async generateDescriptions(dishNames: string[]): Promise<DishDto[]> {
    console.log(`[GEMINI] ========== STEP 2: GENERATE DESCRIPTIONS ==========`);
    console.log(`[GEMINI] Dish names to process:`, dishNames);

    if (dishNames.length === 0) {
      console.log(
        `[GEMINI] No dish names provided. Skipping description generation.`,
      );
      return [];
    }

    const batchSize = 10;
    const batches = this.chunkArray(dishNames, batchSize);
    const dishes: DishDto[] = [];

    for (const batch of batches) {
      let batchResult;

      try {
        batchResult = await this.requestDescriptionBatchWithRetry(batch);
      } catch (error) {
        console.warn(
          `[GEMINI] Description batch failed for ${batch.join(", ")}. Retrying items one by one... Error: ${this.getErrorMessage(error)}`,
        );

        for (const batchName of batch) {
          dishes.push(await this.requestSingleDescriptionOrFallback(batchName));
        }

        continue;
      }

      dishes.push(...batchResult.dishes);

      for (const missingName of batchResult.missingNames) {
        console.warn(
          `[GEMINI] Missing description for "${missingName}" in batch response. Retrying individually...`,
        );

        dishes.push(await this.requestSingleDescriptionOrFallback(missingName));
      }
    }

    console.log(`[GEMINI] ========== STEP 2: COMPLETE ==========\n`);

    return dishes;
  }

  private async requestDescriptionBatchWithRetry(
    dishNames: string[],
  ): Promise<ReturnType<typeof normalizeDishDescriptionPayload>> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await this.requestDescriptionBatch(dishNames);
      } catch (error) {
        lastError = error;
        console.warn(
          `[GEMINI] Description batch attempt ${attempt}/2 failed for ${dishNames.join(", ")}. Error: ${this.getErrorMessage(error)}`,
        );

        if (attempt < 2) {
          await this.delay(1000);
        }
      }
    }

    throw lastError;
  }

  private async requestSingleDescriptionOrFallback(
    dishName: string,
  ): Promise<DishDto> {
    try {
      const retryResult = await this.requestDescriptionBatchWithRetry([
        dishName,
      ]);

      if (retryResult.dishes.length > 0) {
        return retryResult.dishes[0];
      }

      console.warn(
        `[GEMINI] Could not generate AI description for "${dishName}". Using fallback description.`,
      );
    } catch (error) {
      console.warn(
        `[GEMINI] Description retry failed for "${dishName}". Using fallback description. Error: ${this.getErrorMessage(error)}`,
      );
    }

    return this.createFallbackDish(dishName);
  }

  private async requestDescriptionBatch(dishNames: string[]) {
    const model = this.getClient().getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: this.dishDescriptionResponseSchema,
        temperature: 0.2,
      },
    });

    const response = await model.generateContent([
      buildDishDescriptionPrompt(dishNames),
    ]);

    const responseText = this.extractResponseText(response.response);
    const parsed = JSON.parse(responseText) as unknown;

    return normalizeDishDescriptionPayload(parsed, dishNames);
  }

  private async fetchImagePart(imageUrl: string): Promise<GeminiImagePart> {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new BadRequestException(
        `Failed to fetch menu image. Received ${imageResponse.status} from image URL.`,
      );
    }

    const imageMimeType =
      imageResponse.headers.get("content-type") ?? "image/jpeg";
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    return {
      inlineData: {
        mimeType: imageMimeType,
        data: imageBuffer.toString("base64"),
      },
    };
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
        ?.map((part) =>
          "text" in part && typeof part.text === "string" ? part.text : "",
        )
        .join("\n") ?? ""
    ).trim();

    if (!text) {
      throw new BadRequestException(
        "Failed to analyze menu image. No response from Gemini.",
      );
    }

    return text;
  }

  private getClient(): GoogleGenerativeAI {
    console.log(
      "now at getClient() for initializing Gemini API client with API key from environment variable",
    );
    if (this.genAI) {
      return this.genAI;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured. Please add the GEMINI_API_KEY environment variable.",
      );
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    return this.genAI;
  }

  private createFallbackDish(name: string): DishDto {
    return {
      name,
      short_description: `${name} is a restaurant dish prepared in a familiar style, with flavors and textures suited for a satisfying meal or snack.`,
      image: null,
    };
  }

  private uniqueDishNames(dishNames: string[]): string[] {
    const seenNames = new Set<string>();
    const uniqueNames: string[] = [];

    for (const dishName of dishNames) {
      const nameKey = dishName.trim().toLowerCase();

      if (!nameKey || seenNames.has(nameKey)) {
        continue;
      }

      seenNames.add(nameKey);
      uniqueNames.push(dishName.trim());
    }

    return uniqueNames;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }

    return chunks;
  }
}
