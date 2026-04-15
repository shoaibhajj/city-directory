"use client";

import { useRef, useState, useCallback } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface CoverCropperProps {
  /** Object URL of the selected file — caller must revoke it on close */
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

// 16:9 enforces consistent cover image display across all listing cards
const COVER_ASPECT = 16 / 9;

export function CoverCropper({
  imageSrc,
  onConfirm,
  onCancel,
}: CoverCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    // Start with a centered 90% crop in the correct aspect ratio
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, COVER_ASPECT, w, h),
      w,
      h,
    );
    setCrop(initialCrop);
  }

  const handleConfirm = useCallback(async () => {
    if (!completedCrop || !imgRef.current) return;
    setIsProcessing(true);

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsProcessing(false);
      return;
    }

    // Scale crop coordinates from display size to natural (full-resolution) size
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = Math.floor(completedCrop.width * scaleX);
    canvas.height = Math.floor(completedCrop.height * scaleY);

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
        setIsProcessing(false);
      },
      "image/jpeg",
      0.95,
    );
  }, [completedCrop, onConfirm]);

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>اقتصاص صورة الغلاف</DialogTitle>
          <DialogDescription>
            اسحب الإطار لاختيار المنطقة التي ستظهر كغلاف للمنشأة (نسبة 16:9)
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto max-h-[60vh] rounded-md">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={COVER_ASPECT}
            minWidth={200}
            className="w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="صورة لاقتصاصها"
              onLoad={onImageLoad}
              className="max-w-full block"
            />
          </ReactCrop>
        </div>

        <DialogFooter className="gap-2" dir="rtl">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            إلغاء
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || !completedCrop}
          >
            {isProcessing ? "جارٍ التهيئة..." : "تأكيد الاقتصاص"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
