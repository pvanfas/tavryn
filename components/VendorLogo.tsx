"use client";

import { Camera, Loader2 } from "lucide-react";
import React, { useRef, useState } from "react";

export interface VendorLogoProps {
  vendorId?: string | null;
  vendorName: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
  onLogoUpdated?: (newUrl: string) => void;
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-xs rounded-lg",
  md: "h-9 w-9 text-xs rounded-xl",
  lg: "h-12 w-12 text-sm rounded-2xl",
};

export function VendorLogo({
  vendorId,
  vendorName,
  logoUrl: initialLogoUrl,
  size = "md",
  editable = false,
  onLogoUpdated,
  className = "",
}: VendorLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl || null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = vendorName
    ? vendorName
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "V";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vendorId) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/vendors/${vendorId}/logo`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload logo");
      }

      const data = await res.json();
      if (data.logo_url) {
        setLogoUrl(data.logo_url);
        onLogoUpdated?.(data.logo_url);
      }
    } catch (err) {
      console.error("Logo upload failed:", err);
      alert((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <div
      className={`relative group shrink-0 border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#121915] overflow-hidden flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 shadow-2xs select-none ${sizeClass} ${className}`}
      title={editable ? `Click to upload ${vendorName} logo` : vendorName}
    >
      {logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoUrl}
          alt={vendorName}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span className="tracking-tight">{initials}</span>
      )}

      {/* Uploading Spinner */}
      {uploading && (
        <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center text-white z-10">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {/* Editable Overlay */}
      {editable && vendorId && !uploading && (
        <label
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity z-10"
        >
          <Camera className="h-3.5 w-3.5 text-white/90 drop-shadow-sm" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      )}
    </div>
  );
}
