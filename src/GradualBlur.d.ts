import type { CSSProperties, RefObject } from 'react';

/** Props for the official React Bits JavaScript + CSS component. */
export type GradualBlurProps = {
  position?: 'top' | 'bottom' | 'left' | 'right';
  target?: 'parent' | 'page';
  height?: string | number;
  width?: string | number;
  strength?: number;
  layers?: number;
  curve?: 'linear' | 'bezier' | 'ease-in' | 'ease-out' | 'ease-in-out';
  exponential?: boolean;
  opacity?: number;
  saturation?: number;
  tint?: string;
  autoHide?: boolean;
  container?: string | Element | RefObject<Element | null>;
  hoverIntensity?: number;
  duration?: string | number;
  easing?: string;
  zIndex?: number;
  className?: string;
  style?: CSSProperties;
};

export default function GradualBlur(props: GradualBlurProps): React.JSX.Element;
