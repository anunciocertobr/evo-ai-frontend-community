import type { CSSProperties } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import logoDark from '../assets/anuncio_certo_logo_dark.png';
import logoLight from '../assets/anuncio_certo_logo_light.png';

interface AppLogoProps {
  className?: string;
  alt?: string;
  style?: CSSProperties;
  forceTheme?: 'dark' | 'light';
}

export function AppLogo({ className, alt = 'Anuncio Certo CRM', style, forceTheme }: AppLogoProps) {
  const { theme } = useDarkMode();
  const effectiveTheme = forceTheme ?? theme;
  const src = effectiveTheme === 'dark' ? logoDark : logoLight;

  return <img src={src} alt={alt} className={className} style={style} />;
}
