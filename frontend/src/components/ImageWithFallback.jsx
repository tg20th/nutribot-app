import { useState } from 'react';
import fallbackImage from '../assets/hero-bowl.jpg';

export default function ImageWithFallback({ src, fallbackSrc = fallbackImage, alt = '', ...props }) {
  const [failedSource, setFailedSource] = useState(null);
  const failed = failedSource === src;
  const imageSrc = failed ? fallbackSrc : src;

  if (!imageSrc) return null;

  return <img {...props} src={imageSrc} alt={alt} onError={() => {
    if (!failed) setFailedSource(src);
  }} />;
}
