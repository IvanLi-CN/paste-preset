declare module "piexifjs" {
  interface GPSHelper {
    degToDmsRational(deg: number): [number, number][];
    dmsRationalToDeg(
      dms: [number, number][],
      ref: "N" | "S" | "E" | "W",
    ): number;
  }

  interface PiexifModule {
    version: string;
    load(data: string): unknown;
    dump(exif: unknown): string;
    insert(exif: string, jpegData: string): string;
    remove(jpegData: string): string;
    ImageIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    GPSIFD: Record<string, number>;
    GPSHelper: GPSHelper;
  }

  const piexif: PiexifModule;
  export default piexif;
}
