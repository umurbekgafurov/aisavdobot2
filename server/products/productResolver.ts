import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { Product } from '../../src/types';

export type ProductMatchType = 'exact' | 'sku' | 'normalized' | 'fuzzy';

export type ProductResolution =
  | {
      status: 'resolved';
      product: Product;
      matchType: ProductMatchType;
      confidence: number;
    }
  | {
      status: 'not_found';
      productName: string;
    }
  | {
      status: 'ambiguous';
      productName: string;
      candidates: Product[];
    };

export interface ResolveProductParams {
  businessId: string;
  productName: string;
}

export class ProductResolver {
  /**
   * Safe string normalization function for product matching:
   * - Lowercase
   * - Trim leading and trailing spaces
   * - Collapse multiple whitespaces
   * - Standardize capacity formats (e.g. "256 gb" -> "256gb")
   * - Normalize punctuation while preserving meaningful numbers & model specs
   */
  static normalize(text: string): string {
    if (!text || typeof text !== 'string') return '';

    return text
      .toLowerCase()
      .trim()
      .replace(/(\d+)\s*(gb|tb|mb)\b/gi, '$1$2') // Normalize "256 gb" -> "256gb"
      .replace(/[,\-_/]/g, ' ') // Replace separators with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces into single space
      .trim();
  }

  /**
   * Resolves a product for a specific business tenant in Firestore.
   * Strict tenant isolation: businessId is strictly required and enforced.
   * Resolves:
   * 1. Exact match (case/spacing/capacity normalized)
   * 2. SKU match
   * 3. Controlled fuzzy / contains match (distinguishing ambiguities e.g. 128gb vs 256gb)
   */
  static async resolveProduct(
    params: ResolveProductParams,
    injectedProducts?: Product[]
  ): Promise<ProductResolution> {
    const { businessId, productName } = params;

    // Security & input validation
    if (!businessId || typeof businessId !== 'string' || !businessId.trim()) {
      throw new Error('[ProductResolver] businessId is required and must not be empty.');
    }

    if (!productName || typeof productName !== 'string' || !productName.trim()) {
      return {
        status: 'not_found',
        productName: productName || '',
      };
    }

    const cleanInputName = productName.trim();
    const normalizedInput = this.normalize(cleanInputName);

    if (!normalizedInput) {
      return {
        status: 'not_found',
        productName: cleanInputName,
      };
    }

    console.log(`[ProductResolver] Product resolution started. Business: ${businessId}, Query: "${normalizedInput}"`);

    // 1. Fetch products scoped strictly to this business tenant
    let products: Product[] = [];
    if (injectedProducts) {
      // Injected repository for unit tests or mocked data (must still enforce tenant isolation)
      products = injectedProducts.filter((p) => p.businessId === businessId);
    } else {
      try {
        const colRef = collection(db, 'businesses', businessId, 'products');
        const q = query(colRef, limit(200));
        const snap = await getDocs(q);
        products = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Product));
      } catch (err: any) {
        console.warn(`[ProductResolver] Firestore fetch error for business ${businessId}:`, err?.message || err);
        return {
          status: 'not_found',
          productName: cleanInputName,
        };
      }
    }

    if (products.length === 0) {
      console.log(`[ProductResolver] Result: not_found (No products in business ${businessId})`);
      return {
        status: 'not_found',
        productName: cleanInputName,
      };
    }

    // STEP 1 — Exact match (Original or normalized)
    for (const p of products) {
      const pNameNorm = this.normalize(p.name);
      if (pNameNorm === normalizedInput) {
        console.log(`[ProductResolver] Result: resolved (exact/normalized match: ${p.name}, id: ${p.id})`);
        return {
          status: 'resolved',
          product: p,
          matchType: p.name.trim().toLowerCase() === cleanInputName.toLowerCase() ? 'exact' : 'normalized',
          confidence: 0.99,
        };
      }
    }

    // STEP 2 — SKU match
    const inputUpper = cleanInputName.toUpperCase();
    for (const p of products) {
      if (p.sku && p.sku.trim().toUpperCase() === inputUpper) {
        console.log(`[ProductResolver] Result: resolved (SKU match: ${p.sku}, id: ${p.id})`);
        return {
          status: 'resolved',
          product: p,
          matchType: 'sku',
          confidence: 0.98,
        };
      }
    }

    // STEP 3 — Controlled Fuzzy / Substring Candidate Match
    // Extract capacity tokens (e.g., '128gb', '256gb', '512gb', '1tb')
    const capacityRegex = /\b(\d+(?:gb|tb))\b/gi;
    const inputCapacities = (normalizedInput.match(capacityRegex) || []).map((c) => c.toLowerCase());

    const inputTokens = normalizedInput.split(' ').filter((t) => t.length > 1);

    const candidates: Product[] = [];

    for (const p of products) {
      const pNorm = this.normalize(p.name);
      const pCapacities = (pNorm.match(capacityRegex) || []).map((c) => c.toLowerCase());

      // If user specified a capacity (e.g. 256gb), the product MUST have that exact capacity
      if (inputCapacities.length > 0) {
        const matchesCapacity = inputCapacities.some((c) => pCapacities.includes(c));
        if (!matchesCapacity) {
          continue; // Discard mismatching capacities (e.g. 128gb when asked for 256gb)
        }
      }

      // Check token coverage
      const allTokensMatch = inputTokens.every((token) => pNorm.includes(token));
      const reverseContains = inputTokens.length >= 2 && normalizedInput.includes(pNorm);

      if (allTokensMatch || reverseContains) {
        candidates.push(p);
      }
    }

    // Evaluate candidates
    if (candidates.length === 1) {
      const single = candidates[0];
      console.log(`[ProductResolver] Result: resolved (single candidate match: ${single.name}, id: ${single.id})`);
      return {
        status: 'resolved',
        product: single,
        matchType: 'fuzzy',
        confidence: 0.88,
      };
    }

    if (candidates.length > 1) {
      console.log(`[ProductResolver] Result: ambiguous (${candidates.length} candidates found for "${cleanInputName}")`);
      return {
        status: 'ambiguous',
        productName: cleanInputName,
        candidates: candidates.slice(0, 5), // Reasonable limit of 5 candidates
      };
    }

    console.log(`[ProductResolver] Result: not_found for "${cleanInputName}"`);
    return {
      status: 'not_found',
      productName: cleanInputName,
    };
  }
}
