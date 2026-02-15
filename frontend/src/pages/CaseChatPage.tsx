import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    Lock,
    Send,
    UserPlus,
    UserMinus,
    Users,
} from "lucide-react";

import { violationsApi } from "@/api/violations";
import { usersApi } from "@/api/users";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import type { CaseChatMessage, CaseChatMember } from "@/types";

export default function CaseChatPage() {
    const { id: violationId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [addUserId, setAddUserId] = useState("");
    const [addUserSearch, setAddUserSearch] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);

    // Fetch violation details
    const {
        data: violation,
        isLoading: isLoadingViolation,
    } = useQuery({
        queryKey: ["violations", violationId],
        queryFn: () => violationsApi.get(violationId!),
        enabled: !!violationId,
    });

    // Fetch messages
    const {
        data: chatData,
        isLoading,
        refetch: refetchMessages,
    } = useQuery({
        queryKey: ["case-chat", violationId, "messages"],
        queryFn: () => violationsApi.getChatMessages(violationId!, 100),
        enabled: !!violationId,
        refetchInterval: 3000, // Poll every 3s for new messages
    });

    // Fetch members
    const {
        data: members = [],
        refetch: refetchMembers,
    } = useQuery({
        queryKey: ["case-chat", violationId, "members"],
        queryFn: () => violationsApi.getChatMembers(violationId!),
        enabled: !!violationId,
    });

    // Check if current user is PM (can manage members)
    const isPM = user?.isPrimeMinister || user?.role === "ADMIN";

    // Users for the add-member dropdown (PM only)
    const { data: allUsers = [] } = useQuery({
        queryKey: ["all-users"],
        queryFn: () => usersApi.listAll(),
        enabled: !!isPM,
    });

    const isClosed = chatData?.closed ?? false;
    const messages = useMemo(
        () => [...(chatData?.items ?? [])].reverse(),
        [chatData?.items],
    );

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    const handleSend = async () => {
        if (!message.trim() || !violationId || isClosed) return;
        try {
            setIsSending(true);
            await violationsApi.sendChatMessage(violationId, message.trim());
            setMessage("");
            refetchMessages();
        } catch (e) {
            toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to send" });
        } finally {
            setIsSending(false);
        }
    };

    const handleAddMember = async () => {
        if (!addUserId.trim() || !violationId) return;
        try {
            await violationsApi.addChatMember(violationId, addUserId.trim());
            toast({ title: "Member added" });
            setAddUserId("");
            setAddUserSearch("");
            refetchMembers();
        } catch (e) {
            toast({ title: "Error", description: e instanceof Error ? e.message : "Failed" });
        }
    };

    const handleKick = async (userId: string) => {
        if (!violationId) return;
        try {
            await violationsApi.kickChatMember(violationId, userId);
            toast({ title: "Member removed" });
            refetchMembers();
        } catch (e) {
            toast({ title: "Error", description: e instanceof Error ? e.message : "Failed" });
        }
    };


    return (
        <div className="min-h-screen p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-4xl space-y-4"
            >
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            Case Chat
                            {isClosed && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/15 px-2 py-0.5 text-xs font-medium text-gray-400">
                                    <Lock className="h-3 w-3" /> Closed
                                </span>
                            )}
                        </h1>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMembers(!showMembers)}
                    >
                        <Users className="mr-1 h-4 w-4" />
                        Members ({members.length})
                    </Button>
                </div>

                {isLoadingViolation ? (
                    <div className="text-sm text-muted-foreground animate-pulse">Loading case details...</div>
                ) : violation ? (
                    <div className="rounded-md border bg-card p-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm shadow-sm">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">{violation.title}</span>
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                                {violation.status.replace(/_/g, " ")}
                            </span>
                        </div>
                        <div className="text-muted-foreground">
                            Offender: <strong className="text-foreground">{violation.offender?.username}</strong>
                        </div>
                        <div className="text-muted-foreground">
                            Points: <strong className="text-destructive">−{violation.points}</strong>
                        </div>
                    </div>
                ) : null}

                <div className="flex gap-4">
                    {/* Messages area */}
                    <Card className="glass-card flex-1">
                        <CardContent className="p-0">
                            <div className="flex h-[calc(100vh-320px)] flex-col">
                                {/* Message list */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {isLoading ? (
                                        <div className="flex justify-center py-12">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-12">
                                            No messages yet. Start the discussion.
                                        </p>
                                    ) : (
                                        messages.map((m: CaseChatMessage) => {
                                            const isMe = m.sender.id === user?.id;
                                            return (
                                                <div
                                                    key={m.id}
                                                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                                                >
                                                    <div
                                                        className={`max-w-[75%] rounded-lg px-3 py-2 ${isMe
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-muted"
                                                            }`}
                                                    >
                                                        {!isMe && (
                                                            <p className="text-xs font-semibold mb-0.5 opacity-70">
                                                                {m.sender.username}
                                                            </p>
                                                        )}
                                                        <p className="text-sm">{m.content}</p>
                                                        <p className="text-[10px] opacity-50 mt-1">
                                                            {new Date(m.createdAt).toLocaleTimeString(undefined, {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={bottomRef} />
                                </div>

                                {/* Composer */}
                                <div className="border-t p-3">
                                    {isClosed ? (
                                        <p className="text-center text-sm text-muted-foreground">
                                            <Lock className="inline h-3 w-3 mr-1" />
                                            This chat is closed — no new messages.
                                        </p>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Type a message..."
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSend();
                                                    }
                                                }}
                                                disabled={isSending}
                                            />
                                            <Button
                                                size="sm"
                                                onClick={handleSend}
                                                disabled={isSending || !message.trim()}
                                            >
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Members sidebar */}
                    {showMembers && (
                        <Card className="glass-card w-64 shrink-0">
                            <CardHeader className="py-3 px-4">
                                <CardTitle className="text-sm font-semibold">Members</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-3">
                                {members.map((m: CaseChatMember) => (
                                    <div key={m.id} className="flex items-center justify-between gap-2">
                                        <div className="text-sm">
                                            <span className="font-medium">{m.user.username}</span>
                                            <span className="text-xs text-muted-foreground ml-1">
                                                {m.user.role}
                                            </span>
                                        </div>
                                        {isPM && !isClosed && m.user.id !== user?.id && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0"
                                                onClick={() => handleKick(m.user.id)}
                                            >
                                                <UserMinus className="h-3 w-3 text-destructive" />
                                            </Button>
                                        )}
                                    </div>
                                ))}

                                {/* Add member (PM only) */}
                                {isPM && !isClosed && (
                                    <div className="border-t pt-3 space-y-2">
                                        <p className="text-xs text-muted-foreground">Add member</p>
                                        <div className="relative">
                                            <Input
                                                className="h-7 text-xs"
                                                placeholder="Search user..."
                                                value={addUserSearch}
                                                onChange={(e) => {
                                                    setAddUserSearch(e.target.value);
                                                    if (addUserId) setAddUserId("");
                                                }}
                                            />
                                            {addUserId && (
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className="text-xs text-green-400">
                                                        Selected: {allUsers.find(u => u.id === addUserId)?.username ?? addUserId}
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 px-2"
                                                        onClick={handleAddMember}
                                                    >
                                                        <UserPlus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                            {!addUserId && addUserSearch.length > 0 && (
                                                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-32 overflow-y-auto bg-popover border border-border rounded-md shadow-lg">
                                                    {allUsers
                                                        .filter(u => {
                                                            if (u.id === user?.id) return false;
                                                            if (members.some(m => m.user.id === u.id)) return false;
                                                            return (
                                                                u.username.toLowerCase().includes(addUserSearch.toLowerCase()) ||
                                                                u.email.toLowerCase().includes(addUserSearch.toLowerCase())
                                                            );
                                                        })
                                                        .slice(0, 10)
                                                        .map(u => (
                                                            <button
                                                                key={u.id}
                                                                type="button"
                                                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                                                                onClick={() => {
                                                                    setAddUserId(u.id);
                                                                    setAddUserSearch(u.username);
                                                                }}
                                                            >
                                                                <span className="font-medium">{u.username}</span>
                                                                <span className="text-muted-foreground ml-1">{u.email}</span>
                                                            </button>
                                                        ))
                                                    }
                                                    {allUsers.filter(u => {
                                                        if (u.id === user?.id) return false;
                                                        if (members.some(m => m.user.id === u.id)) return false;
                                                        return (
                                                            u.username.toLowerCase().includes(addUserSearch.toLowerCase()) ||
                                                            u.email.toLowerCase().includes(addUserSearch.toLowerCase())
                                                        );
                                                    }).length === 0 && (
                                                            <div className="px-2 py-1.5 text-xs text-muted-foreground">No matching users</div>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
