import Image from "next/image";

const sources = {
  orange: "/brand/personal-prime-symbol-orange.png",
  black: "/brand/personal-prime-symbol-black.png",
} as const;

export function BrandSymbol({ variant, size, className = "", priority = false }: {
  variant: keyof typeof sources;
  size: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={`shrink-0 rounded-[inherit] ${className}`}
      height={size}
      priority={priority}
      src={sources[variant]}
      unoptimized
      width={size}
    />
  );
}
