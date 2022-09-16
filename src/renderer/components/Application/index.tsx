/**
 * An Application created on ForkMain.
 */
import React, { useEffect, useState } from "react";
import { postMessage } from "../../utils/index";
import Divider from "@material-ui/core/Divider";
// @ts-ignore
import state from "../../../main/state";
interface ApplicationProps {
  app: any;
}

const ApplicationComp: React.FC<ApplicationProps> = ({ app }) => {
  function reconnect() {
    postMessage({
      type: "rerun",
      data: {},
    });
  }

  function openTerminal() {
    postMessage({
      type: "openTerminal",
      data: {},
    });
  }

  function portForward() {
    postMessage({
      type: "portForward",
      data: {},
    });
  }

  function remoteDebug() {
    postMessage({
      type: "remoteDebug",
      data: {},
    });
  }

  function stopDevMode() {
    postMessage({
      type: "stopDevMode",
      data: {},
    });
  }
  return (
    <div className="forkmain-app">
      <div style={{ display: "flex", paddingTop: 10, paddingBottom: 10 }}>
        <button
          style={{
            width: 100,
            marginLeft: 20,
          }}
          title="Reconnect to remote workspace"
          onClick={reconnect}
        >
          Run
        </button>
        <button
          style={{
            width: 100,
            marginLeft: 20,
            display: "none",
          }}
          title="Debug the service with remote debugger"
          onClick={remoteDebug}
        >
          Debug
        </button>
        <button
          style={{
            width: 100,
            marginLeft: 20,
            backgroundColor: "#b22a00",
          }}
          title="Stop the dev mode"
          onClick={stopDevMode}
        >
          Stop
        </button>
      </div>
      <Divider />
      <div style={{ display: "flex", paddingTop: 10, paddingBottom: 10 }}>
        <button
          style={{
            width: 100,
            marginLeft: 20,
          }}
          title="Open another remote terminal"
          onClick={openTerminal}
        >
          New Terminal
        </button>
        <button
          style={{
            width: 100,
            marginLeft: 20,
          }}
          title="Port Forward"
          onClick={portForward}
        >
          Port Forward
        </button>
      </div>
      <Divider />
      <hr />
      <div style={{ fontSize: "14px", marginTop: "5px" }}>
        <div style={{ marginTop: "5px" }}>
          <span
            style={{
              display: "inline-block",
              width: "70px",
              textAlign: "right",
            }}
          >
            service
          </span>{" "}
          :&nbsp;&nbsp;{app?.service}
        </div>
        <div style={{ marginTop: "5px" }}>
          <span
            style={{
              display: "inline-block",
              width: "70px",
              textAlign: "right",
            }}
          >
            env
          </span>{" "}
          :&nbsp;&nbsp;{app?.env}
        </div>
        <div style={{ marginTop: "5px" }}>
          <span
            style={{
              display: "inline-block",
              width: "70px",
              textAlign: "right",
            }}
          >
            workLoad
          </span>{" "}
          :&nbsp;&nbsp;{app?.workLoad}
        </div>
      </div>
    </div>
  );
};

export default ApplicationComp;
