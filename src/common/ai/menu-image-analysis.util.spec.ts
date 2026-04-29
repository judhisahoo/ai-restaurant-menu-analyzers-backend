import {
  normalizeItemComponentReportPayload,
  normalizeItemIngredientReportPayload,
} from "./menu-image-analysis.util";

describe("name/detail report normalization", () => {
  it("normalizes component arrays with alternate detail keys", () => {
    expect(
      normalizeItemComponentReportPayload([
        {
          section: "Structural Base",
          description: "Rice flour and water form a thin crisp matrix.",
        },
      ]),
    ).toEqual([
      {
        name: "Structural Base",
        detail: "Rice flour and water form a thin crisp matrix.",
      },
    ]);
  });

  it("normalizes component section maps", () => {
    expect(
      normalizeItemComponentReportPayload({
        "Structural Base": "Thin batter spreads into a lace-like base.",
        "Flavor Profiling": {
          details: "Cumin, pepper, chilli, and curry leaves build aroma.",
        },
      }),
    ).toEqual([
      {
        name: "Structural Base",
        detail: "Thin batter spreads into a lace-like base.",
      },
      {
        name: "Flavor Profiling",
        detail: "Cumin, pepper, chilli, and curry leaves build aroma.",
      },
    ]);
  });

  it("normalizes nested report objects", () => {
    expect(
      normalizeItemIngredientReportPayload({
        report: {
          "Primary Ingredients": "Rice:2, urad dal:1, water:as needed.",
        },
      }),
    ).toEqual([
      {
        name: "Primary Ingredients",
        detail: "Rice:2, urad dal:1, water:as needed.",
      },
    ]);
  });

  it("throws when no usable name/detail content is present", () => {
    expect(() => normalizeItemComponentReportPayload({ ok: true })).toThrow(
      "AI response did not contain any valid item components.",
    );
  });
});
