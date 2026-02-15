import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    Lock,
    Send,
    UserPlus,
    UserMinus,
    Users,
    ChevronsUpDown,
} from "lucide-react";

import { treatiesApi } from "@/api/treaties";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "@/hooks/use-toast";

export default function BreachCaseChatPage() {
    const { id: treatyId, breachId } = useParams<{ id: string; breachId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [addPopoverOpen, setAddPopoverOpen] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Fetch messages
    const {
        data: chatData,
        isLoading,
        refetch: refetchMessages,
    } = useQuery({
        queryKey: ["breach-chat", treatyId, breachId, "messages"],
        queryFn: () => treatiesApi.getBreachChatMessages(treatyId!, breachId!, 100),
        enabled: !!treatyId && !!breachId,
        refetchInterval: 3000,
    });

    // Fetch members
    const {
        data: members = [],
        refetch: refetchMembers,
    } = useQuery({
        queryKey: ["breach-chat", treatyId, breachId, "members"],
        queryFn: () => treatiesApi.getBreachChatMembers(treatyId!, breachId!),
        enabled: !!treatyId && !!breachId,
    });

    // Fetch stakeholders for the treaty to populate the dropdown
    const {
        data: stakeholders = [],
        isLoading: stakeholdersLoading,
    } = useQuery({
        queryKey: ["treaty-stakeholders", treatyId],
        queryFn: () => treatiesApi.listStakeholders(treatyId!),
        enabled: !!treatyId,
    });

    const availableUsers = useMemo(() => {
        const memberIds = new Set(members.map((m: any) => m.userId));
        return stakeholders.filter((u) => !memberIds.has(u.id) && u.id !== user?.id);
    }, [stakeholders, members, user?.id]);

    const isClosed = chatData?.closed ?? false;
    const messages_ = useMemo(
        () => [...(chatData?.items ?? [])].reverse(),
        [chatData?.items],
    );

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages_.length]);

    const handleSend = async () => {
        if (!message.trim() || !treatyId || !breachId || isClosed) return;
        try {
            setIsSending(true);
            await treatiesApi.sendBreachChatMessage(treatyId, breachId, message.trim());
            setMessage("");
            refetchMessages();
        } catch (e) {
            toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to send" });
        } finally {
            setIsSending(false);
        }
    };

    const handleAddMember = async (userId: string) => {
        if (!userId || !treatyId || !breachId) return;
        try {
            await treatiesApi.addBreachChatMember(treatyId, breachId, userId);
            toast({ title: "Member added" });
            setAddPopoverOpen(false);
            refetchMembers();
        } catch (e) {
            toast({ title: "Error", description: e instanceof Error ? e.message : "Failed" });
        }
    };

    const handleKick = async (userId: string) => {
        if (!treatyId || !breachId) return;
        try {
            await treatiesApi.removeBreachChatMember(treatyId, breachId, userId);
            toast({ title: "Member removed" });
            refetchMembers();
        } catch (e) {
            toast({ title: "Error", description: e instanceof Error ? e.message : "Failed" });
        }
    };

    const isPM = user?.isPrimeMinister || user?.role === "ADMIN";

    return (
        <div className="min-h-screen p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-4xl space-y-4"
            >
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            Breach Case Chat
                            {isClosed && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/15 px-2 py-0.5 text-xs font-medium text-gray-400">
                                    <Lock className="h-3 w-3" /> Closed
                                </span>
                            )}
                        </h1>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowMembers(!showMembers)}>
                        <Users className="mr-1 h-4 w-4" />
                        Members ({members.length})
                    </Button>
                </div>

                <div className="flex gap-4">
                    {/* Messages area */}
                    <Card className="glass-card flex-1">
                        <CardContent className="p-0">
                            <div className="flex h-[calc(100vh-220px)] flex-col">
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {isLoading ? (
                                        <div className="flex justify-center py-12">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                        </div>
                                    ) : messages_.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-12">
                                            No messages yet. Start the discussion.
                                        </p>
                                    ) : (
                                        messages_.map((m: any) => {
                                            const isMe = m.sender.id === user?.id;
                                            return (
                                                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                                    <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                                        {!isMe && <p className="text-xs font-semibold mb-0.5 opacity-70">{m.sender.username}</p>}
                                                        <p className="text-sm">{m.content}</p>
                                                        <p className="text-[10px] opacity-50 mt-1">
                                                            {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
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
                                            <Button size="sm" onClick={handleSend} disabled={isSending || !message.trim()}>
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
                                {members.map((m: any) => (
                                    <div key={m.userId} className="flex items-center justify-between gap-2">
                                        <div className="text-sm">
                                            <span className="font-medium">{m.user.username}</span>
                                            <span className="text-xs text-muted-foreground ml-1">{m.user.role}</span>
                                        </div>
                                        {isPM && !isClosed && m.user.id !== user?.id && (
                                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleKick(m.user.id)}>
                                                <UserMinus className="h-3 w-3 text-destructive" />
                                            </Button>
                                        )}
                                    </div>
                                ))}

                                {isPM && !isClosed && (
                                    <div className="border-t pt-3 space-y-2">
                                        <p className="text-xs text-muted-foreground">Add member</p>
                                        <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={addPopoverOpen}
                                                    className="w-full justify-between font-normal h-8 text-xs px-2"
                                                >
                                                    <span className="text-muted-foreground">Search user…</span>
                                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search user…" className="h-8 text-xs" />
                                                    <CommandList>
                                                        <CommandEmpty className="text-xs p-2">{stakeholdersLoading ? "Loading…" : "No users found."}</CommandEmpty>
                                                        <CommandGroup>
                                                            {availableUsers.map((u) => (
                                                                <CommandItem
                                                                    key={u.id}
                                                                    value={`${u.username} ${u.email}`}
                                                                    onSelect={() => handleAddMember(u.id)}
                                                                    className="text-xs"
                                                                >
                                                                    <UserPlus className="mr-2 h-3 w-3 text-muted-foreground" />
                                                                    <span>{u.username}</span>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
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
