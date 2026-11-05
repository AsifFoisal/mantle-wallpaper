import type { ReactNode } from "react";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200 ${
        checked ? "border-champagne-400/50 bg-champagne-400/85" : "border-white/10 bg-white/[0.07]"
      }`}
    >
      <span
        className={`absolute top-[2px] size-[16px] rounded-full shadow-sm transition-all duration-200 ${
          checked ? "left-[19px] bg-ink-950" : "left-[2px] bg-mist-300"
        }`}
      />
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  inline,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "flex items-center justify-between gap-4 py-2.5" : "py-2.5"}>
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-mist-100/90">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] leading-snug text-mist-600">{hint}</div>}
      </div>
      <div className={inline ? "shrink-0" : "mt-2"}>{children}</div>
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mantle-range w-full"
        aria-label="Slider"
      />
      <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-mist-500">
        {format ? format(value) : value}
      </span>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1.5 rounded-[7px] transition-colors ${
            size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-[11.5px]"
          } ${value === o.value ? "bg-white/[0.09] text-mist-100 shadow-sm" : "text-mist-500 hover:text-mist-300"}`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  onEnter,
  autoFocus,
  inputRef,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onEnter?: () => void;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  maxLength?: number;
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEnter?.();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      autoFocus={autoFocus}
      spellCheck={false}
      className="w-full rounded-lg border border-white/[0.08] bg-black/25 px-2.5 py-1.5 text-[12.5px] text-mist-100 placeholder:text-mist-600 focus:border-champagne-400/45 focus:outline-none"
    />
  );
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  size = "md",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "solid" | "danger" | "accent";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    ghost: "border border-white/[0.08] bg-white/[0.035] text-mist-300 hover:bg-white/[0.07] hover:text-mist-100",
    solid: "border border-white/[0.1] bg-white/[0.11] text-mist-100 hover:bg-white/[0.16]",
    accent: "border border-champagne-400/30 bg-champagne-400/90 text-ink-950 hover:bg-champagne-300",
    danger: "border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/18",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg font-medium transition-colors disabled:opacity-40 ${styles} ${
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-t border-white/[0.05] py-3 first:border-t-0 first:pt-1">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mist-600">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
