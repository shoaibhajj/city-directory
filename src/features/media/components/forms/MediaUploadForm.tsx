"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, ImagePlus, Video, AlertTriangle } from "lucide-react";
import { MediaStatus, MediaType } from "@prisma/client";
import {
  generatePresignedUrlAction,
  confirmUploadAction,
} from "@/features/media/actions";
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
} from "@/features/media/validators";
import { MediaFileCard } from "./MediaFileCard";
import { CoverCropper } from "./CoverCropper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaItem {
  id: string;
  type: MediaType;
  status: MediaStatus;
  url: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  rejectionReason: string | null;
  /** 0–100, only set during the XHR upload phase */
  progress?: number;
}

interface MediaUploadFormProps {
  listingId: string;
  initialMedia: MediaItem[];
}

// ─── Cloudinary upload via XHR ────────────────────────────────────────────────
//
// WHY XHR instead of fetch()?
// The Streams API (used by fetch) does NOT expose upload progress.
// XHR's XMLHttpRequestUpload fires 'progress' events — the only way to get
// per-file progress bars without a chunked upload library.

interface CloudinarySignParams {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
}

function uploadToCloudinary(
  file: Blob,
  params: CloudinarySignParams,
  resourceType: "image" | "video",
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("signature", params.signature);
    form.append("timestamp", String(params.timestamp));
    form.append("api_key", params.apiKey);
    form.append("folder", params.folder);
    form.append("public_id", params.publicId);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { public_id: string };
          resolve(data.public_id);
        } catch {
          reject(new Error("Invalid JSON from Cloudinary"));
        }
      } else {
        reject(new Error(`Cloudinary upload failed: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Network error during Cloudinary upload")),
    );
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${params.cloudName}/${resourceType}/upload`,
    );
    xhr.send(form);
  });
}

// ─── Client-side validation (UX hint only — server always re-validates) ────────

function clientValidateImage(file: File): string | null {
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `حجم الصورة يتجاوز ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) {
    return "يُسمح فقط بصور JPEG, PNG, WebP";
  }
  return null;
}

function clientValidateVideo(file: File): string | null {
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return `حجم الفيديو يتجاوز ${MAX_VIDEO_SIZE_BYTES / 1024 / 1024}MB`;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "mp4") return "يُسمح فقط بملفات MP4";
  return null;
}

// ─── Dropzone zone sub-component ─────────────────────────────────────────────

interface DropZoneProps {
  isDragActive: boolean;
  getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
  icon: React.ReactNode;
  title: string;
  hint: string;
  disabled?: boolean;
  disabledMessage?: string;
}

function DropZone({
  isDragActive,
  getRootProps,
  getInputProps,
  icon,
  title,
  hint,
  disabled,
  disabledMessage,
}: DropZoneProps) {
  if (disabled) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border bg-surface-offset p-8 text-center opacity-60 cursor-not-allowed">
        <AlertTriangle className="mx-auto w-7 h-7 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{disabledMessage}</p>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={[
        "rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-150",
        isDragActive
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border bg-surface hover:border-primary/60 hover:bg-surface-offset",
      ].join(" ")}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-2">
        <div className="p-3 rounded-full bg-surface-offset text-muted-foreground">
          {icon}
        </div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const MAX_PHOTOS = 10; // matches PlatformSetting default — enforced on server too

export function MediaUploadForm({
  listingId,
  initialMedia,
}: MediaUploadFormProps) {
  const [items, setItems] = useState<MediaItem[]>(initialMedia);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // ── State helpers ──────────────────────────────────────────────────────────

  function addPendingItem(tempId: string, type: MediaType) {
    setItems((prev) => [
      ...prev,
      {
        id: tempId,
        type,
        status: MediaStatus.PENDING,
        url: null,
        thumbnailUrl: null,
        durationSeconds: null,
        rejectionReason: null,
        progress: 0,
      },
    ]);
  }

  function setProgress(id: string, pct: number) {
    setItems((prev) =>
      prev.map((m) => (m.id === id ? { ...m, progress: pct } : m)),
    );
  }

  function replaceItem(
    tempId: string,
    realId: string,
    updates: Partial<MediaItem>,
  ) {
    setItems((prev) =>
      prev.map((m) =>
        m.id === tempId
          ? { ...m, id: realId, ...updates, progress: undefined }
          : m,
      ),
    );
  }

  function updateItem(id: string, updates: Partial<MediaItem>) {
    setItems((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, ...updates, progress: undefined } : m,
      ),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((m) => m.id !== id));
  }

  // ── Core upload orchestrator ───────────────────────────────────────────────

  async function processUpload(
    file: Blob,
    type: MediaType,
    resourceType: "image" | "video",
  ) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addPendingItem(tempId, type);

    try {
      // ── Phase A: get signature + create DB placeholder ──
      const signResult = await generatePresignedUrlAction(listingId, type);
      if (!signResult.success) {
        removeItem(tempId);
        toast.error(signResult.error);
        return;
      }

      const { mediaFileId, ...signParams } = signResult.data;

      // Swap tempId → real DB id immediately so delete works during upload
      replaceItem(tempId, mediaFileId, {});

      // ── Phase A cont: upload directly to Cloudinary via XHR ──
      const cloudinaryPublicId = await uploadToCloudinary(
        file,
        signParams,
        resourceType,
        (pct) => setProgress(mediaFileId, pct),
      );

      // Set to 100% before server processing starts (UX: shows completion)
      setProgress(mediaFileId, 100);

      // ── Phase B: server validates (magic bytes) + processes (Sharp) ──
      const confirmResult = await confirmUploadAction(
        mediaFileId,
        cloudinaryPublicId,
        resourceType,
      );

      if (!confirmResult.success) {
        removeItem(mediaFileId);
        toast.error(confirmResult.error);
        return;
      }

      updateItem(mediaFileId, {
        url: confirmResult.data.url,
        thumbnailUrl: confirmResult.data.thumbnailUrl ?? null,
        status: confirmResult.data.status,
      });

      if (confirmResult.data.status === MediaStatus.APPROVED) {
        toast.success(
          type === MediaType.COVER
            ? "تم رفع صورة الغلاف ومعالجتها"
            : type === MediaType.LOGO
              ? "تم رفع الشعار ومعالجته"
              : "تم رفع الصورة ومعالجتها بنجاح",
        );
      } else {
        toast.info("تم رفع الفيديو — سيظهر بعد موافقة المشرف", {
          duration: 5000,
        });
      }
    } catch (err) {
      removeItem(tempId);
      console.error("[MediaUploadForm] Upload error:", err);
      toast.error("حدث خطأ أثناء الرفع، يرجى المحاولة مرة أخرى");
    }
  }

  // ── Derived item lists ────────────────────────────────────────────────────

  const coverItems = items.filter((m) => m.type === MediaType.COVER);
  const logoItems = items.filter((m) => m.type === MediaType.LOGO);
  const photoItems = items.filter((m) => m.type === MediaType.PHOTO);
  const videoItems = items.filter((m) => m.type === MediaType.VIDEO);

  const hasCover = coverItems.some(
    (m) => m.status === MediaStatus.APPROVED || m.progress !== undefined,
  );
  const hasLogo = logoItems.some(
    (m) => m.status === MediaStatus.APPROVED || m.progress !== undefined,
  );
  const photoCount = photoItems.filter(
    (m) => m.status !== MediaStatus.REJECTED,
  ).length;
  const photosAtLimit = photoCount >= MAX_PHOTOS;

  // ── Dropzone drop handlers ────────────────────────────────────────────────

  const onDropCover = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const err = clientValidateImage(file);
      if (err) {
        toast.error(err);
        return;
      }
      // Show crop modal first
      const objectUrl = URL.createObjectURL(file);
      setCropSrc(objectUrl);
    },

    [],
  );

  const onDropLogo = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const err = clientValidateImage(file);
      if (err) {
        toast.error(err);
        return;
      }
      void processUpload(file, MediaType.LOGO, "image");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listingId],
  );

  const onDropPhotos = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const err = clientValidateImage(file);
        if (err) {
          toast.error(`${file.name}: ${err}`);
          return;
        }
        void processUpload(file, MediaType.PHOTO, "image");
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listingId],
  );

  const onDropVideo = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const err = clientValidateVideo(file);
      if (err) {
        toast.error(err);
        return;
      }
      void processUpload(file, MediaType.VIDEO, "video");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listingId],
  );

  // ── Dropzone instances ────────────────────────────────────────────────────

  const coverDropzone = useDropzone({
    onDrop: onDropCover,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 1,
    multiple: false,
    disabled: hasCover,
  });

  const logoDropzone = useDropzone({
    onDrop: onDropLogo,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxFiles: 1,
    multiple: false,
    disabled: hasLogo,
  });

  const photosDropzone = useDropzone({
    onDrop: onDropPhotos,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: true,
    disabled: photosAtLimit,
  });

  const videoDropzone = useDropzone({
    onDrop: onDropVideo,
    accept: { "video/mp4": [".mp4"] },
    maxFiles: 1,
    multiple: false,
  });

  // ── Cover crop confirm ────────────────────────────────────────────────────

  function handleCropConfirm(croppedBlob: Blob) {
    if (!cropSrc) return;
    URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    void processUpload(croppedBlob, MediaType.COVER, "image");
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" dir="rtl">
      {/* Cover image crop modal */}
      {cropSrc && (
        <CoverCropper
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      <Tabs defaultValue="cover" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto p-1">
          <TabsTrigger value="cover" className="text-xs sm:text-sm py-2">
            الغلاف
            {coverItems.length > 0 && (
              <span className="mr-1.5 w-4 h-4 rounded-full bg-primary/20 text-primary text-xs inline-flex items-center justify-center">
                {coverItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="logo" className="text-xs sm:text-sm py-2">
            الشعار
            {logoItems.length > 0 && (
              <span className="mr-1.5 w-4 h-4 rounded-full bg-primary/20 text-primary text-xs inline-flex items-center justify-center">
                {logoItems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="photos" className="text-xs sm:text-sm py-2">
            الصور
            {photoItems.length > 0 && (
              <span className="mr-1.5 w-4 h-4 rounded-full bg-primary/20 text-primary text-xs inline-flex items-center justify-center">
                {photoCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="videos" className="text-xs sm:text-sm py-2">
            فيديو
            {videoItems.length > 0 && (
              <span className="mr-1.5 w-4 h-4 rounded-full bg-primary/20 text-primary text-xs inline-flex items-center justify-center">
                {videoItems.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Cover Image ─────────────────────────────────────────────────── */}
        <TabsContent value="cover" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            صورة الغلاف تظهر في أعلى صفحة المنشأة بنسبة <strong>16:9</strong>.
            سيتم عرض أداة الاقتصاص لتحديد المنطقة الأفضل من الصورة. يُحول
            تلقائياً إلى WebP ويُجرَّد من بيانات EXIF.
          </p>

          {hasCover ? (
            <div className="rounded-xl border border-border bg-surface-offset px-4 py-3 text-sm text-muted-foreground">
              لديك صورة غلاف نشطة. احذفها أولاً لرفع صورة جديدة.
            </div>
          ) : (
            <DropZone
              isDragActive={coverDropzone.isDragActive}
              getRootProps={coverDropzone.getRootProps}
              getInputProps={coverDropzone.getInputProps}
              icon={<ImagePlus className="w-6 h-6" />}
              title="اسحب صورة الغلاف هنا أو انقر للاختيار"
              hint="JPEG · PNG · WebP — بحد أقصى 15MB"
            />
          )}

          {coverItems.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {coverItems.map((m) => (
                <MediaFileCard key={m.id} {...m} onDeleted={removeItem} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Logo ────────────────────────────────────────────────────────── */}
        <TabsContent value="logo" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            شعار المنشأة يظهر بجانب الاسم في بطاقة الدليل والصفحة الشخصية. يُنصح
            بصورة <strong>مربعة</strong> على خلفية شفافة أو بيضاء.
          </p>

          {hasLogo ? (
            <div className="rounded-xl border border-border bg-surface-offset px-4 py-3 text-sm text-muted-foreground">
              لديك شعار نشط. احذفه أولاً لرفع شعار جديد.
            </div>
          ) : (
            <DropZone
              isDragActive={logoDropzone.isDragActive}
              getRootProps={logoDropzone.getRootProps}
              getInputProps={logoDropzone.getInputProps}
              icon={<ImagePlus className="w-6 h-6" />}
              title="اسحب الشعار هنا أو انقر للاختيار"
              hint="JPEG · PNG · WebP — بحد أقصى 15MB — مربع مثالي"
            />
          )}

          {logoItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {logoItems.map((m) => (
                <MediaFileCard key={m.id} {...m} onDeleted={removeItem} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Photo Gallery ────────────────────────────────────────────────── */}
        <TabsContent value="photos" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              صور معرض المنشأة — تُحول إلى WebP وتُجرَّد من بيانات EXIF
              تلقائياً.
            </p>
            <span className="text-xs text-muted-foreground tabular-nums">
              {photoCount} / {MAX_PHOTOS}
            </span>
          </div>

          <DropZone
            isDragActive={photosDropzone.isDragActive}
            getRootProps={photosDropzone.getRootProps}
            getInputProps={photosDropzone.getInputProps}
            icon={<Upload className="w-6 h-6" />}
            title="اسحب الصور هنا أو انقر للاختيار"
            hint="يمكنك رفع عدة صور معاً · JPEG · PNG · WebP · بحد أقصى 15MB لكل صورة"
            disabled={photosAtLimit}
            disabledMessage={`وصلت للحد الأقصى (${MAX_PHOTOS} صور). احذف صورة لإضافة أخرى.`}
          />

          {photoItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photoItems.map((m) => (
                <MediaFileCard key={m.id} {...m} onDeleted={removeItem} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Videos ──────────────────────────────────────────────────────── */}
        <TabsContent value="videos" className="space-y-4 pt-4">
          {/* Admin review notice */}
          <div className="flex gap-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>تنبيه:</strong> الفيديوهات تستلزم مراجعة المشرف قبل ظهورها
              للزوار. المراجعة عادةً تستغرق أقل من 24 ساعة.
            </p>
          </div>

          <DropZone
            isDragActive={videoDropzone.isDragActive}
            getRootProps={videoDropzone.getRootProps}
            getInputProps={videoDropzone.getInputProps}
            icon={<Video className="w-6 h-6" />}
            title="اسحب ملف MP4 هنا أو انقر للاختيار"
            hint="MP4 فقط · بحد أقصى 500MB · مدة لا تتجاوز 5 دقائق"
          />

          {videoItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {videoItems.map((m) => (
                <MediaFileCard key={m.id} {...m} onDeleted={removeItem} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
