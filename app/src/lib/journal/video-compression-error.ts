export type VideoCompressionCode =
  | "unsupported"
  | "no_video"
  | "empty"
  | "no_h264"
  | "convert"
  | "failed";

/**
 * Kept apart from the encoder so the upload path can check for it without
 * importing the video library, which is only loaded when a clip is attached.
 * `code` lets the UI show the message in the user's language.
 */
export class VideoCompressionError extends Error {
  readonly code: VideoCompressionCode;
  constructor(code: VideoCompressionCode, message: string) {
    super(message);
    this.name = "VideoCompressionError";
    this.code = code;
  }
}
