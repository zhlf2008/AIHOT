import { imageSize } from "image-size";
import { PhotonImage, SamplingFilter, crop, resize, rotate, fliph, flipv } from "@cf-wasm/photon";
import { Resvg } from "@cf-wasm/resvg/legacy";
import { IMAGE_WIDTHS } from "@aihot/backend/media/renditions";

export function metadata(body: Uint8Array) {
  const info = imageSize(body);
  const format = info.type === "jpg" ? "jpeg" : info.type;
  const mediaType = format === "svg" ? "image/svg+xml" : `image/${format}`;
  return { ...info, format, mediaType };
}

/** Preserve animations and compact SVGs. Raster work is bounded for the Worker's memory limit. */
export function transform(body: Uint8Array, mode: string, vectors = true): { body: Uint8Array; type: string } {
  const info = metadata(body);
  const bytes = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  const animated = info.format === "gif" || (info.format === "webp" && bytes.subarray(12,16).toString() === "VP8X" && !!(bytes[20]! & 2)) || (info.format === "png" && bytes.includes(Buffer.from("acTL")));
  if (animated || info.format === "avif") return { body, type: info.mediaType };
  const avatar = mode === "avatar" || mode.startsWith("avatar-");
  const width = IMAGE_WIDTHS[mode as keyof typeof IMAGE_WIDTHS];
  if (!width) throw new Error("Unknown image rendition");
  if (info.format === "svg" && vectors && !avatar && (body.length <= 128 * 1024 || info.width < width)) return { body, type: info.mediaType };
  if (!(info.width > 0 && info.height > 0) || info.width * info.height > 8_000_000) throw new Error("Image exceeds the edge raster limit");
  if (info.format === "svg") {
    const svg = new Resvg(body, { fitTo: { mode: "width", value: width } });
    try {
      const rendered = svg.render();
      try { body = rendered.asPng(); } finally { rendered.free(); }
    } finally { svg.free(); }
  }
  let image = PhotonImage.new_from_byteslice(body);
  const replace = (next: PhotonImage) => { image.free(); image = next; };
  try {
    const orientation = info.orientation ?? 1;
    if ([3,4].includes(orientation)) replace(rotate(image, 180));
    if ([5,6,7].includes(orientation)) replace(rotate(image, 90));
    if (orientation === 8) replace(rotate(image, 270));
    if ([2,4,5].includes(orientation)) fliph(image);
    if (orientation === 7) flipv(image);
    if (avatar) {
      const side = Math.min(image.get_width(), image.get_height());
      const x = Math.floor((image.get_width()-side)/2), y = Math.floor((image.get_height()-side)/2);
      replace(crop(image, x, y, x+side, y+side));
      replace(resize(image, width, width, SamplingFilter.Lanczos3));
    } else if (image.get_width() > width) {
      replace(resize(image, width, Math.max(1,Math.round(image.get_height()*width/image.get_width())), SamplingFilter.Lanczos3));
    }
    return info.format === "jpeg"
      ? { body: image.get_bytes_jpeg(82), type: "image/jpeg" }
      : { body: image.get_bytes_webp(), type: "image/webp" };
  } finally { image.free(); }
}
