import type { BrowserObservationOperation } from "../domain/browserObservationErrors.js";
import { BrowserObservationError } from "../domain/browserObservationError.js";
import type { CdpConnection } from "./CdpConnection.js";
import { mainFrameUrl } from "./CdpCaptureDocuments.js";
import {
  allowedSanitizedUrl,
  delayWithCancellation,
  isHttpUrl,
  isUnparseableFrameUrl,
} from "./CdpCaptureValues.js";

interface AuthorizedMainFrameOptions {
  readonly connection: CdpConnection;
  readonly sessionId: string | undefined;
  readonly signal: AbortSignal | undefined;
  readonly allowedOrigins: ReadonlySet<string>;
  readonly operation: BrowserObservationOperation;
  readonly authorizedTargetUrl?: string;
}

/** Wait for the attached target's main frame to enter its approved origin. */
export const authorizedMainFrame = async ({
  connection,
  sessionId,
  signal,
  allowedOrigins,
  operation,
  authorizedTargetUrl,
}: AuthorizedMainFrameOptions): Promise<unknown> => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await connection.send(
      "Page.getFrameTree",
      {},
      sessionId,
      signal,
    );
    const url = mainFrameUrl(result);
    if (allowedSanitizedUrl(url, allowedOrigins) !== undefined) return result;
    if (isHttpUrl(url))
      throw new BrowserObservationError(operation, "target_not_allowed");
    // Chromium 150 reports an unparseable placeholder as the frame-tree URL,
    // so an observable origin never arrives; the attach-authorized target URL
    // stands in. Parseable non-HTTP pages such as about:blank keep waiting.
    if (
      isUnparseableFrameUrl(url) &&
      authorizedTargetUrl !== undefined &&
      allowedSanitizedUrl(authorizedTargetUrl, allowedOrigins) !== undefined
    )
      return result;
    await delayWithCancellation(25, operation, signal);
  }
  throw new BrowserObservationError(operation, "target_not_allowed");
};
