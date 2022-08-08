export const enum ThemeType {
  dark = "dark",
  light = "light",
}

export const enum MessageActionType {
  executeCommand = "executeCommand",
  domContentLoaded = "domContentLoaded",
  homeWebView = "homeWebView",
}

export const enum Commands {
  refresh = "Forkmain.refresh",
  editServiceConfig = "Forkmain.editServiceConfig",
  startDevMode = "Forkmain.startDevMode",
  endDevMode = "Forkmain.endDevMode",
  reset = "Forkmain.reset",
  switchEndPoint = "Forkmain.switchEndPoint",
  openEndPoint = "Forkmain.openEndPoint",
  homeWebView = "Forkmain.homeWebView",
  connect = "Forkmain.connect",
  installApp = "Forkmain.installApp",
  uninstallApp = "Forkmain.uninstallApp",
  loadResource = "Forkmain.loadResource",
  log = "Forkmain.log",
  portForward = "Forkmain.portForward",
  exec = "Forkmain.exec",
}

export const DEFAULT_INTERVAL_MS = 3000;
export const LOG_TAIL_COUNT = 3000;
