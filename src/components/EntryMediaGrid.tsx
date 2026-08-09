import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { EntryAttachment } from "@/lib/types";

export function EntryMediaGrid({
  attachments,
  entryHref,
  detail = false,
}: {
  attachments: EntryAttachment[];
  entryHref?: string;
  detail?: boolean;
}) {
  const images = attachments.filter((attachment) => attachment.mimeType.startsWith("image/"));
  if (!images.length) return null;

  const visibleImages = images.slice(0, 3);
  const imageCount = visibleImages.length;
  const content = (
    <div
      className={cn(
        "grid overflow-hidden bg-stone",
        detail ? "h-[300px] sm:h-[420px]" : "h-[220px] sm:h-[300px]",
        imageCount === 1 ? "grid-cols-1" : "grid-cols-2",
        imageCount >= 3 && "grid-rows-2",
      )}
    >
      {visibleImages.map((attachment, index) => (
        <div
          key={attachment.id}
          className={cn(
            "relative min-h-0 overflow-hidden border-hairline bg-stone",
            imageCount >= 3 && index === 0 && "row-span-2",
            index > 0 && "border-l",
            imageCount >= 3 && index > 1 && "border-t",
          )}
        >
          <Image
            src={`/api/attachments/${attachment.id}?inline=1`}
            alt={attachment.originalFilename}
            fill
            unoptimized
            sizes={detail ? "(max-width: 768px) 100vw, 900px" : "(max-width: 768px) 100vw, 760px"}
            className="object-cover transition duration-500 group-hover/media:scale-[1.015]"
          />
          {index === visibleImages.length - 1 && images.length > visibleImages.length ? (
            <span className="absolute inset-0 flex items-center justify-center bg-ink/55 text-lg font-semibold text-white">
              +{images.length - visibleImages.length}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );

  return entryHref ? (
    <Link href={entryHref} className="group/media focus-ring block" aria-label="Open entry media">
      {content}
    </Link>
  ) : content;
}
