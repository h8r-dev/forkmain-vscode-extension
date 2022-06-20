const assert = require("assert");
const { tree } = require("../lib/components");
const logger = require("../lib/log");

const retry = require("async-retry");
const { default: Axios } = require("axios");

const { add, stop, getPortForwardPort } = require("./portForward");
const { checkSyncCompletion } = require("./devMode");
const { enterShortcutKeys, setInputBox } = require("./index");

const treeItemPath = [
  "",
  "default",
  "bookinfo",
  "Workloads",
  "Deployments",
  "ratings",
];
const start = async () => {
  const ratingsNode = await tree.getItem(...treeItemPath);
  const remoteRun = await ratingsNode.$(".action-label[title='Remote Run']");

  await remoteRun.click();
  logger.debug("remote run start");

  // if ((await dialog.getActionTexts()).includes("Open another directory")) {
  //   await dialog.selectAction("Open another directory");
  // } else {
  //   await dialog.selectAction("Open associated directory");
  // }

  // await file.selectPath(process.env.currentPath);
};

const checkHotReload = async () => {
  const port = await add();

  await enterShortcutKeys("MetaLeft", "p");
  await setInputBox("ratings.js");

  await page.waitForTimeout(5_00);
  await enterShortcutKeys("ControlLeft", "g");

  await setInputBox("207:9");

  await enterShortcutKeys("MetaLeft", "x");

  await page.keyboard.press("Backspace");
  await page.keyboard.type(
    `\n\tres.end(JSON.stringify({status: 'Ratings is checking for hotreload'}))\n`
  );

  await enterShortcutKeys("MetaLeft", "s");

  await page.waitForTimeout(10_000);

  await checkSyncCompletion();

  await retry(
    async () => {
      const data = await Axios.get(
        `http://127.0.0.1:${getPortForwardPort()}/health`
      );

      assert(
        "status" in data.data &&
          data.data.status === "Ratings is checking for hotreload"
      );
    },
    { retries: 3 }
  );
};

const stopRun = async () => {
  const treeItem = await tree.getItem(...treeItemPath);
  const portForward = await treeItem.$(".action-label[title='Port Forward']");
  await portForward.click();
  await stop();
};

module.exports = {
  start,
  checkHotReload,
  stopRun,
};