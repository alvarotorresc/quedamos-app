import { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color: string;
}

export function Badge({ color, children, className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${className}`}
      style={{
        background: `${color}12`,
        color,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
