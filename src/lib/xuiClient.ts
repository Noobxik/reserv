/** Parsed representation of streamSettings from a 3x-ui inbound. */
interface StreamSettings {
  network?: string;
  security?: string;
  tlsSettings?: {
    serverName?: string;
    settings?: { fingerprint?: string };
  };
  realitySettings?: {
    settings?: { publicKey?: string; fingerprint?: string };
    serverNames?: string[];
    shortIds?: string[];
  };
  wsSettings?: {
    path?: string;
    headers?: { Host?: string };
  };
  grpcSettings?: { serviceName?: string };
}

export interface Inbound {
  id: number;
  port: number;
  protocol: string;
  settings: string;
  streamSettings: string;
  remark: string;
}

export class XuiClient {
  private readonly baseUrl: string;
  private cookie: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  async login(username: string, password: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }),
    });

    if (!res.ok) {
      throw new Error(`3x-ui login failed: HTTP ${res.status}`);
    }

    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) throw new Error("3x-ui login failed: no session cookie");

    // Keep only the first name=value pair
    this.cookie = setCookie.split(";")[0];
  }

  // -------------------------------------------------------------------------
  // Private helper
  // -------------------------------------------------------------------------

  private async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.cookie) throw new Error("XuiClient: not authenticated");

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...(options.headers as Record<string, string>),
        Cookie: this.cookie,
        Accept: "application/json",
      },
    });

    if (res.status === 401) throw new Error("3x-ui session expired");
    if (!res.ok)
      throw new Error(`3x-ui request failed: HTTP ${res.status} ${endpoint}`);

    return res.json() as T;
  }

  // -------------------------------------------------------------------------
  // Inbound
  // -------------------------------------------------------------------------

  async getInbound(inboundId: number): Promise<Inbound> {
    const data = await this.request<{ success: boolean; obj: Inbound }>(
      `/panel/api/inbounds/get/${inboundId}`
    );
    if (!data.success) throw new Error(`Inbound ${inboundId} not found`);
    return data.obj;
  }

  // -------------------------------------------------------------------------
  // Client management
  // -------------------------------------------------------------------------

  /**
   * Add a new VLESS client with a traffic cap.
   * @param totalGiB  Traffic limit in gibibytes (e.g. 1.5 for 1.5 GiB).
   *                  Pass 0 for unlimited.
   */
  async addClient(
    inboundId: number,
    clientId: string,
    email: string,
    totalGiB: number
  ): Promise<void> {
    const totalBytes =
      totalGiB > 0 ? Math.round(totalGiB * 1024 * 1024 * 1024) : 0;

    const settings = {
      clients: [
        {
          id: clientId,
          flow: "",
          email,
          limitIp: 0,
          totalGB: totalBytes,
          expiryTime: 0, // No fixed expiry — revoked via webhook
          enable: true,
          tgId: "",
          subId: "",
          reset: 0,
        },
      ],
    };

    const result = await this.request<{ success: boolean; msg?: string }>(
      "/panel/api/inbounds/addClient",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: inboundId,
          settings: JSON.stringify(settings),
        }),
      }
    );

    if (!result.success)
      throw new Error(`Failed to add client: ${result.msg ?? "unknown"}`);
  }

  /** Permanently delete a client from the inbound. */
  async delClient(inboundId: number, clientId: string): Promise<void> {
    const result = await this.request<{ success: boolean; msg?: string }>(
      `/panel/api/inbounds/${inboundId}/delClient/${clientId}`,
      { method: "POST" }
    );

    if (!result.success)
      throw new Error(`Failed to delete client: ${result.msg ?? "unknown"}`);
  }

  // -------------------------------------------------------------------------
  // VLESS URI builder
  // -------------------------------------------------------------------------

  /**
   * Build a valid `vless://` connection URI from the inbound's streamSettings.
   */
  buildVlessUri(inbound: Inbound, clientId: string, email: string): string {
    let ss: StreamSettings;
    try {
      ss = JSON.parse(inbound.streamSettings) as StreamSettings;
    } catch {
      throw new Error("Failed to parse inbound streamSettings");
    }

    const network = ss.network ?? "tcp";
    const security = ss.security ?? "none";

    const params = new URLSearchParams({ type: network, security });

    if (security === "reality") {
      const rs = ss.realitySettings;
      if (rs?.settings?.publicKey) params.set("pbk", rs.settings.publicKey);
      if (rs?.serverNames?.[0]) params.set("sni", rs.serverNames[0]);
      if (rs?.settings?.fingerprint) params.set("fp", rs.settings.fingerprint);
      if (rs?.shortIds?.[0]) params.set("sid", rs.shortIds[0]);
    } else if (security === "tls") {
      const ts = ss.tlsSettings;
      if (ts?.serverName) params.set("sni", ts.serverName);
      params.set("fp", ts?.settings?.fingerprint ?? "chrome");
    }

    if (network === "ws") {
      const ws = ss.wsSettings;
      if (ws?.path) params.set("path", ws.path);
      if (ws?.headers?.Host) params.set("host", ws.headers.Host);
    } else if (network === "grpc") {
      const grpc = ss.grpcSettings;
      if (grpc?.serviceName) params.set("serviceName", grpc.serviceName);
    }

    // Prefer SNI as hostname, fall back to panel base URL host
    const domain =
      params.get("sni") ?? new URL(this.baseUrl).hostname;

    return (
      `vless://${clientId}@${domain}:${inbound.port}` +
      `?${params.toString()}#${encodeURIComponent(email)}`
    );
  }
}
