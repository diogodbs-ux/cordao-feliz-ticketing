import { useEffect, useState } from 'react';
import { getBranding, getLogoSrc, subscribeBranding } from '@/lib/branding';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  alt?: string;
  /** Se true, mostra iniciais em fallback quando não há logo (útil no header). */
  fallbackInitials?: boolean;
}

/**
 * Componente reativo que reflete a customização de logo em tempo real.
 * Usado em Layout, Login e páginas públicas.
 */
export default function BrandLogo({ className, alt, fallbackInitials }: BrandLogoProps) {
  const [src, setSrc] = useState(getLogoSrc());
  const [name, setName] = useState(getBranding().orgName);

  useEffect(() => subscribeBranding(() => {
    setSrc(getLogoSrc());
    setName(getBranding().orgName);
  }), []);

  if (!src) {
    if (!fallbackInitials) return null;
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return (
      <div className={cn('flex items-center justify-center bg-primary/10 text-primary font-bold rounded-lg', className)}>
        {initials}
      </div>
    );
  }

  return <img src={src} alt={alt ?? name} className={className} />;
}
