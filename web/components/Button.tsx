import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary";

type CommonProps = {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: never;
  };

type ButtonAsLink = CommonProps & {
  href: string;
  disabled?: boolean;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function isLink(props: ButtonProps): props is ButtonAsLink {
  return typeof props.href === "string";
}

// design.md §5 Buttons: primary = solid #FF6B00 (primary-container) / white
// text / 16px radius; secondary = transparent / 2px #233148 (tertiary-dark)
// border. 16px radius is Tailwind `rounded-lg` per the ported borderRadius
// scale (lg: 1rem is the card/sheet corner token; 1rem === 16px at the
// default root font size, matching design.md's "button: 16px").
const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 font-title-md text-title-md transition-opacity disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary-container text-on-primary shadow-sm active:opacity-90",
  secondary: "border-2 border-tertiary-dark bg-transparent text-tertiary-dark active:opacity-70",
};

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Button(props: ButtonProps) {
  const { variant = "primary", loading = false, children, className = "" } = props;
  const classes = `${base} ${variants[variant]} ${className}`;

  if (isLink(props)) {
    const { href, disabled } = props;
    if (disabled) {
      return (
        <span className={`${classes} pointer-events-none opacity-50`} aria-disabled="true">
          {loading && <Spinner />}
          {children}
        </span>
      );
    }
    return (
      <Link href={href} className={classes}>
        {loading && <Spinner />}
        {children}
      </Link>
    );
  }

  const { variant: _v, loading: _l, children: _c, className: _cn, ...rest } = props;
  return (
    <button {...rest} className={classes} disabled={rest.disabled || loading}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}
