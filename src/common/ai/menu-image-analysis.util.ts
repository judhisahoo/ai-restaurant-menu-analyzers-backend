import { BadRequestException } from "@nestjs/common";
import { DishDto } from "../../menu-scans/dto/dish-analysis.dto";

export type DishDescriptionBatchResult = {
  dishes: DishDto[];
  missingNames: string[];
};

export type ItemComponentReportDto = {
  name: string;
  detail: string;
};

export type ItemIngredientReportDto = {
  name: string;
  detail: string;
};

export type NameDetailReportDto = {
  name: string;
  detail: string;
};

export const ITEM_COMPONENT_REPORT_SECTION_NAMES = [
  "Structural Base",
  "Flavor Profiling",
  "Textural Dynamics",
  "Nutritional Composition",
  "Synergy Elements",
] as const;

export const ITEM_INGREDIENT_REPORT_SECTION_NAMES = [
  "Primary Ingredients",
  "Binding & Leavening",
  "Flavorings",
  "Fats & Cooking Medium",
  "Texture Analysis",
  "Nutritional Profile",
  "Accompaniments",
  "Allergy & Dietary Notes",
] as const;

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

export const MENU_DISH_NAME_EXTRACTION_PROMPT = `You are a restaurant menu text extractor.

Task:
Read the menu image and extract the visible dish names.

Rules:
- Return only food dish names.
- Scan the whole image from top to bottom and left to right across every column and section.
- Return each unique dish name one time only.
- If the same dish name appears multiple times, keep the first occurrence and skip the later duplicates.
- Keep distinct variants as separate items, for example "Plain Dose" and "Masala Dose".
- Preserve spelling exactly as seen, even if it looks unusual.
- Do not write descriptions.
- Do not summarize.
- Ignore headings, timings, notes, and prices.
- Stop after the unique dish names are listed. Do not repeat any name to fill the response.
- Do not return an empty array when dish names are visible in the image.

Return JSON only in this format:
[
  {"name": "Masala Dose"},
  {"name": "Set Dose"}
]

If you cannot identify any dishes, return an empty array: []`;

export function buildMissingDishNameReviewPrompt(
  existingDishNames: string[],
): string {
  return `You are reviewing a restaurant menu image for missed items.

Task:
Look at the whole image again and find food dish names that are visible but missing from the Existing dish names list.

Existing dish names:
${JSON.stringify(existingDishNames)}

Rules:
- Return only dish names that are clearly visible in the image and are NOT already in the Existing dish names list.
- Scan top to bottom and left to right across every column and section.
- Keep distinct variants as separate items, for example "Plain Dose" and "Masala Dose".
- Ignore prices, headings, timings, and notes.
- Do not return descriptions.
- Do not repeat names.
- If there are no missing dish names, return [].

Return JSON only in this format:
[
  {"name": "Missing Dish Name"}
]`;
}

export function buildDishDescriptionPrompt(dishNames: string[]): string {
  const inputJson = JSON.stringify(dishNames.map((name) => ({ name })));

  return `You are a culinary description generator.

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
- The response must start with [ and end with ].
- Even if there is only one input item, return a JSON array with one object.

Example output format:
[
  {"name": "Masala Dose", "short_description": "A flavorful South Indian breakfast staple with a crisp fermented crepe, spiced potato filling, and tangy chutney-friendly taste."},
  {"name": "Set Dose", "short_description": "A soft set of small dosas made from fermented rice and lentil batter, usually served warm with chutney and sambar."}
]

Input:
${inputJson}`;
}

export function buildItemComponentReportPrompt(dishName: string): string {
  const sectionList = ITEM_COMPONENT_REPORT_SECTION_NAMES.map(
    (sectionName, index) => `${index + 1}. ${sectionName}`,
  ).join("\n");

  return `Act as a culinary consultant. Provide a detailed component report for the dish in the "Input" section. Analyze functional components, not a raw ingredients list.
Include:
Structural Base: Role of starches/liquids in forming the lacey matrix.
Flavor Profiling: Functional impact of aromatics and spices.
Textural Dynamics: Elements responsible for surface crispiness versus core moisture.
Nutritional Composition: Estimated macros per serving.
Synergy Elements: Role of traditional accompaniments.

Rules:
Return exactly ${ITEM_COMPONENT_REPORT_SECTION_NAMES.length} JSON objects.
Return one object for each section name below, in this exact order:
${sectionList}
Required keys: "name", "detail".
The "name" value must exactly match the section name.
The "detail" value must be practical and food-focused, not generic and not more than 25 words.
Response must start with [ and end with ].
Do not include markdown, code blocks, or extra text.
Do not return a wrapper object.
Do not combine sections into one object.

Example output format:
[
{"name":"Structural Base","detail":"Rava and rice flour hydrate into a thin batter; extra water creates spread and lace-like gaps."},
{"name":"Flavor Profiling","detail":"Onion, green chilli, ginger, curry leaves, cumin, and pepper add sweetness, heat, aroma, and savory depth."},
{"name":"Textural Dynamics","detail":"Thin batter, hot griddle, and oil encourage evaporation, browning, crisp edges, and a lightly moist center."},
{"name":"Nutritional Composition","detail":"Per serving estimate: carbs 35-45g, protein 5-8g, fat 8-12g depending on oil and batter thickness."},
{"name":"Synergy Elements","detail":"Coconut chutney, tomato chutney, sambar, and potato masala balance crispness with moisture, acidity, and warmth."}
]

Input:
${dishName};`;
}

export function buildItemIngredientReportPrompt(dishName: string): string {
  return `You are a culinary consultant. Return a valid JSON array (start with [ and end with ]) of objects with exactly two string fields: "name" and "detail". For the dish in "Input", include these objects with these exact names and concise comma-separated details:

"Primary Ingredients": main ingredients with relative proportions using format "ingredient:proportion" (no units).
"Binding & Leavening": agents/methods as short phrases.
"Flavorings": aromatics, spices, herbs, vegetables as short phrases.
"Fats & Cooking Medium": fats and application as short phrases.
"Texture Analysis": 1-3 short clauses on how ingredients/methods affect texture.
"Nutritional Profile": "Carbs Xg, Protein Yg, Fat Zg, Cal XXXX kcal" per serving, rounded.
"Accompaniments": essential sides/condiments as short phrases.
"Allergy & Dietary Notes": allergens and simple substitutions.
Rules: no extra text or markdown; no measurements except relative proportions and per-serving macros; no cooking steps; ensure valid JSON, strings escaped, start with "[" and end with "]".
Input:
${dishName}`;
}

export function buildSingleItemComponentSectionPrompt(
  dishName: string,
  sectionName: string,
): string {
  return `Act as a culinary consultant.

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
}

export function buildSingleItemIngredientSectionPrompt(
  dishName: string,
  sectionName: string,
): string {
  return `You are a culinary consultant.

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
}

export function parseDishArray(responseText: string): DishDto[] {
  const sanitizedJson = extractJsonPayload(responseText);
  const parsed = JSON.parse(sanitizedJson) as unknown;
  return normalizeDishPayload(parsed);
}

export function parseDishNameArray(responseText: string): string[] {
  const sanitizedJson = extractJsonPayload(responseText);
  const parsed = JSON.parse(sanitizedJson) as unknown;
  return normalizeDishNamePayload(parsed);
}

export function normalizeDishNamePayload(parsed: unknown): string[] {
  const items = Array.isArray(parsed)
    ? parsed
    : (getFirstArrayProperty(parsed, [
        "dishes",
        "names",
        "items",
        "menu_items",
        "dish_names",
        "dishNames",
        "unique_dishes",
        "unique_dish_names",
        "menu_dishes",
      ]) ??
      (isDishNamePriceMap(parsed)
        ? Object.keys(parsed)
        : parsed && typeof parsed === "object"
          ? [parsed]
          : null));

  if (!items) {
    throw new BadRequestException(
      "AI response was not in the expected dish name array format.",
    );
  }

  return items
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (!item || typeof item !== "object") {
        return "";
      }

      const record = item as Record<string, unknown>;
      const name =
        record.name ??
        record.dish_name ??
        record.dishName ??
        record.dish ??
        record.title ??
        record.item ??
        record.text ??
        record.value;

      return typeof name === "string" ? name.trim() : "";
    })
    .filter((name) => name.length > 0);
}

function isDishNamePriceMap(
  value: unknown,
): value is Record<string, string | number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value as Record<string, unknown>);

  return (
    entries.length > 0 &&
    entries.every(
      ([key, entryValue]) =>
        key.trim().length > 0 &&
        (typeof entryValue === "number" || typeof entryValue === "string"),
    )
  );
}

export function normalizeDishPayload(parsed: unknown): DishDto[] {
  const dishes = Array.isArray(parsed)
    ? parsed
    : hasDishesArray(parsed)
      ? parsed.dishes
      : parsed && typeof parsed === "object"
        ? [parsed]
        : null;

  if (!dishes) {
    throw new BadRequestException(
      "AI response was not in the expected dish array format.",
    );
  }

  return dishes
    .filter(
      (dish): dish is Record<string, unknown> =>
        !!dish && typeof dish === "object",
    )
    .map((dish) => ({
      name: typeof dish.name === "string" ? dish.name.trim() : "",
      short_description:
        typeof dish.short_description === "string"
          ? dish.short_description.trim()
          : "",
      image: null,
    }))
    .filter(
      (dish) => dish.name.length > 0 && dish.short_description.length > 0,
    );
}

export function normalizeDishDescriptionPayload(
  parsed: unknown,
  expectedNames: string[],
): DishDescriptionBatchResult {
  const items = Array.isArray(parsed)
    ? parsed
    : hasDishesArray(parsed)
      ? parsed.dishes
      : parsed && typeof parsed === "object"
        ? [parsed]
        : [];

  const validItems = items.filter(isDishDescriptionRecord);

  if (expectedNames.length === 1 && validItems.length === 1) {
    return {
      dishes: [
        {
          name: expectedNames[0],
          short_description: String(validItems[0].short_description).trim(),
          image: null,
        },
      ],
      missingNames: [],
    };
  }

  const descriptionsByName = new Map<string, string>();
  for (const item of validItems) {
    descriptionsByName.set(
      normalizeNameKey(String(item.name)),
      String(item.short_description).trim(),
    );
  }

  const dishes: DishDto[] = [];
  const missingNames: string[] = [];

  for (const name of expectedNames) {
    const shortDescription = descriptionsByName.get(normalizeNameKey(name));

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

export function normalizeItemComponentReportPayload(
  parsed: unknown,
): ItemComponentReportDto[] {
  const components = normalizeNameDetailPayload(parsed, "item components");

  if (components.length === 0) {
    throw new BadRequestException(
      "AI response did not contain any valid item components.",
    );
  }

  return components;
}

export function normalizeItemIngredientReportPayload(
  parsed: unknown,
): ItemIngredientReportDto[] {
  const ingredients = normalizeNameDetailPayload(parsed, "ingredient details");

  if (ingredients.length === 0) {
    throw new BadRequestException(
      "AI response did not contain any valid ingredient details.",
    );
  }

  return ingredients;
}

export function orderNameDetailReportBySections<T extends NameDetailReportDto>(
  items: T[],
  sectionNames: readonly string[],
): { orderedItems: T[]; missingSections: string[] } {
  const itemsBySection = new Map<string, T>();

  for (const item of items) {
    const matchingSection = findMatchingSectionName(item.name, sectionNames);
    if (!matchingSection) {
      continue;
    }

    itemsBySection.set(matchingSection, {
      ...item,
      name: matchingSection,
    });
  }

  const missingSections = sectionNames.filter(
    (sectionName) => !itemsBySection.has(sectionName),
  );

  const orderedItems = sectionNames
    .map((sectionName) => itemsBySection.get(sectionName))
    .filter((item): item is T => !!item);

  return {
    orderedItems,
    missingSections,
  };
}

function findMatchingSectionName(
  itemName: string,
  sectionNames: readonly string[],
): string | null {
  const normalizedItemName = itemName.trim().toLowerCase();

  return (
    sectionNames.find(
      (sectionName) => sectionName.trim().toLowerCase() === normalizedItemName,
    ) ?? null
  );
}

function normalizeNameDetailPayload(
  parsed: unknown,
  label: string,
): Array<{ name: string; detail: string }> {
  const items = Array.isArray(parsed)
    ? parsed
    : (getFirstArrayProperty(parsed, [
        "components",
        "ingredients",
        "items",
        "sections",
        "data",
        "results",
        "report",
        "componentReport",
        "ingredientReport",
        "item_components",
        "itemComponents",
        "ingredient_details",
        "ingredientDetails",
      ]) ??
      normalizeNameDetailMapPayload(parsed) ??
      (parsed && typeof parsed === "object" ? [parsed] : null));

  if (!items) {
    throw new BadRequestException(
      `AI response was not in the expected ${label} array format.`,
    );
  }

  return items
    .map(normalizeNameDetailItem)
    .filter((item) => item.name.length > 0 && item.detail.length > 0);
}

function normalizeNameDetailMapPayload(
  value: unknown,
): Record<string, unknown>[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const nestedReport =
    record.report ??
    record.component_report ??
    record.componentReport ??
    record.ingredient_report ??
    record.ingredientReport;
  if (nestedReport && nestedReport !== value) {
    const nestedItems = normalizeNameDetailMapPayload(nestedReport);
    if (nestedItems) {
      return nestedItems;
    }
  }

  if (hasNameDetailLikeKeys(record)) {
    return [record];
  }

  const entries = Object.entries(record)
    .map(([name, detailValue]) => nameDetailEntryToRecord(name, detailValue))
    .filter((item): item is Record<string, unknown> => !!item);

  return entries.length > 0 ? entries : null;
}

function normalizeNameDetailItem(item: unknown): {
  name: string;
  detail: string;
} {
  if (!item || typeof item !== "object") {
    return { name: "", detail: "" };
  }

  const record = item as Record<string, unknown>;
  const directName = firstStringValue(record, [
    "name",
    "section",
    "section_name",
    "sectionName",
    "title",
    "component",
    "component_name",
    "componentName",
    "ingredient",
    "ingredient_name",
    "ingredientName",
    "category",
  ]);
  const directDetail = firstStringValue(record, [
    "detail",
    "details",
    "component_detail",
    "componentDetail",
    "ingredient_detail",
    "ingredientDetail",
    "summary",
    "description",
    "short_description",
    "shortDescription",
    "text",
    "value",
    "content",
    "analysis",
  ]);

  if (directName && directDetail) {
    return { name: directName, detail: directDetail };
  }

  const mappedEntry = Object.entries(record)
    .map(([name, detailValue]) => nameDetailEntryToRecord(name, detailValue))
    .find((entry) => !!entry);

  if (mappedEntry) {
    return {
      name: String(mappedEntry.name).trim(),
      detail: String(mappedEntry.detail).trim(),
    };
  }

  return { name: "", detail: "" };
}

function nameDetailEntryToRecord(
  name: string,
  detailValue: unknown,
): Record<string, unknown> | null {
  const trimmedName = name.trim();
  if (!trimmedName || isWrapperOrMetadataKey(trimmedName)) {
    return null;
  }

  if (typeof detailValue === "string" && detailValue.trim().length > 0) {
    return { name: trimmedName, detail: detailValue.trim() };
  }

  if (
    detailValue &&
    typeof detailValue === "object" &&
    !Array.isArray(detailValue)
  ) {
    const detail = firstStringValue(detailValue as Record<string, unknown>, [
      "detail",
      "details",
      "component_detail",
      "componentDetail",
      "ingredient_detail",
      "ingredientDetail",
      "summary",
      "description",
      "short_description",
      "shortDescription",
      "text",
      "value",
      "content",
      "analysis",
    ]);

    if (detail) {
      return { name: trimmedName, detail };
    }
  }

  return null;
}

function hasNameDetailLikeKeys(record: Record<string, unknown>): boolean {
  return (
    firstStringValue(record, [
      "name",
      "section",
      "section_name",
      "sectionName",
      "title",
      "component",
      "component_name",
      "componentName",
      "ingredient",
      "ingredient_name",
      "ingredientName",
      "category",
    ]) !== "" &&
    firstStringValue(record, [
      "detail",
      "details",
      "component_detail",
      "componentDetail",
      "ingredient_detail",
      "ingredientDetail",
      "summary",
      "description",
      "short_description",
      "shortDescription",
      "text",
      "value",
      "content",
      "analysis",
    ]) !== ""
  );
}

function firstStringValue(
  record: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return "";
}

function isWrapperOrMetadataKey(key: string): boolean {
  const normalizedKey = key.trim().toLowerCase();

  return [
    "components",
    "ingredients",
    "items",
    "sections",
    "data",
    "results",
    "report",
    "component_report",
    "componentreport",
    "ingredient_report",
    "ingredientreport",
    "dish",
    "dish_name",
    "dishname",
    "input",
  ].includes(normalizedKey);
}

function extractJsonPayload(responseText: string): string {
  const trimmed = responseText.trim();
  if (!trimmed) {
    throw new BadRequestException(
      "Failed to analyze menu image. No AI response.",
    );
  }

  const fencedJsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedJsonMatch?.[1]) {
    return fencedJsonMatch[1].trim();
  }

  const firstArrayBracket = trimmed.indexOf("[");
  const lastArrayBracket = trimmed.lastIndexOf("]");
  if (firstArrayBracket !== -1 && lastArrayBracket !== -1) {
    return trimmed.slice(firstArrayBracket, lastArrayBracket + 1);
  }

  const firstObjectBracket = trimmed.indexOf("{");
  const lastObjectBracket = trimmed.lastIndexOf("}");
  if (firstObjectBracket !== -1 && lastObjectBracket !== -1) {
    return trimmed.slice(firstObjectBracket, lastObjectBracket + 1);
  }

  return trimmed;
}

function getFirstArrayProperty(
  value: unknown,
  keys: string[],
): unknown[] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key];
    }
  }

  return null;
}

function hasDishesArray(
  value: unknown,
): value is { dishes: Record<string, unknown>[] } {
  return (
    !!value &&
    typeof value === "object" &&
    "dishes" in value &&
    Array.isArray(value.dishes)
  );
}

function hasNamesArray(
  value: unknown,
): value is { names: Record<string, unknown>[] } {
  return (
    !!value &&
    typeof value === "object" &&
    "names" in value &&
    Array.isArray(value.names)
  );
}

function isDishDescriptionRecord(
  value: unknown,
): value is { name: string; short_description: string } {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { short_description?: unknown }).short_description ===
      "string" &&
    (value as { name: string }).name.trim().length > 0 &&
    (value as { short_description: string }).short_description.trim().length > 0
  );
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}
