/**
 * PocketBase Database utilities
 *
 * Use these helpers for CRUD operations on collections.
 * Replace 'example' with your actual collection names.
 */

import { pb } from "./pocketbase";

export type ListParams = {
  page?: number;
  perPage?: number;
  sort?: string;
  filter?: string;
  expand?: string;
};

/**
 * Fetch a paginated list of records from a collection
 */
export async function getList<T = Record<string, unknown>>(
  collection: string,
  page = 1,
  perPage = 20,
  params?: Omit<ListParams, "page" | "perPage">
) {
  return pb.collection(collection).getList<T>(page, perPage, params);
}

/**
 * Fetch all records from a collection (use with caution for large datasets)
 */
export async function getFullList<T = Record<string, unknown>>(
  collection: string,
  params?: Omit<ListParams, "page" | "perPage">
) {
  return pb.collection(collection).getFullList<T>(params);
}

/**
 * Fetch a single record by ID
 */
export async function getOne<T = Record<string, unknown>>(
  collection: string,
  id: string,
  params?: { expand?: string }
) {
  return pb.collection(collection).getOne<T>(id, params);
}

/**
 * Create a new record
 */
export async function create<T = Record<string, unknown>>(
  collection: string,
  data: Record<string, unknown>
) {
  return pb.collection(collection).create<T>(data);
}

/**
 * Update an existing record
 */
export async function update<T = Record<string, unknown>>(
  collection: string,
  id: string,
  data: Record<string, unknown>
) {
  return pb.collection(collection).update<T>(id, data);
}

/**
 * Delete a record
 */
export async function remove(collection: string, id: string) {
  return pb.collection(collection).delete(id);
}
