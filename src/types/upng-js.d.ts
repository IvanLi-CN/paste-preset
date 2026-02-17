declare module "upng-js" {
  export interface UPNGDecodedFrame {
    delay?: number;
  }

  export interface UPNGDecodedImage {
    width: number;
    height: number;
    frames?: UPNGDecodedFrame[];
  }

  export function decode(buffer: ArrayBuffer): UPNGDecodedImage;

  export function toRGBA8(img: UPNGDecodedImage): ArrayBuffer[];

  export function encode(
    imgs: ArrayBuffer[],
    w: number,
    h: number,
    cnum: number,
    dels?: number[],
  ): ArrayBuffer;

  const UPNG: {
    decode: typeof decode;
    toRGBA8: typeof toRGBA8;
    encode: typeof encode;
  };

  export default UPNG;
}
