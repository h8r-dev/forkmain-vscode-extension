import axios from 'axios';

import host from '../host';

export async function getKubeconfig(
    baseURL: string,
    token: string,
    orgId: string,
    clusterId: string
  ): Promise<string> {
    const resp = await axios.get(`/api/orgs/${orgId}/clusters/${clusterId}`, {
      baseURL,
      timeout: 5000, // waits for 5 seconds.
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  
    if (resp.status !== 200) {
      host.log(`Fetch kubeconfig failed!`, true);
      host.showInformationMessage(`Fetch kubeconfig failed!`);
      return "";
    } else {
      host.log("Fetch kubeconfig from forkmain backend api successfully!", true);
    }
  
    return resp.data.kubeconfig;
  }