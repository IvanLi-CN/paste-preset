import type { ReactNode } from "react";

type BrandHeaderProps = {
  title: string;
  tagline: string;
  action?: ReactNode;
  logoSrc?: string;
};

export function BrandHeader({
  title,
  tagline,
  action,
  logoSrc = "/brand/paste-preset-logo.svg",
}: BrandHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0">
            <span className="sr-only">{title}</span>
            <img
              src={logoSrc}
              alt=""
              aria-hidden="true"
              className="h-10 w-auto max-w-full sm:h-12"
            />
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
