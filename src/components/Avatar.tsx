"use client";

/** A round profile picture, or the person's first initial when they have none. */
export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {url ? <img src={url} alt="" width={size} height={size} loading="lazy" /> : name.charAt(0).toUpperCase()}
    </span>
  );
}
