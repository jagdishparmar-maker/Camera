/**
 * PocketBase File Storage utilities
 *
 * For uploading files from React Native, use the uri-based format:
 * { uri: string, type: string, name: string }
 */

import { pb } from "./pocketbase";

export type FileInput =
  | Blob
  | File
  | { uri: string; type: string; name: string };

/**
 * Get the public URL for a file stored in PocketBase
 *
 * @param record - The record object (must have id and collectionId)
 * @param filename - The file field value (filename)
 * @param thumb - Optional thumb size (e.g. "100x100")
 */
export function getFileUrl(
  record: { id: string; collectionId?: string; [key: string]: unknown },
  filename: string,
  thumb?: string
): string {
  if (!filename) return "";
  return pb.files.getURL(record, filename, thumb ? { thumb } : {});
}

/**
 * Upload a file to a record
 *
 * Use with create() or update() - pass the file in the data object:
 *
 * @example
 * // Creating a new record with a file
 * const record = await create('posts', {
 *   title: 'My Post',
 *   image: {
 *     uri: 'file:///path/to/image.jpg',
 *     type: 'image/jpeg',
 *     name: 'photo.jpg'
 *   }
 * });
 *
 * @example
 * // Updating a record with a new file
 * await update('posts', recordId, {
 *   image: {
 *     uri: 'file:///path/to/new-image.jpg',
 *     type: 'image/jpeg',
 *     name: 'photo.jpg'
 *   }
 * });
 */

/**
 * Delete a file from a record
 * Update the record with null/empty for the file field
 */
export async function deleteFile(
  collection: string,
  recordId: string,
  fieldName: string
) {
  return pb.collection(collection).update(recordId, {
    [fieldName]: null,
  });
}
