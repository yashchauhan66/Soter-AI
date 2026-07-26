import { describe, it } from "node:test";
import assert from "node:assert";
import {
  DATA_CATEGORIES,
  getDataCategory,
  queryDataCategories,
  getPersonalDataCategories,
  getUserControllableCategories,
  getCategoriesByLocation,
  getCategoriesByClassification,
  validateDataInventory,
  generateProcessingRecords,
} from "../index";

describe("DataInventory", () => {
  describe("validateDataInventory", () => {
    it("should pass validation with no duplicate IDs and all required fields present", () => {
      const result = validateDataInventory();
      if (!result.valid) {
        console.error("Inventory validation errors:", result.errors);
        console.error("Duplicate IDs:", result.duplicateIds);
      }
      assert.ok(result.valid, `Validation failed: ${result.errors.join("; ")}`);
    });

    it("should have at least 30 categories covering all major areas", () => {
      assert.ok(DATA_CATEGORIES.length >= 30, `Expected >=30 categories, got ${DATA_CATEGORIES.length}`);
    });
  });

  describe("getDataCategory", () => {
    it("should return a known category by ID", () => {
      const cat = getDataCategory("guard.originalText");
      assert.ok(cat !== undefined, "guard.originalText should exist");
      assert.strictEqual(cat!.id, "guard.originalText");
      assert.strictEqual(cat!.classification, "RESTRICTED");
      assert.strictEqual(cat!.isPersonalData, true);
    });

    it("should return undefined for unknown ID", () => {
      assert.strictEqual(getDataCategory("nonexistent.category"), undefined);
    });
  });

  describe("queryDataCategories", () => {
    it("should filter by predicate", () => {
      const credentialCats = queryDataCategories(
        (c) => c.classification === "CREDENTIAL",
      );
      assert.ok(credentialCats.length >= 4, `Expected >=4 credential categories, got ${credentialCats.length}`);
      credentialCats.forEach((c) => assert.strictEqual(c.classification, "CREDENTIAL"));
    });

    it("should return empty array for impossible predicate", () => {
      const result = queryDataCategories(() => false);
      assert.strictEqual(result.length, 0);
    });
  });

  describe("getPersonalDataCategories", () => {
    it("should return categories flagged as personal data", () => {
      const personal = getPersonalDataCategories();
      assert.ok(personal.length >= 5, `Expected >=5 personal data categories, got ${personal.length}`);
      personal.forEach((c) => assert.strictEqual(c.isPersonalData, true));
    });
  });

  describe("getUserControllableCategories", () => {
    it("should return categories that are user-controllable", () => {
      const controllable = getUserControllableCategories();
      assert.ok(controllable.length > 0, "Expected at least one user-controllable category");
      controllable.forEach((c) => assert.strictEqual(c.isUserControllable, true));
    });
  });

  describe("getCategoriesByLocation", () => {
    it("should find PostgreSQL-hosted categories", () => {
      const postgres = getCategoriesByLocation("POSTGRESQL");
      assert.ok(postgres.length >= 30, `Expected >=30 postgres categories, got ${postgres.length}`);
    });

    it("should find in-memory categories", () => {
      const inMem = getCategoriesByLocation("IN_MEMORY");
      assert.ok(inMem.length >= 1, `Expected >=1 in-memory category, got ${inMem.length}`);
    });

    it("should find encrypted-store categories", () => {
      const encrypted = getCategoriesByLocation("ENCRYPTED_STORE");
      assert.ok(encrypted.length >= 1, `Expected >=1 encrypted-store category, got ${encrypted.length}`);
    });
  });

  describe("getCategoriesByClassification", () => {
    it("should find PII-classified categories", () => {
      const pii = getCategoriesByClassification("PII");
      assert.ok(pii.length >= 2, `Expected >=2 PII categories, got ${pii.length}`);
      pii.forEach((c) => assert.strictEqual(c.classification, "PII"));
    });

    it("should find CREDENTIAL-classified categories", () => {
      const creds = getCategoriesByClassification("CREDENTIAL");
      assert.ok(creds.length >= 4, `Expected >=4 credential categories, got ${creds.length}`);
    });
  });

  describe("generateProcessingRecords", () => {
    it("should produce a valid processing-records summary", () => {
      const records = generateProcessingRecords();
      assert.strictEqual(typeof records.controllerName, "string");
      assert.strictEqual(typeof records.generatedAt, "string");
      assert.ok(Array.isArray(records.categories));
      assert.ok(records.categories.length >= 30, `Expected >=30 categories in summary, got ${records.categories.length}`);
      assert.strictEqual(records.dpdpRegistered, false);
      assert.strictEqual(records.dpdpRegistrationId, null);
      assert.ok(typeof records.disclaimer === "string");
    });

    it("should include all category IDs in the summary", () => {
      const records = generateProcessingRecords();
      const summaryIds = new Set(records.categories.map((c) => c.categoryId));
      const expectedIds = new Set(DATA_CATEGORIES.map((c) => c.id));
      assert.strictEqual(summaryIds.size, expectedIds.size);
    });
  });

  describe("data integrity", () => {
    it("every category should have a unique ID", () => {
      const ids = DATA_CATEGORIES.map((c) => c.id);
      const uniqueIds = new Set(ids);
      assert.strictEqual(ids.length, uniqueIds.size);
    });

    it("every category should have a defined purpose", () => {
      for (const c of DATA_CATEGORIES) {
        assert.ok(c.purpose && c.purpose.length > 0, `[${c.id}] Missing purpose`);
      }
    });

    it("every personal data category should have a legal basis", () => {
      const personalCats = getPersonalDataCategories();
      for (const c of personalCats) {
        assert.ok(c.legalBasis !== undefined, `[${c.id || 'undefined'}] Personal data missing legal basis; classification=${c.classification}`);
        assert.notStrictEqual(c.legalBasis, "NOT_APPLICABLE", `[${c.id}] legalBasis should not be NOT_APPLICABLE, got ${c.legalBasis}`);
      }
    });

    it("every persisted category should have a storage table", () => {
      for (const c of DATA_CATEGORIES) {
        if (c.persisted) {
          assert.ok(c.storageTable.length > 0, `[${c.id}] Persisted but missing storageTable`);
        }
      }
    });
  });
});
