/* eslint-disable @next/next/no-img-element */
export function Avatar({ name, image, size = 48 }: { name: string; image?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (image)
    return (
      <img
        src={image}
        alt={name}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover ring-1 ring-line-strong"
        style={{ width: size, height: size }}
      />
    );
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bg-accent/25 font-semibold text-accent-soft ring-1 ring-line-strong"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </div>
  );
}
