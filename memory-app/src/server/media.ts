import sharp from "sharp";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "./security";
import type { Repository } from "./repository";
export async function savePhoto(
  repo: Repository,
  owner: string,
  bytes: Buffer,
  interviewId: string | null = null,
) {
  if (bytes.length > 10 * 1024 * 1024 || !bytes.length)
    throw new AppError("사진은 10MB 이하로 선택해 주세요.", 413);
  let output: Buffer;
  try {
    const image = sharp(bytes, { limitInputPixels: 24000000, animated: false });
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? ""))
      throw Error("format");
    output = await image
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    throw new AppError("JPEG, PNG, WebP 사진 파일을 선택해 주세요.");
  }
  const id = randomUUID(),
    path = join(repo.dir, "media", id + ".jpg");
  await writeFile(path, output, { mode: 0o600 });
  try {
    repo.registerMedia(owner, id, path, "image/jpeg", interviewId);
  } catch (e) {
    await unlink(path);
    throw e;
  }
  return { id, url: "/api/media/" + id };
}
