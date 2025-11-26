import { useEffect, useMemo, useState } from "react";
import { getNetworkInfo } from "@/lib/proxy";
import { NetworkInfo } from "@/types";

export function useNetworkAddresses(listenPort: number, basePath: string) {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  useEffect(() => {
    getNetworkInfo().then(setNetworkInfo).catch(console.error);
  }, []);

  return useMemo(() => {
    const normalizedBase = basePath === "/" ? "" : basePath || "";
    const options: { label: string; url: string }[] = [
      { label: "本机", url: `http://localhost:${listenPort}${normalizedBase}` },
    ];

    if (networkInfo?.localIp) {
      options.push({
        label: "局域网 IP",
        url: `http://${networkInfo.localIp}:${listenPort}${normalizedBase}`,
      });
    }

    if (networkInfo?.isMacos && networkInfo?.hostname) {
      options.push({
        label: "主机名",
        url: `http://${networkInfo.hostname}.local:${listenPort}${normalizedBase}`,
      });
    }

    return options;
  }, [basePath, listenPort, networkInfo]);
}
