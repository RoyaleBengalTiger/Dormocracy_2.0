import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/lib/auth";
import { useChatSocket } from "../hooks/useChatSocket";

export default function ChatDebugPage() {
  const token = getAccessToken();
  const { user } = useAuth();

  const { status, lastEvent } = useChatSocket({
    enabled: Boolean(token),
    onMessage: () => {},
  });

  const tokenPreview = useMemo(() => {
    if (!token) return "(none)";
    return `${token.slice(0, 12)}…${token.slice(-6)}`;
  }, [token]);

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold">Chat Debug</h1>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">User</span>
              <span className="font-medium">{user?.username ?? "(none)"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">{user?.role ?? "(none)"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Access token</span>
              <span className="font-mono text-xs">{tokenPreview}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Socket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{status}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Last event</span>
              <span className="font-medium">{lastEvent ?? "(none)"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">WS base</span>
              <span className="font-mono text-xs">
                {(import.meta.env.VITE_WS_BASE_URL || import.meta.env.VITE_API_BASE_URL || "(unset)").replace(/\/$/, "")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
