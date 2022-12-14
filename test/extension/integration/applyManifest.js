const { tree, file } = require("../lib/components");
const path = require("path");
const { waitForMessage, selectQuickPickItem } = require("./index");

const appPath = ["", "default", "bookinfo"];

const applyDeployment = async () => {
  const bookinfo = await tree.getItem(...appPath);
  const applyNode = await bookinfo.$(
    ".action-label[title='Apply New Manifest']"
  );
  await applyNode.click();
  await file.selectPath(path.join(__dirname, "../config/yaml"));

  return waitForMessage("Resource(Deployment) php created", 60 * 1000);
};

module.exports = {
  applyDeployment,
};
