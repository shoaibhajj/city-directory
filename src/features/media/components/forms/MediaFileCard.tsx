"use client";

import Image from "next/image";
import { useState } from "react";
import { Trash2, Clock, CheckCircle, XCircle, Video } from "lucide-react";
import { MediaStatus, MediaType } from "@prisma/client";
import { deleteMediaAction } from "@/features/media/actions";
import { Badge } from "@/components/ui/badge";

export interface MediaItem {
  id: string;
  type: MediaType;
  status: MediaStatus;
  url: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  rejectionReason: string | null;
  progress?: number; // 0–100, only present while uploading
}

interface MediaFileCardProps extends MediaItem {
  onDeleted: (id: string) => void;
}

const statusConfig = {
  [MediaStatus.APPROVED]: {
    label: "مقبول",
    icon: CheckCircle,
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  [MediaStatus.PENDING]: {
    label: "قيد المراجعة",
    icon: Clock,
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  [MediaStatus.REJECTED]: {
    label: "مرفوض",
    icon: XCircle,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function MediaFileCard({
  id,
  type,
  status,
  url,
  thumbnailUrl,
  durationSeconds,
  rejectionReason,
  progress,
  onDeleted,
}: MediaFileCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const isUploading = progress !== undefined && progress < 100;
  const previewUrl = thumbnailUrl ?? url;

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  async function handleDelete() {
    if (
      !confirm("هل أنت متأكد من حذف هذا الملف؟ لا يمكن التراجع عن هذا الإجراء.")
    )
      return;
    setIsDeleting(true);
    const result = await deleteMediaAction(id);
    if (result.success) {
      onDeleted(id);
    } else {
      alert(result.error);
      setIsDeleting(false);
    }
  }

  // Temp upload items have id starting with "temp-"
  const isTempItem = id.startsWith("temp-");

  const durationLabel =
    durationSeconds != null
      ? `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}`
      : null;

  return (
    <div className="group relative rounded-lg overflow-hidden border border-border bg-card shadow-sm">
      {/* Thumbnail area */}
      <div className="aspect-video bg-muted relative">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            {type === MediaType.VIDEO ? (
              <Video className="w-8 h-8" />
            ) : (
              <div className="w-10 h-10 rounded bg-border" />
            )}
          </div>
        )}

        {/* Upload progress overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 px-4">
            <span className="text-white text-sm font-medium tabular-nums">
              {progress ?? 0}%
            </span>
            <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-150"
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>
            <span className="text-white/70 text-xs">جارٍ الرفع...</span>
          </div>
        )}

        {/* Processing overlay — upload done, waiting for server confirmation */}
        {!isUploading &&
          progress === 100 &&
          status === MediaStatus.PENDING &&
          !url && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-xs">جارٍ المعالجة...</span>
            </div>
          )}

        {/* Video duration badge */}
        {type === MediaType.VIDEO && durationLabel && (
          <span className="absolute bottom-1 end-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded tabular-nums">
            {durationLabel}
          </span>
        )}

        {/* Delete button — shown on hover, hidden during upload */}
        {!isUploading && !isTempItem && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="حذف الملف"
            className="absolute top-1 start-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100
                       transition-opacity bg-destructive hover:bg-destructive/90 text-destructive-foreground
                       p-1 rounded-md disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Status footer */}
      <div className="px-2 py-1.5 space-y-1">
        <Badge
          variant="outline"
          className={`gap-1 text-xs ${config.className}`}
        >
          <StatusIcon className="w-3 h-3" />
          {config.label}
        </Badge>

        {status === MediaStatus.REJECTED && rejectionReason && (
          <p className="text-xs text-destructive line-clamp-2">
            {rejectionReason}
          </p>
        )}

        {type === MediaType.VIDEO &&
          status === MediaStatus.PENDING &&
          !isUploading && (
            <p className="text-xs text-muted-foreground">
              يظهر للزوار بعد موافقة المشرف
            </p>
          )}
      </div>
    </div>
  );
}
