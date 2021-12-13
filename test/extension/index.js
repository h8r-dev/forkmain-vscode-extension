const cp = require("child_process");
const path = require("path");
const fse = require("fs-extra");
const assert = require("assert");
const isWindows = require("is-windows");
const os = require("os");
const getPort = require("get-port");
const axios = require("axios");
const {
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath,
} = require("vscode-test");

const logger = require("./lib/log");
const VideoCapture = require("./lib/videoCapture");

const videoCapture = new VideoCapture();
/**
 *
 * @param {object} options
 * @param {string?} options.vscodeExecutablePath
 * @param {string?} options.version
 * @param {string?} options.platform
 * @param {object?} options.testsEnv
 */
const start = async (options = {}) => {
  const userDataDir = getUserDataDir();

  if (!options.vscodeExecutablePath) {
    options.vscodeExecutablePath = await downloadAndUnzipVSCode(
      options.version,
      options.platform
    );
  }

  const cliPath = resolveCliPathFromVSCodeExecutablePath(
    options.vscodeExecutablePath
  );

  const syncReturns = cp.spawnSync(
    cliPath,
    [
      "--extensions-dir",
      getExtensionsDir(true),
      "--install-extension",
      path.join(__dirname, "../../nocalhost.vsix"),
    ],
    {
      encoding: "utf-8",
      stdio: "inherit",
    }
  );

  assert.strictEqual(
    0,
    syncReturns.status,
    "install-extension error :" + JSON.stringify(syncReturns)
  );

  const port = await getPort();

  logger.debug("port", port);

  logger.debug("useDataDir", userDataDir);

  let args = [
    // https://github.com/microsoft/vscode/issues/84238
    "--no-sandbox",
    "--disable-workspace-trust",
    "--disable-dev-shm-usage",

    "--disable-web-security",
    "--disable-features=IsolateOrigins",
    "--disable-site-isolation-trials",
    // "--disable-extensions",
    `--extensions-dir=${getExtensionsDir()}`,
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
  ];

  if (options.launchArgs) {
    args = options.launchArgs.concat(args);
  }
  const pid = await run(options.vscodeExecutablePath, args, options.testsEnv);

  return { pid, port };
};

const getExtensionsDir = (isInit = false) => {
  let extensionsDir = path.join(__dirname, "../../.vscode-test/extensions");

  if (isWindows()) {
    extensionsDir = path.join(
      os.tmpdir(),
      process.pid.toString(),
      ".vscode-test/extensions"
    );
  }

  if (isInit) {
    if (fse.existsSync(extensionsDir)) {
      fse.removeSync(extensionsDir);
    }

    fse.mkdirpSync(extensionsDir);
  }

  return extensionsDir;
};
const getUserDataDir = () => {
  let userDataDir = path.join(__dirname, "../../.vscode-test/user-data");

  if (isWindows()) {
    userDataDir = path.join(
      os.tmpdir(),
      process.pid.toString(),
      ".vscode-test/user-data"
    );
  }

  if (fse.existsSync(userDataDir)) {
    fse.removeSync(userDataDir);
  }

  fse.mkdirpSync(path.join(userDataDir, "User"));

  let defaultSettings = {
    "window.titleBarStyle": "custom",
    "workbench.editor.enablePreview": false,
    "window.restoreFullscreen": true,
    "telemetry.enableTelemetry": false,
    "extensions.autoUpdate": false,
    "window.newWindowDimensions": "maximized",
  };

  fse.writeFile(
    path.join(userDataDir, "User", "settings.json"),
    JSON.stringify(defaultSettings, null, 2)
  );

  return userDataDir;
};

/**
 *
 * @param {object} testsEnv
 * @param {string} executable
 * @param {string []} args
 * @returns
 */
const run = async (executable, args, testsEnv) => {
  const fullEnv = Object.assign({}, process.env, testsEnv);
  const cmd = cp.spawn(executable, args, { env: fullEnv });

  cmd.stdout.on("data", function (data) {
    logger.log(data.toString());
  });

  cmd.stderr.on("data", function (data) {
    logger.warn(data.toString());
  });

  cmd.on("error", function (data) {
    logger.error("Test error: " + data.toString());
  });

  let finished = false;
  function onProcessClosed(code, signal) {
    if (finished) {
      return;
    }
    finished = true;
    logger.info(`Exit code:   ${code ?? signal}`);

    if (code === null) {
      logger.debug(signal);
    } else if (code !== 0) {
      logger.error("Failed");
    }

    logger.info("Done\n");
  }

  cmd.on("close", onProcessClosed);

  cmd.on("exit", onProcessClosed);

  const { pid } = cmd;

  logger.debug("pid", pid);

  return pid;
};

const getWebSocketDebuggerUrl = async (port) => {
  return axios.default
    .get(`http://127.0.0.1:${port}/json/version`)
    .then((json) => {
      return json.data.webSocketDebuggerUrl;
    });
};

module.exports = {
  start,
  getWebSocketDebuggerUrl,
  videoCapture,
};