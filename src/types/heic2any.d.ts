declare module "heic2any" {
  export interface Heic2AnyOptions {
    blob: Blob;
    /**
     * Target MIME type, e.g. "image/jpeg" | "image/png" | "image/gif".
     */
    toType?: string;
    /**
     * Optional quality in the range [0, 1] for lossy targets.
     */
    quality?: number;
    /**
     * When true, returns an array of Blobs (one per frame).
     */
    multiple?: boolean;
  }

  export type Heic2AnyResult = Blob | Blob[];

  export default function heic2any(
    options: Heic2AnyOptions,
  ): Promise<Heic2AnyResult>;
}
