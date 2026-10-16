import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { metadata, transform } from "../media/transform.ts";

test("edge image renditions keep proportions, crop avatars, and retain real image types", async () => {
  const png = await sharp({ create: { width: 1200, height: 600, channels: 4, background: { r: 12, g: 80, b: 90, alpha: 0.5 } } }).png().toBuffer();
  const card = transform(png, "card");
  assert.equal(card.type,"image/webp");
  const c = metadata(card.body);
  assert.equal(c.width,336);assert.equal(c.height,168);
  const avatar = metadata(transform(png,"avatar").body);
  assert.equal(avatar.width,96);assert.equal(avatar.height,96);
  const small = await sharp(png).resize(30,15).png().toBuffer();
  assert.equal(metadata(transform(small,"full").body).width,30,"body images never enlarge");
});

test("animations and compact vectors preserve bytes; raster bombs fail before decoding", () => {
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==","base64");
  const animation = transform(gif,"thumb");
  assert.equal(animation.type,"image/gif");assert.deepEqual(animation.body,gif);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="red"/></svg>');
  assert.deepEqual(transform(svg,"thumb").body,svg);
  const raster = transform(svg,"avatar");
  assert.equal(raster.type,"image/webp");assert.equal(metadata(raster.body).width,96);
  const large = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10000" height="10000"/>');
  assert.throws(()=>transform(large,"avatar"),/edge raster limit/);
  assert.throws(()=>transform(Buffer.from("<html>not an image</html>"),"thumb"));
});
