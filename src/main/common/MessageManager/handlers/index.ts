import * as vscode from "vscode";
import { IMessage } from "..";
import fetchLogs from "./fetchLogs";
import updateURL from "./updateURL";

export default function (message: IMessage, id: number) {
  console.log(`> receive message from webview: ${id},`, message);
  const { type } = message;
  switch (type) {
    case "executeCommand":
      const { command, data } = message.payload;
      return vscode.commands.executeCommand(command, data);
    case "logs/fetch":
      return fetchLogs(message, id);
    case "url/update": {
      return updateURL(message, id);
    }
    default:
      return;
  }
}
