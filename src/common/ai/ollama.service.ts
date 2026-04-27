import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DishDto } from "../../menu-scans/dto/dish-analysis.dto";
import {
  buildItemComponentReportPrompt,
  buildItemIngredientReportPrompt,
  ITEM_COMPONENT_REPORT_SECTION_NAMES,
  ITEM_INGREDIENT_REPORT_SECTION_NAMES,
  ItemComponentReportDto,
  ItemIngredientReportDto,
  normalizeItemComponentReportPayload,
  normalizeItemIngredientReportPayload,
} from "./menu-image-analysis.util";

type DescriptionBatchResult = {
  dishes: DishDto[];
  missingNames: string[];
};

@Injectable()
export class OllamaService {
  constructor(private readonly configService: ConfigService) { }
  private getModelName(): string {
    return this.configService.get<string>("LOCAL_MODEL_NAME", "gemma3:4b");
  }

  private getOllamaBaseURL(): string {
    return this.configService.get<string>("OLLAMA_BASE_URL", "http://192.168.1.118:11434");
  }

  async analyzeMenuImage(imageUrl: string): Promise<DishDto[]> {
    // Step 1: Extract dish names
    const dishNames = await this.extractDishNames(imageUrl);
    /* const dishNames = [
      { name: "Masala Dose" },
      { name: "Set Dose" },
      { name: "Rava Dose" },
      { name: "Plain Dose" },
      { name: "Butter Dose" },
      { name: "Cheese Dose" },
      { name: "Onion Dose" },
      { name: "Tikka Dose" },
      { name: "Paneer Dose" },
      { name: "Pista Dose" },
      { name: "Veg Dose" },
      { name: "Tomato Dose" },
      { name: "Mushroom Dose" },
      { name: "American Dose" },
      { name: "Spring Dose" },
      { name: "Spring Onion Dose" },
      { name: "Paneer Pepper Dose" },
      { name: "Rava Pepper Dose" },
      { name: "Cheese Pepper Dose" },
      { name: "Onion Pepper Dose" },
      { name: "Veg Pepper Dose" },
      { name: "Tomato Pepper Dose" },
      { name: "Ginger Dose" },
      { name: "Special Dose" },
      { name: "Badam Dose" },
      { name: "Chilli Dose" },
      { name: "Lemon Dose" },
      { name: "Plain Idly" },
      { name: "Rava Idly" },
      { name: "Cheese Idly" },
      { name: "Onion Idly" },
      { name: "Tomato Idly" },
      { name: "Mushroom Idly" },
      { name: "Veg Idly" },
      { name: "Tomato Uttapam" },
      { name: "Plain Uttapam" },
      { name: "Cheese Uttapam" },
      { name: "Onion Uttapam" },
      { name: "Veg Uttapam" },
      { name: "Tomato Dosa" },
      { name: "Plain Uttapa" },
      { name: "Tomato Uttapa" },
      { name: "Veg Uttapa" },
      { name: "Tomato" },
    ].map((item) => item.name);*/
    const dishNamesLog =
      dishNames.length > 0 ? dishNames.join(", ") : "No dish names extracted";
    console.log(`[OLLAMA] Extracted dish names: ${dishNamesLog}`);

    // Step 2: Generate descriptions
    const dishes = await this.generateDescriptions(dishNames);

    return dishes;
    // For now, return dish names as DishDto with placeholder values
    /*return dishNames.map(name => ({
      name,
      short_description: '',
      image: null,
    }));*/
  }

  async generateItemComponentReport(
    dishName: string,
  ): Promise<ItemComponentReportDto[]> {
    return this.extractItemComponentDetailsFromAiModel(dishName);
  }

  async generateItemIngredientReport(
    dishName: string,
  ): Promise<ItemIngredientReportDto[]> {
    return this.extractItemIngredientDetailsFromAiModel(dishName);
  }

  private async extractItemComponentDetailsFromAiModel(
    dishName: string,
  ): Promise<ItemComponentReportDto[]> {
    const ollamaUrl = this.getOllamaBaseURL();

    console.log(`[OLLAMA] ========== GENERATE ITEM COMPONENT REPORT ==========`);
    console.log(`[OLLAMA] Dish name to process: ${dishName}`);

    try {
      const prompt = buildItemComponentReportPrompt(dishName);
      const components = await this.requestItemComponentReportFromOllama(
        ollamaUrl,
        prompt,
      );

      if (components.length >= ITEM_COMPONENT_REPORT_SECTION_NAMES.length) {
        console.log(`[OLLAMA] ========== ITEM COMPONENT REPORT COMPLETE ==========\n`);
        return components;
      }

      console.warn(
        `[OLLAMA] Component report returned ${components.length} item(s). Retrying with stricter instructions...`,
      );

      const retryPrompt = `${prompt}

IMPORTANT:
Your previous response returned too few objects.
Return exactly ${ITEM_COMPONENT_REPORT_SECTION_NAMES.length} objects, no more and no less.
Use exactly these "name" values in this order:
${ITEM_COMPONENT_REPORT_SECTION_NAMES.map(
  (sectionName, index) => `${index + 1}. ${sectionName}`,
).join("\n")}
The response must be a JSON array only.`;

      const retryComponents = await this.requestItemComponentReportFromOllama(
        ollamaUrl,
        retryPrompt,
      );

      const completedComponents = await this.completeMissingItemComponentSections(
        dishName,
        ollamaUrl,
        retryComponents,
      );

      console.log(`[OLLAMA] ========== ITEM COMPONENT REPORT COMPLETE ==========\n`);

      return completedComponents;
    } catch (error) {
      console.error(`[OLLAMA] ERROR in generateItemComponentReport:`, error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Unable to generate item component report with Ollama service at ${ollamaUrl}. Error: ${errorMessage}`,
      );
    }
  }

  private async completeMissingItemComponentSections(
    dishName: string,
    ollamaUrl: string,
    components: ItemComponentReportDto[],
  ): Promise<ItemComponentReportDto[]> {
    const componentsBySection = new Map<string, ItemComponentReportDto>();

    for (const component of components) {
      const matchingSection = this.findMatchingComponentSection(component.name);
      if (!matchingSection) {
        continue;
      }

      componentsBySection.set(matchingSection, {
        name: matchingSection,
        detail: component.detail,
      });
    }

    const missingSections = ITEM_COMPONENT_REPORT_SECTION_NAMES.filter(
      (sectionName) => !componentsBySection.has(sectionName),
    );

    if (missingSections.length === 0) {
      return ITEM_COMPONENT_REPORT_SECTION_NAMES.map(
        (sectionName) => componentsBySection.get(sectionName)!,
      );
    }

    console.warn(
      `[OLLAMA] Missing component sections: ${missingSections.join(", ")}. Requesting them one by one...`,
    );

    for (const sectionName of missingSections) {
      const sectionComponent = await this.requestSingleItemComponentSectionFromOllama(
        dishName,
        ollamaUrl,
        sectionName,
      );

      componentsBySection.set(sectionName, sectionComponent);
    }

    return ITEM_COMPONENT_REPORT_SECTION_NAMES.map(
      (sectionName) => componentsBySection.get(sectionName)!,
    );
  }

  private async requestSingleItemComponentSectionFromOllama(
    dishName: string,
    ollamaUrl: string,
    sectionName: string,
  ): Promise<ItemComponentReportDto> {
    const prompt = `Act as a culinary consultant.

Task:
For the dish in the Input section, write only the "${sectionName}" component detail.

Rules:
- Return a valid JSON array with exactly one object.
- Required keys: "name", "detail".
- The "name" value must be exactly "${sectionName}".
- The "detail" value must be practical, food-focused, and not more than 25 words.
- Response must start with [ and end with ].
- Do not include markdown, code blocks, or extra text.

Example output:
[
{"name":"${sectionName}","detail":"One concise practical detail for this section."}
]

Input:
${dishName};`;

    const [component] = await this.requestItemComponentReportFromOllama(
      ollamaUrl,
      prompt,
    );

    return {
      name: sectionName,
      detail:
        component?.detail?.trim() ||
        `${sectionName} detail for ${dishName} could not be generated.`,
    };
  }

  private findMatchingComponentSection(componentName: string): string | null {
    const normalizedComponentName = componentName.trim().toLowerCase();

    return (
      ITEM_COMPONENT_REPORT_SECTION_NAMES.find(
        (sectionName) =>
          sectionName.trim().toLowerCase() === normalizedComponentName,
      ) ?? null
    );
  }

  private async extractItemIngredientDetailsFromAiModel(
    dishName: string,
  ): Promise<ItemIngredientReportDto[]> {
    const ollamaUrl = this.getOllamaBaseURL();

    console.log(`[OLLAMA] ========== GENERATE ITEM INGREDIENT REPORT ==========`);
    console.log(`[OLLAMA] Dish name to process: ${dishName}`);

    try {
      const prompt = buildItemIngredientReportPrompt(dishName);
      const ingredients = await this.requestItemIngredientReportFromOllama(
        ollamaUrl,
        prompt,
      );

      if (ingredients.length >= ITEM_INGREDIENT_REPORT_SECTION_NAMES.length) {
        console.log(`[OLLAMA] ========== ITEM INGREDIENT REPORT COMPLETE ==========\n`);
        return ingredients;
      }

      console.warn(
        `[OLLAMA] Ingredient report returned ${ingredients.length} item(s). Retrying with stricter instructions...`,
      );

      const retryPrompt = `${prompt}

IMPORTANT:
Your previous response returned too few objects.
Return exactly ${ITEM_INGREDIENT_REPORT_SECTION_NAMES.length} objects, no more and no less.
Use exactly these "name" values in this order:
${ITEM_INGREDIENT_REPORT_SECTION_NAMES.map(
  (sectionName, index) => `${index + 1}. ${sectionName}`,
).join("\n")}
The response must be a JSON array only.`;

      const retryIngredients = await this.requestItemIngredientReportFromOllama(
        ollamaUrl,
        retryPrompt,
      );

      const completedIngredients = await this.completeMissingItemIngredientSections(
        dishName,
        ollamaUrl,
        retryIngredients,
      );

      console.log(`[OLLAMA] ========== ITEM INGREDIENT REPORT COMPLETE ==========\n`);

      return completedIngredients;
    } catch (error) {
      console.error(`[OLLAMA] ERROR in generateItemIngredientReport:`, error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Unable to generate item ingredient report with Ollama service at ${ollamaUrl}. Error: ${errorMessage}`,
      );
    }
  }

  private async completeMissingItemIngredientSections(
    dishName: string,
    ollamaUrl: string,
    ingredients: ItemIngredientReportDto[],
  ): Promise<ItemIngredientReportDto[]> {
    const ingredientsBySection = new Map<string, ItemIngredientReportDto>();

    for (const ingredient of ingredients) {
      const matchingSection = this.findMatchingIngredientSection(
        ingredient.name,
      );
      if (!matchingSection) {
        continue;
      }

      ingredientsBySection.set(matchingSection, {
        name: matchingSection,
        detail: ingredient.detail,
      });
    }

    const missingSections = ITEM_INGREDIENT_REPORT_SECTION_NAMES.filter(
      (sectionName) => !ingredientsBySection.has(sectionName),
    );

    if (missingSections.length === 0) {
      return ITEM_INGREDIENT_REPORT_SECTION_NAMES.map(
        (sectionName) => ingredientsBySection.get(sectionName)!,
      );
    }

    console.warn(
      `[OLLAMA] Missing ingredient sections: ${missingSections.join(", ")}. Requesting them one by one...`,
    );

    for (const sectionName of missingSections) {
      const sectionIngredient = await this.requestSingleItemIngredientSectionFromOllama(
        dishName,
        ollamaUrl,
        sectionName,
      );

      ingredientsBySection.set(sectionName, sectionIngredient);
    }

    return ITEM_INGREDIENT_REPORT_SECTION_NAMES.map(
      (sectionName) => ingredientsBySection.get(sectionName)!,
    );
  }

  private async requestSingleItemIngredientSectionFromOllama(
    dishName: string,
    ollamaUrl: string,
    sectionName: string,
  ): Promise<ItemIngredientReportDto> {
    const prompt = `You are a culinary consultant.

Task:
For the dish in the Input section, write only the "${sectionName}" ingredient detail.

Rules:
- Return a valid JSON array with exactly one object.
- Required keys: "name", "detail".
- The "name" value must be exactly "${sectionName}".
- Keep "detail" concise, comma-separated, practical, and food-focused.
- No extra text or markdown.
- Response must start with [ and end with ].

Example output:
[
{"name":"${sectionName}","detail":"One concise comma-separated detail for this section."}
]

Input:
${dishName}`;

    const [ingredient] = await this.requestItemIngredientReportFromOllama(
      ollamaUrl,
      prompt,
    );

    return {
      name: sectionName,
      detail:
        ingredient?.detail?.trim() ||
        `${sectionName} detail for ${dishName} could not be generated.`,
    };
  }

  private findMatchingIngredientSection(ingredientName: string): string | null {
    const normalizedIngredientName = ingredientName.trim().toLowerCase();

    return (
      ITEM_INGREDIENT_REPORT_SECTION_NAMES.find(
        (sectionName) =>
          sectionName.trim().toLowerCase() === normalizedIngredientName,
      ) ?? null
    );
  }

  private async requestItemIngredientReportFromOllama(
    ollamaUrl: string,
    prompt: string,
  ): Promise<ItemIngredientReportDto[]> {
    return this.requestNameDetailReportFromOllama(
      ollamaUrl,
      prompt,
      "ingredient",
      normalizeItemIngredientReportPayload,
    );
  }

  private async requestItemComponentReportFromOllama(
    ollamaUrl: string,
    prompt: string,
  ): Promise<ItemComponentReportDto[]> {
    return this.requestNameDetailReportFromOllama(
      ollamaUrl,
      prompt,
      "component",
      normalizeItemComponentReportPayload,
    );
  }

  private async requestNameDetailReportFromOllama<T extends { name: string; detail: string }>(
    ollamaUrl: string,
    prompt: string,
    reportLabel: string,
    normalizePayload: (parsed: unknown) => T[],
  ): Promise<T[]> {
    console.log(`[OLLAMA] Sending POST request to ${ollamaUrl}/api/generate`);
    console.log(`[OLLAMA] prompt:`, prompt);

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[OLLAMA] Request timeout after 600 seconds, aborting...`);
      controller.abort();
    }, 600000);

    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.getModelName(),
          prompt,
          stream: true,
          format: "json",
          options: {
            temperature: 0.1,
            num_predict: 1200,
          },
        }),
        signal: controller.signal,
      });

      const responseTime = Date.now() - startTime;
      console.log(`[OLLAMA] Response headers received in ${responseTime}ms`);
      console.log(
        `[OLLAMA] Response Status: ${response.status} ${response.statusText}`,
      );

      if (!response.ok) {
        throw new InternalServerErrorException(
          `Ollama service at ${ollamaUrl} returned an error: ${response.status} ${response.statusText}. Please ensure the Ollama server is running and the model '${this.getModelName()}' is available.`,
        );
      }

      const rawText = await this.readOllamaStreamResponse(response);
      console.log(
        `[OLLAMA] Raw ${reportLabel} report response first 300 chars: ${rawText.substring(0, 300)}`,
      );

      const parsed = this.parseOllamaJsonResponse(rawText);

      return normalizePayload(parsed);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async extractDishNames(imageUrl: string): Promise<string[]> {
    const ollamaUrl = this.getOllamaBaseURL();

    console.log(`[OLLAMA] ========== STEP 1: EXTRACT DISH NAMES ==========`);
    console.log(`[OLLAMA] Ollama Server URL: ${ollamaUrl}`);
    console.log(`[OLLAMA] Image URL: ${imageUrl}`);
    console.log(`[OLLAMA] Model: ${this.getModelName()}`);

    const prompt = `You are a restaurant menu text extractor.

Task:
Extract every visible dish name from this menu image.

Rules:
- Return dish names only.
- One item per object.
- Preserve spelling exactly as seen, even if it looks unusual.
- Do not write descriptions.
- Do not summarize.
- Do not skip items because they look repetitive.
- Include duplicates only if they are separately listed menu items.
- Ignore headings, timings, and notes.
- Ignore prices.

Return JSON only in this format:
[
{"name": "Masala Dose"},
{"name": "Set Dose"}
]`;

    try {
      console.log(`[OLLAMA] Sending POST request to ${ollamaUrl}/api/generate`);
      const startTime = Date.now();

      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.getModelName(),
          prompt,
          images: [await this.imageUrlToBase64(imageUrl)],
          stream: false,
        }),
      });

      const responseTime = Date.now() - startTime;
      console.log(`[OLLAMA] Response received in ${responseTime}ms`);
      console.log(
        `[OLLAMA] Response Status: ${response.status} ${response.statusText}`,
      );

      if (!response.ok) {
        throw new InternalServerErrorException(
          `Ollama service at ${ollamaUrl} returned an error: ${response.status} ${response.statusText}. Please ensure the Ollama server is running and the model '${this.getModelName()}' is available.`,
        );
      }

      if (!response.body) {
        throw new InternalServerErrorException(
          `Ollama service returned an empty response body.`,
        );
      }

      console.log(`[OLLAMA] Starting to read dish name response stream...`);

      const rawText = await this.readOllamaStreamResponse(response);
      console.log(
        `[OLLAMA] Raw streamed response first 300 chars: ${rawText.substring(0, 300)}`,
      );

      const parsed = this.parseOllamaJsonResponse(rawText);
      console.log(`[OLLAMA] Parsed JSON successfully:`, JSON.stringify(parsed));

      const dishNames = (parsed as { name: string }[]).map(
        (item: { name: string }) => item.name,
      );
      console.log(`[OLLAMA] Extracted dish names:`, dishNames);
      console.log(`[OLLAMA] ========== STEP 1: COMPLETE ==========\n`);

      return dishNames;
    } catch (error) {
      console.error(`[OLLAMA] ERROR in extractDishNames:`, error);
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Unable to connect to Ollama service at ${ollamaUrl}. Please check that the Ollama server is running on the remote PC (${ollamaUrl}), the network connection is stable, and this PC (192.168.29.124) can access port 11434. Error: ${errorMessage}`,
      );
    }
  }

  private async generateDescriptions(dishNames: string[]): Promise<DishDto[]> {
    const ollamaUrl = this.configService.get<string>(
      "OLLAMA_BASE_URL",
      "http://192.168.29.236:11434",
    );

    console.log(`[OLLAMA] ========== STEP 2: GENERATE DESCRIPTIONS ==========`);
    console.log(`[OLLAMA] Dish names to process:`, dishNames);

    if (dishNames.length === 0) {
      console.log(
        `[OLLAMA] No dish names provided. Skipping description generation.`,
      );
      return [];
    }

    const batchSize = 5;
    const batches = this.chunkArray(dishNames, batchSize);
    const dishes: DishDto[] = [];

    try {
      for (const batch of batches) {
        const batchResult = await this.requestDescriptionBatch(
          batch,
          ollamaUrl,
        );
        dishes.push(...batchResult.dishes);

        for (const missingName of batchResult.missingNames) {
          console.warn(
            `[OLLAMA] Missing description for "${missingName}" in batch response. Retrying individually...`,
          );

          const retryResult = await this.requestDescriptionBatch(
            [missingName],
            ollamaUrl,
          );
          if (retryResult.dishes.length > 0) {
            dishes.push(retryResult.dishes[0]);
          } else {
            console.warn(
              `[OLLAMA] Could not generate AI description for "${missingName}". Using fallback description.`,
            );
            dishes.push(this.createFallbackDish(missingName));
          }
        }
      }

      console.log(`[OLLAMA] Generated descriptions:`, JSON.stringify(dishes));
      console.log(`[OLLAMA] ========== STEP 2: COMPLETE ==========\n`);

      return dishes;
    } catch (error) {
      console.error(`[OLLAMA] ERROR in generateDescriptions:`, error);

      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new InternalServerErrorException(
        `Unable to connect to Ollama service at ${ollamaUrl}. Please check that the Ollama server is running on remote PC 192.168.29.236, network is stable, and this PC 192.168.29.124 can access port 11434. Error: ${errorMessage}`,
      );
    }
  }

  private async requestDescriptionBatch(
    dishNames: string[],
    ollamaUrl: string,
  ): Promise<DescriptionBatchResult> {
    const inputJson = JSON.stringify(dishNames.map((name) => ({ name })));
    console.log(`[OLLAMA] input json:`, inputJson);

    const prompt = `You are a culinary description generator.

Task:
Given the JSON array below, return the same items with:
- name
- short_description

Rules:
- Keep each "name" exactly as provided.
- Add a "short_description" field for every item.
- Each short_description should be 20 to 35 words.
- Focus on likely ingredients, cooking style, texture, and taste.
- Keep descriptions practical and food-related.
- Do not invent prices, categories, image URLs, or restaurant details.
- Return valid JSON array only.
- Do not include markdown.
- Do not include any extra text.
- Process ALL items in the input array.
-   
- Even if there is only one input item, return a JSON array with one object.

Example output format:
[
  {"name": "Masala Dose", "short_description": "A flavorful South Indian breakfast staple..."},
  {"name": "Set Dose", "short_description": "A crispy fermented rice crepe..."}
]

Input:
${inputJson}`;

    console.log(`[OLLAMA] Sending POST request to ${ollamaUrl}/api/generate`);
    console.log(`[OLLAMA] prompt:`, prompt);

    const startTime = Date.now();

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      console.warn(`[OLLAMA] Request timeout after 600 seconds, aborting...`);
      controller.abort();
    }, 600000);

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.getModelName(),
        prompt,
        stream: true,
        format: "json",
        options: {
          temperature: 0.2,
          num_predict: Math.max(450, dishNames.length * 120),
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;

    console.log(`[OLLAMA] Response headers received in ${responseTime}ms`);
    console.log(
      `[OLLAMA] Response Status: ${response.status} ${response.statusText}`,
    );

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Ollama service at ${ollamaUrl} returned an error: ${response.status} ${response.statusText}. Please ensure the Ollama server is running and the model '${this.getModelName()}' is available.`,
      );
    }

    if (!response.body) {
      throw new InternalServerErrorException(
        `Ollama service returned an empty response body.`,
      );
    }

    console.log(`[OLLAMA] Starting to read response stream...`);

    const rawText = await this.readOllamaStreamResponse(response);

    console.log(
      `[OLLAMA] Raw streamed response first 300 chars: ${rawText.substring(0, 300)}`,
    );

    const parsed = this.parseOllamaJsonResponse(rawText);

    console.log(`[OLLAMA] Parsed JSON successfully:`, JSON.stringify(parsed));

    return this.normalizeDescriptionResponse(parsed, dishNames);
  }

  private normalizeDescriptionResponse(
    parsed: unknown,
    expectedNames: string[],
  ): DescriptionBatchResult {
    const parsedItems = Array.isArray(parsed) ? parsed : [parsed];
    const descriptionsByName = new Map<string, string>();

    if (!Array.isArray(parsed)) {
      console.warn(
        `[OLLAMA] Parsed response is not an array. Type: ${typeof parsed}. Treating it as a single-item response.`,
      );
    }

    if (
      expectedNames.length === 1 &&
      parsedItems.length === 1 &&
      this.isDescriptionItem(parsedItems[0])
    ) {
      return {
        dishes: [
          {
            name: expectedNames[0],
            short_description: parsedItems[0].short_description.trim(),
            image: null,
          },
        ],
        missingNames: [],
      };
    }

    for (const item of parsedItems) {
      if (!this.isDescriptionItem(item)) {
        continue;
      }

      descriptionsByName.set(item.name.trim(), item.short_description.trim());
    }

    const dishes: DishDto[] = [];
    const missingNames: string[] = [];

    for (const name of expectedNames) {
      const shortDescription = descriptionsByName.get(name);

      if (shortDescription) {
        dishes.push({
          name,
          short_description: shortDescription,
          image: null,
        });
      } else {
        missingNames.push(name);
      }
    }

    return { dishes, missingNames };
  }

  private isDescriptionItem(
    item: unknown,
  ): item is { name: string; short_description: string } {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof (item as { name?: unknown }).name === "string" &&
      typeof (item as { short_description?: unknown }).short_description ===
      "string" &&
      (item as { name: string }).name.trim().length > 0 &&
      (item as { short_description: string }).short_description.trim().length >
      0
    );
  }

  private async readOllamaStreamResponse(response: Response): Promise<string> {
    if (!response.body) {
      throw new InternalServerErrorException(
        `Ollama service returned an empty response body.`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let rawText = "";
    let lineBuffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";

      for (const line of lines) {
        rawText += this.readOllamaStreamLine(line);
      }
    }

    lineBuffer += decoder.decode();

    if (lineBuffer.trim().length > 0) {
      rawText += this.readOllamaStreamLine(lineBuffer);
    }

    return rawText;
  }

  private readOllamaStreamLine(line: string): string {
    if (line.trim().length === 0) {
      return "";
    }

    try {
      const parsedLine = JSON.parse(line);

      if (parsedLine.done === true) {
        console.log(`[OLLAMA] Streaming completed.`);
      }

      return typeof parsedLine.response === "string" ? parsedLine.response : "";
    } catch {
      console.warn(`[OLLAMA] Failed to parse stream line:`, line);
      return "";
    }
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

  private async imageUrlToBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch image from ${imageUrl}: ${response.statusText}`,
        );
      }
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString("base64");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Unable to process the image URL ${imageUrl}. Please ensure the image is accessible and the URL is valid. Error: ${errorMessage}`,
      );
    }
  }

  private parseOllamaJsonResponse(responseText: unknown): unknown {
    console.log(`[OLLAMA] [parseOllamaJsonResponse] Starting JSON parsing...`);

    if (typeof responseText !== "string") {
      console.error(
        `[OLLAMA] [parseOllamaJsonResponse] Response is not a string, got type: ${typeof responseText}`,
      );
      throw new InternalServerErrorException(
        "Ollama response is not a string.",
      );
    }

    let cleaned = responseText.trim();
    console.log(
      `[OLLAMA] [parseOllamaJsonResponse] Original response length: ${responseText.length} chars`,
    );

    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch && fenceMatch[1]) {
      console.log(
        `[OLLAMA] [parseOllamaJsonResponse] Found markdown code fence, extracting content...`,
      );
      cleaned = fenceMatch[1].trim();
    }

    const tryParse = (text: string) => {
      try {
        console.log(
          `[OLLAMA] [parseOllamaJsonResponse] Attempting to parse: ${text.substring(0, 50)}...`,
        );
        const result = JSON.parse(text);
        console.log(
          `[OLLAMA] [parseOllamaJsonResponse] Successfully parsed JSON`,
        );
        return result;
      } catch {
        return null;
      }
    };

    let parsed = tryParse(cleaned);
    if (parsed !== null) {
      return parsed;
    }

    console.log(
      `[OLLAMA] [parseOllamaJsonResponse] Direct parse failed, attempting extractFirstJsonPayload...`,
    );
    const jsonSegment = this.extractFirstJsonPayload(cleaned);
    if (jsonSegment) {
      console.log(
        `[OLLAMA] [parseOllamaJsonResponse] Found JSON segment: ${jsonSegment.substring(0, 100)}...`,
      );
      parsed = tryParse(jsonSegment);
      if (parsed !== null) {
        return parsed;
      }
    }

    console.log(
      `[OLLAMA] [parseOllamaJsonResponse] Attempting regex array match...`,
    );
    const arrayMatch = cleaned.match(/(\[\s*[\s\S]*\])/m);
    if (arrayMatch) {
      parsed = tryParse(arrayMatch[1]);
      if (parsed !== null) {
        return parsed;
      }
    }

    console.log(
      `[OLLAMA] [parseOllamaJsonResponse] Attempting regex object match...`,
    );
    const objectMatch = cleaned.match(/(\{[\s\S]*\})/m);
    if (objectMatch) {
      parsed = tryParse(objectMatch[1]);
      if (parsed !== null) {
        return parsed;
      }
    }

    console.error(
      `[OLLAMA] [parseOllamaJsonResponse] All parsing attempts failed`,
    );
    throw new InternalServerErrorException(
      `Unable to parse Ollama JSON response. Raw response: ${JSON.stringify(responseText)}`,
    );
  }

  private extractFirstJsonPayload(text: string): string | null {
    console.log(
      `[OLLAMA] [extractFirstJsonPayload] Searching for first JSON payload...`,
    );

    const startIndex = text.search(/[\[{]/);
    if (startIndex === -1) {
      console.log(
        `[OLLAMA] [extractFirstJsonPayload] No JSON start character found`,
      );
      return null;
    }

    console.log(
      `[OLLAMA] [extractFirstJsonPayload] Found JSON start at index ${startIndex}`,
    );

    const stack: string[] = [];
    let inString = false;
    let escape = false;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === "\\") {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === "[" || char === "{") {
        stack.push(char);
        continue;
      }

      if (char === "]" || char === "}") {
        const last = stack.pop();
        if (!last) {
          console.log(
            `[OLLAMA] [extractFirstJsonPayload] Mismatched closing bracket at index ${i}`,
          );
          return null;
        }

        if ((last === "[" && char === "]") || (last === "{" && char === "}")) {
          if (stack.length === 0) {
            const payload = text.slice(startIndex, i + 1);
            console.log(
              `[OLLAMA] [extractFirstJsonPayload] Successfully extracted payload: ${payload.substring(0, 100)}...`,
            );
            return payload;
          }
        } else {
          console.log(
            `[OLLAMA] [extractFirstJsonPayload] Bracket type mismatch at index ${i}`,
          );
          return null;
        }
      }
    }

    console.log(
      `[OLLAMA] [extractFirstJsonPayload] Reached end of text without finding closing bracket`,
    );
    return null;
  }
}
