import React, { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface StudentAvatarProps {
  name: string;
  enrollmentNo?: string;
  photoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getInitials = (name: string) => {
  if (!name) return "NA";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const normalizePhotoUrl = (photoUrl?: string | null) => {
  if (!photoUrl) return "";
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://") || photoUrl.startsWith("/")) {
    return photoUrl;
  }
  return `/student-photos/${photoUrl}`;
};

export default function StudentAvatar({
  name,
  enrollmentNo,
  photoUrl,
  className,
  fallbackClassName,
  style,
}: StudentAvatarProps & { style?: React.CSSProperties }) {
  const imageCandidates = useMemo(() => {
    const candidates: string[] = [];

    const normalizedUrl = normalizePhotoUrl(photoUrl);
    if (normalizedUrl) candidates.push(normalizedUrl);

    if (enrollmentNo) {
      IMAGE_EXTENSIONS.forEach((ext) => {
        candidates.push(`/student-photos/${enrollmentNo}.${ext}`);
      });
    }

    const slug = toSlug(name);
    if (slug) {
      IMAGE_EXTENSIONS.forEach((ext) => {
        candidates.push(`/student-photos/${slug}.${ext}`);
      });
    }

    return Array.from(new Set(candidates));
  }, [photoUrl, enrollmentNo, name]);

  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [imageCandidates]);

  const currentSrc = imageCandidates[candidateIndex];

  return (
    <Avatar className={className} style={style}>
      {currentSrc ? (
        <AvatarImage
          src={currentSrc}
          alt={name}
          onError={() => {
            if (candidateIndex < imageCandidates.length - 1) {
              setCandidateIndex((prev) => prev + 1);
            }
          }}
        />
      ) : null}
      <AvatarFallback className={fallbackClassName}>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
