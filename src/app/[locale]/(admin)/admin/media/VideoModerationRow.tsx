"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  approveMediaAction,
  rejectMediaAction,
} from "@/features/media/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Type (matches getPendingVideos() include shape exactly) ──────────────────

interface VideoRow {
  id: string;
  url: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  createdAt: Date;
  business: {
    id: string;
    nameAr: string;
    nameEn: string | null;
    slug: string;
    ownerId: string;
    owner: { id: string; name: string | null; email: string };
    city: { slug: string } | null;
    category: { slug: string } | null;
  };
  uploadedBy: { id: string; name: string | null; email: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-SY", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VideoModerationRow({ video }: { video: VideoRow }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Row disappears after action — optimistic UI
  if (isDone) return null;

  const isProcessing = isApproving || isRejecting;
  const reasonLength = rejectReason.trim().length;
  const reasonValid = reasonLength >= 5;

  async function handleApprove() {
    setIsApproving(true);
    const result = await approveMediaAction(video.id);
    if (result.success) {
      toast.success(`تمت الموافقة على فيديو "${video.business.nameAr}"`);
      setIsDone(true);
    } else {
      toast.error(result.error);
      setIsApproving(false);
    }
  }

  async function handleReject() {
    if (!reasonValid) {
      toast.error("يجب أن يكون سبب الرفض 5 أحرف على الأقل");
      return;
    }
    setIsRejecting(true);
    const result = await rejectMediaAction(video.id, rejectReason.trim());
    if (result.success) {
      toast.success("تم رفض الفيديو وحذفه من Cloudinary وإشعار صاحب المنشأة");
      setIsDone(true);
      setIsRejectOpen(false);
    } else {
      toast.error(result.error);
      setIsRejecting(false);
    }
  }

  const publicListingUrl =
    video.business.city && video.business.category
      ? `/ar/${video.business.city.slug}/${video.business.category.slug}/${video.business.slug}`
      : null;

  return (
    <>
      <tr className="hover:bg-surface-offset/50 transition-colors align-middle">
        {/* ── Thumbnail + preview trigger ───────────────────────────────── */}
        <td className="p-3">
          <button
            onClick={() => setIsPreviewOpen(true)}
            disabled={!video.url}
            aria-label={`معاينة فيديو ${video.business.nameAr}`}
            className="relative w-28 aspect-video rounded-lg overflow-hidden bg-surface-offset
                       group border border-border disabled:opacity-40 disabled:cursor-not-allowed
                       focus-visible:outline-2 focus-visible:outline-primary"
          >
            {video.thumbnailUrl ? (
              <Image
                src={video.thumbnailUrl}
                alt=""
                fill
                className="object-cover"
                sizes="112px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Play className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            {/* Hover overlay */}
            <div
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100
                         flex items-center justify-center transition-opacity"
            >
              <Play className="w-6 h-6 text-white fill-white" />
            </div>
            {/* Duration badge */}
            {video.durationSeconds && (
              <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded tabular-nums">
                {formatDuration(video.durationSeconds)}
              </span>
            )}
          </button>
        </td>

        {/* ── Listing info ──────────────────────────────────────────────── */}
        <td className="p-3">
          <div className="flex items-start gap-1.5">
            <div>
              <p className="font-medium text-foreground leading-snug">
                {video.business.nameAr}
              </p>
              {video.business.nameEn && (
                <p className="text-xs text-muted-foreground">
                  {video.business.nameEn}
                </p>
              )}
              {publicListingUrl && (
                <a
                  href={publicListingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                >
                  عرض الصفحة
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </td>

        {/* ── Uploader info ─────────────────────────────────────────────── */}
        <td className="p-3 hidden md:table-cell">
          <p className="text-sm text-foreground">
            {video.uploadedBy.name ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {video.uploadedBy.email}
          </p>
        </td>

        {/* ── Duration ─────────────────────────────────────────────────── */}
        <td className="p-3 tabular-nums text-sm text-foreground">
          {formatDuration(video.durationSeconds)}
        </td>

        {/* ── Upload date ──────────────────────────────────────────────── */}
        <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(video.createdAt)}
        </td>

        {/* ── Action buttons ───────────────────────────────────────────── */}
        <td className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isProcessing}
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0 h-8 text-xs"
            >
              {isApproving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              قبول
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsRejectOpen(true)}
              disabled={isProcessing}
              className="gap-1.5 border-red-200 dark:border-red-800 text-red-600
                         dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 h-8 text-xs"
            >
              {isRejecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              رفض
            </Button>
          </div>
        </td>
      </tr>

      {/* ── Inline video preview modal ──────────────────────────────────────── */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="text-base">
              {video.business.nameAr}
            </DialogTitle>
            {video.business.nameEn && (
              <DialogDescription>{video.business.nameEn}</DialogDescription>
            )}
          </DialogHeader>
          <div className="px-4 pb-4">
            {video.url ? (
              <video
                src={video.url}
                controls
                autoPlay
                className="w-full rounded-lg aspect-video bg-black mt-3"
                // Prevent autoplay from making sound without user gesture
                muted={false}
              />
            ) : (
              <div className="aspect-video flex items-center justify-center bg-surface-offset rounded-lg mt-3">
                <p className="text-sm text-muted-foreground">
                  الفيديو غير متاح للمعاينة
                </p>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <Button
                onClick={handleApprove}
                disabled={isProcessing}
                className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
              >
                {isApproving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                قبول الفيديو
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsPreviewOpen(false);
                  setIsRejectOpen(true);
                }}
                disabled={isProcessing}
                className="gap-1.5 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
              >
                <XCircle className="w-4 h-4" />
                رفض الفيديو
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reject reason modal ─────────────────────────────────────────────── */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض الفيديو</DialogTitle>
            <DialogDescription>
              سيتم حذف الفيديو من Cloudinary فوراً وإشعار صاحب المنشأة بالسبب.
              هذا الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div>
              <label
                htmlFor="reject-reason"
                className="text-sm font-medium text-foreground mb-1.5 block"
              >
                سبب الرفض
                <span className="text-destructive mr-1">*</span>
              </label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setRejectReason(e.target.value)
                }
                placeholder="مثال: المحتوى لا يمثل المنشأة، جودة منخفضة جداً، محتوى مخالف..."
                rows={4}
                dir="rtl"
                maxLength={500}
                className="resize-none"
              />
              <p
                className={`text-xs mt-1 text-left tabular-nums ${
                  reasonLength > 450
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {reasonLength} / 500
              </p>
            </div>

            {/* Preview of what owner will see */}
            {reasonValid && (
              <div className="rounded-lg bg-surface-offset border border-border p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  سيصل هذا الإشعار لصاحب المنشأة:
                </p>
                <p>
                  &ldquo;تم رفض فيديو منشأتك &quot;{video.business.nameAr}
                  &quot;. السبب: {rejectReason.trim()}&rdquo;
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectOpen(false);
                setRejectReason("");
              }}
              disabled={isRejecting}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting || !reasonValid}
              className="gap-1.5"
            >
              {isRejecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              تأكيد الرفض وحذف الفيديو
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
