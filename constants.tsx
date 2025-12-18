
import React from 'react';

export const APP_NAME = 'musijnet';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="#ee1d23"/>
    <ellipse cx="25" cy="55" rx="15" ry="25" fill="white"/>
    <ellipse cx="75" cy="55" rx="15" ry="25" fill="white"/>
    <circle cx="40" cy="55" r="15" fill="#c1c1c1"/>
    <circle cx="60" cy="55" r="15" fill="#c1c1c1"/>
    <circle cx="50" cy="55" r="8" fill="#808080"/>
  </svg>
);
