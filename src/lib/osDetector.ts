/**
 * Detect client operating system
 */
export interface ClientOSInfo {
  isWindows: boolean;
  osName: string;
  canOpenNativeApp: boolean; // Windows users can open desktop app & view; others only view SVG
}

export function detectClientOS(): ClientOSInfo {
  if (typeof window === 'undefined') {
    return { isWindows: false, osName: 'Desconhecido', canOpenNativeApp: false };
  }

  const userAgent = window.navigator.userAgent;
  const platform = (window.navigator as any).userAgentData?.platform || window.navigator.platform || '';

  const isWindows = /Win/i.test(platform) || /Windows/i.test(userAgent);
  const isMac = /Mac/i.test(platform) || /Macintosh/i.test(userAgent);
  const isLinux = /Linux/i.test(platform) || /X11/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

  let osName = 'Outro Sistema';
  if (isWindows) osName = 'Windows';
  else if (isMac) osName = 'macOS';
  else if (isLinux) osName = 'Linux';
  else if (isAndroid) osName = 'Android';
  else if (isIOS) osName = 'iOS';

  return {
    isWindows,
    osName,
    canOpenNativeApp: isWindows,
  };
}
