import { Link2, MapPin, Phone, Video, type LucideProps } from "lucide-react";
import type { LocationOption } from "@/db/schema";

export function LocationIcon({ type, ...props }: { type: LocationOption["type"] } & LucideProps) {
  const Icon = type === "online" ? Video : type === "in_person" ? MapPin : type === "custom_link" ? Link2 : Phone;
  return <Icon size={16} strokeWidth={1.75} aria-hidden {...props} />;
}
