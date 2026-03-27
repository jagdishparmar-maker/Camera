import { ClientResponseError } from "pocketbase";

/** True when the SDK aborted the request (e.g. duplicate in-flight request auto-cancelled). */
export function isPocketBaseAbortError(err: unknown): err is ClientResponseError {
  return err instanceof ClientResponseError && err.isAbort;
}
