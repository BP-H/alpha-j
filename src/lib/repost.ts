import bus from "./bus";
import { fetchWithTimeout } from "./fetchWithTimeout";

export type Platform = 'x' | 'facebook' | 'linkedin';

/**
 * Repost content to a social platform.
 *
 * In development this will simply log the repost action. In production it will
 * call a backend endpoint responsible for interacting with the actual platform
 * APIs (X, Facebook, LinkedIn).
 *
 * @param platform The platform to repost to.
 * @param content The message or content to share.
 * @returns `true` when the request succeeds, otherwise `false`.
 */
export async function repost(
  platform: Platform,
  content: string
): Promise<boolean> {
  try {
    if (import.meta.env.PROD) {
      const res = await fetchWithTimeout(`/api/repost/${platform}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
        timeout: 10_000,
      });

      if (!res || !res.ok) {
        throw new Error(`Request failed${res ? ` with status ${res.status}` : ' due to timeout'}`);
      }
    } else {
      // eslint-disable-next-line no-console -- helpful during development
      console.log(`Reposting to ${platform}: ${content}`);
    }

    return true;
  } catch (err) {
    // eslint-disable-next-line no-console -- surface error for debugging
    const message = 'Repost failed';
    bus.emit?.('toast', { message });
    console.error(message, err);
    return false;
  }
}
