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
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  return (
    <div
      className="grid place-items-center rounded-full bg-blue-100 font-semibold text-blue-700"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </div>
  );
}
