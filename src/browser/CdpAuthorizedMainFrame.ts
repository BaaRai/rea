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
  let lastUrl: string | undefined;
  let lastResult: unknown;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await connection.send(
      "Page.getFrameTree",
      {},
      sessionId,
      signal,
    );
    lastResult = result;
    lastUrl = mainFrameUrl(result);
    if (allowedSanitizedUrl(lastUrl, allowedOrigins) !== undefined)
      return result;
    if (isHttpUrl(lastUrl))
      throw new BrowserObservationError(operation, "target_not_allowed");
    await delayWithCancellation(25, operation, signal);
  }
  // Masked Chromium builds report an unparseable placeholder forever, so an
  // observable origin never arrives; once the commit wait is exhausted the
  // attach-authorized target URL stands in. Pre-commit placeholders resolve
  // above, and parseable non-HTTP pages such as about:blank keep failing.
  if (
    isUnparseableFrameUrl(lastUrl) &&
    authorizedTargetUrl !== undefined &&
    allowedSanitizedUrl(authorizedTargetUrl, allowedOrigins) !== undefined
  )
    return lastResult;
  throw new BrowserObservationError(operation, "target_not_allowed");
};
