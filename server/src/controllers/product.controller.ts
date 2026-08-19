import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as productService from '../services/product.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  res.json(await productService.listProducts(req.query as never));
});

export const search = asyncHandler(async (req: Request, res: Response) => {
  const { q, limit } = req.query as unknown as { q: string; limit: number };
  res.json(await productService.searchProducts(q, limit));
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  res.json({ product: await productService.getProductBySlug(req.params.slug!) });
});

export const categories = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ categories: await productService.listCategories() });
});

export const collections = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ collections: await productService.getHomeCollections() });
});
