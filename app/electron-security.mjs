function sameUrl(actual, expected) {
  try { return new URL(actual).href === new URL(expected).href; }
  catch { return false; }
}

export function applyNavigationGuards(webContents, allowedUrl) {
  const denyUnexpected = (event, targetUrl) => {
    if (!sameUrl(targetUrl, allowedUrl)) event.preventDefault();
  };
  webContents.on('will-navigate', denyUnexpected);
  webContents.on('will-redirect', denyUnexpected);
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}
