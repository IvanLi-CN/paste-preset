import type { ReactNode } from "react";

type BrandHeaderProps = {
  title: string;
  tagline: string;
  action?: ReactNode;
  logoSrc?: string;
  darkLogoSrc?: string;
};

export function BrandHeader({
  title,
  tagline,
  action,
  logoSrc = "/brand/paste-preset-logo.svg",
  darkLogoSrc,
}: BrandHeaderProps) {
  const resolvedDarkLogoSrc =
    darkLogoSrc ?? "/brand/paste-preset-logo-dark.svg";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0">
            <span className="sr-only">{title}</span>
            <span className="brand-header-logo inline-grid max-w-full">
              <img
                src={logoSrc}
                alt=""
                aria-hidden="true"
                className="brand-header-logo-image brand-header-logo-light h-10 w-auto max-w-full [grid-area:1/1] sm:h-12"
              />
              <img
                src={resolvedDarkLogoSrc}
                alt=""
                aria-hidden="true"
                className="brand-header-logo-image brand-header-logo-dark h-10 w-auto max-w-full [grid-area:1/1] sm:h-12"
              />
            </span>
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-base-content/70">
            {tagline}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
