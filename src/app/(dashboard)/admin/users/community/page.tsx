"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useSession } from "next-auth/react";
import { ChatPanel } from "@/app/components/ChatPanel";
import { UserCommunityTabs } from "../components/UserCommunityTabs";

export default function AdminUsersCommunityPage() {
  const { status } = useSession();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    const init = async () => {
      try {
        const res = await fetch("/api/chat/rooms/community");
        const data = await res.json();
        if (data.success) setRoomId(data.data.id);
      } catch {
        // ignore
      } finally {
        setLoadingRoom(false);
      }
    };

    init();
  }, [status]);

  return (
    <div className="space-y-6">
      <UserCommunityTabs />

      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-ap-copper" /> Comunidad
        </h1>
        <p className="text-white/60 mt-1 text-sm">
          Conversa con todos los miembros desde el panel de administracion.
        </p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/20">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-white">Chat de la comunidad</h2>
          <p className="mt-0.5 text-xs text-white/50">Canal general</p>
        </div>

        <div className="h-[calc(100vh-360px)] min-h-[420px]">
          {loadingRoom ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-500">Conectando al chat...</p>
            </div>
          ) : roomId ? (
            <ChatPanel roomId={roomId} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-500">No se pudo cargar el chat</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
