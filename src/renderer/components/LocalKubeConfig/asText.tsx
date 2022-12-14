import React, { useEffect, useRef, useState } from "react";
import useMessage from "../../hooks/vscode";

import vscode, { postMessage } from "../../utils/index";
import Select from "../Select";
import { ICheckResult, KubeconfigStatus } from "./status";
import { IKubeconfig, Validation } from "./validation";

interface State {
  kubeconfig: IKubeconfig;
  currentContext: string;
  strKubeconfig: string;
  namespace: string;
}

const KubeConfigAsText: React.FC<{
  checkResult: ICheckResult;
  state: State;
}> = (props) => {
  const [checkResult, setCheckResult] = useState<ICheckResult>(
    props.checkResult
  );
  useEffect(() => {
    setCheckResult(props.checkResult);
  }, [props.checkResult]);

  const [state, setState] = useState<State>();

  useEffect(() => {
    if (!props.state) {
      return;
    }

    let { kubeconfig, strKubeconfig, currentContext, namespace } = props.state;

    if (kubeconfig) {
      if (!currentContext) {
        currentContext = kubeconfig["current-context"];
      }
      if (!namespace) {
        namespace = kubeconfig.contexts?.find(
          (item) => item.name === currentContext
        )?.context?.namespace;
      }
    } else {
      currentContext = namespace = null;
    }

    setState({ kubeconfig, strKubeconfig, namespace, currentContext });

    input?.current && (input.current.value = strKubeconfig);
  }, [props.state]);

  const input = useRef<HTMLInputElement>();

  function submit() {
    const { strKubeconfig, namespace, currentContext } = state;

    postMessage({
      type: "local",
      data: {
        currentContext,
        strKubeconfig,
        namespace,
      },
    });
  }

  const checkKubeconfig = () => {
    if (!state || !state.strKubeconfig) {
      return;
    }

    const { strKubeconfig, currentContext, namespace } = state;

    let data = {
      strKubeconfig,
      currentContext,
      namespace,
    };

    setCheckResult({ status: "CHECKING" });

    postMessage({
      type: "checkKubeconfig",
      data,
    });

    vscode.setState({
      KubeConfigAsText: data,
    });
  };

  useEffect(checkKubeconfig, [state]);

  useEffect(() => {
    postMessage({
      type: "parseKubeConfig",
      data: vscode.getState("KubeConfigAsText"),
    });
  }, []);

  return (
    <Validation
      checkResult={checkResult}
      submit={submit}
      namespace={state?.namespace}
      onChangeNamespace={(namespace) => {
        setState((prevState) => {
          return { ...prevState, namespace };
        });
      }}
    >
      <textarea
        defaultValue={state?.strKubeconfig}
        className="type"
        onChange={(el) => {
          const strKubeconfig = el.target.value;

          if (!strKubeconfig) {
            setState(undefined);
            setCheckResult({ status: "DEFAULT" });
            return;
          }

          if (strKubeconfig === state?.strKubeconfig) {
            return;
          }

          postMessage({
            type: "parseKubeConfig",
            data: { strKubeconfig },
          });
        }}
        rows={20}
        placeholder="KubeConfig"
      />

      <KubeconfigStatus status={checkResult?.status}>
        <Select
          value={state?.currentContext}
          onChange={(currentContext) => {
            postMessage({
              type: "parseKubeConfig",
              data: { ...state, currentContext, namespace: undefined },
            });
          }}
          options={
            state?.kubeconfig?.contexts?.map((item) => {
              return {
                label: item.name,
                value: item.name,
              };
            }) ?? []
          }
        />
      </KubeconfigStatus>
    </Validation>
  );
};

export default KubeConfigAsText;
