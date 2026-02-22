import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: 'purple' | 'teal' | 'none';
}

export function Card({ children, className, glow = 'none' }: CardProps) {
  return (
    <div
      className={cn(
        'bg-[#12122A] border border-[#1E1E3F] rounded-xl p-4',
        glow === 'purple' && 'shadow-[0_0_20px_rgba(108,99,255,0.15)]',
        glow === 'teal' && 'shadow-[0_0_20px_rgba(0,201,167,0.15)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3', className)}>{children}</div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-sm font-semibold text-slate-300 uppercase tracking-wider', className)}>
      {children}
    </h3>
  );
}
