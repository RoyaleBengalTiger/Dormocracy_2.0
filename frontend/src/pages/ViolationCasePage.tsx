import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
    AlertTriangle,
    ArrowLeft,
    Clock,
    Gavel,
    Lock,
    MessageSquare,
    Scale,
    Send,
    Shield,
    ShieldCheck,
    ShieldX,
    Timer,
    UserMinus,
    UserPlus,
    Users,
} from "lucide-react";

import { violationsApi } from "@/api/violations";
import { departmentsAdminApi } from "@/api/departments";
import { useAuth } from "@/contexts/AuthContext";
import { CloseEvaluationModal } from "@/components/modals/CloseEvaluationModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
    ViolationStatusEnum,
    ViolationVerdictEnum,
    ViolationPenaltyMode,
    type Violation,
    type CaseChatMessage,
    type CaseChatMember,
} from "@/types";

/* ── Status badge helper ─────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; Icon: typeof AlertTriangle }> = {
    ACTIVE: { label: "Active", color: "bg-red-500/15 text-red-400", Icon: AlertTriangle },
    APPEALED: { label: "Appealed", color: "bg-amber-500/15 text-amber-400", Icon: Gavel },
    IN_EVALUATION: { label: "In Evaluation", color: "bg-blue-500/15 text-blue-400", Icon: MessageSquare },
    CLOSED_UPHELD: { label: "Upheld", color: "bg-red-500/15 text-red-400", Icon: ShieldCheck },
    CLOSED_OVERTURNED: { label: "Overturned", color: "bg-green-500/15 text-green-400", Icon: ShieldX },
    EXPIRED: { label: "Expired", color: "bg-gray-500/15 text-gray-400", Icon: Timer },
};

function StatusBadge({ status }: { status: string }) {
    const m = STATUS_META[status] ?? { label: status, color: "bg-gray-500/15 text-gray-400", Icon: Shield };
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${m.color}`}>
            <m.Icon className="h-3 w-3" />
            {m.label}
        </span>
    );
}

/* ── Page ─────────────────────────────────────────── */
export default function ViolationCasePage() {
    const { id: violationId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const bottomRef = useRef<HTMLDivElement>(null);

    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [showMembers, setShowMembers] = useState(true);
    const [addUserId, setAddUserId] = useState("");
    const [closeModalOpen, setCloseModalOpen] = useState(false);

    const isPM = user?.isPrimeMinister || user?.role === "ADMIN";

    // ── Fetch violation from the appeals list ─────────
    const { data: appeals = [], refetch: refetchAppeals } = useQuery({
        queryKey: ["violations", "appeals"],
        queryFn: violationsApi.getAppeals,
    });

    const violation: Violation | undefined = useMemo(
        () => appeals.find((v) => v.id === violationId),
        [appeals, violationId],
    );

    const isClosed = violation
        ? violation.status.startsWith("CLOSED_") || violation.status === "EXPIRED"
        : false;

    const chatExists = !!violation?.chatRoom;

    // ── Fetch chat messages ────────────────────────────
    const {
        data: chatData,
        isLoading: chatLoading,
        refetch: refetchMessages,
    } = useQuery({
        queryKey: ["case-chat", violationId, "messages"],
        queryFn: () => violationsApi.getChatMessages(violationId!, 100),
        enabled: !!violationId && chatExists,
        refetchInterval: chatExists && !isClosed ? 3000 : false,
    });

    const chatClosed = chatData?.closed ?? isClosed;
    const messages = useMemo(
        () => [...(chatData?.items ?? [])].reverse(),
        [chatData?.items],
    );

    // ── Fetch chat members ─────────────────────────────
    const {
        data: members = [],
        refetch: refetchMembers,
    } = useQuery({
        queryKey: ["case-chat", violationId, "members"],
        queryFn: () => violationsApi.getChatMembers(violationId!),
        enabled: !!violationId && chatExists,
    });

    // ── Fetch dept users for add-member select ─────────
    const { data: departments = [] } = useQuery({
        queryKey: ["departments"],
        queryFn: departmentsAdminApi.listDepartments,
        enabled: isPM && chatExists && !chatClosed,
    });

    // The PM's department = the one where they're assigned as PM
    const deptUsers = useMemo(() => {
        if (!departments.length || !user) return [];
        const myDept = departments.find((d) => d.primeMinister?.id === user.id);
        if (!myDept) return [];
        const allUsers: Array<{ id: string; username: string }> = [];
        for (const room of myDept.rooms) {
            for (const u of room.users) {
                if (!allUsers.some((x) => x.id === u.id)) {
                    allUsers.push({ id: u.id, username: u.username });
                }
            }
        }
        // Filter out users already in the chat
        const memberIds = new Set(members.map((m) => m.userId));
        return allUsers
            .filter((u) => !memberIds.has(u.id))
            .sort((a, b) => a.username.localeCompare(b.username));
    }, [departments, user, members]);

    // ── Scroll to bottom on new messages ───────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    // ── Handlers ───────────────────────────────────────
    const handleSend = async () => {
        if (!message.trim() || !violationId || chatClosed) return;
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
        if (!addUserId || !violationId) return;
        try {
            await violationsApi.addChatMember(violationId, addUserId);
            toast({ title: "Member added" });
            setAddUserId("");
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
            toast({ title: "Error", description: e instanceof Error ? e.message : "Cannot remove — may be a core member" });
        }
    };

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    // ── Loading state ──────────────────────────────────
    if (!violation) {
        return (
            <div className="min-h-screen p-8">
                <div className="mx-auto max-w-5xl">
                    <Button variant="ghost" size="sm" onClick={() => navigate("/app/pm/inbox")}>
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Inbox
                    </Button>
                    <Card className="glass-card mt-6">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            Loading case…
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-5xl space-y-5"
            >
                {/* ══ Back + header ═══════════════════════════ */}
                <Button variant="ghost" size="sm" onClick={() => navigate("/app/pm/inbox")}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back to Inbox
                </Button>

                {/* ══ Violation detail card ════════════════════ */}
                <Card className="glass-card">
                    <CardContent className="py-5 space-y-3">
                        {/* Title row */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                <h2 className="text-xl font-bold">{violation.title}</h2>
                                <StatusBadge status={violation.status} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-destructive whitespace-nowrap">
                                    −{violation.points} pts
                                </span>
                                {violation.creditFine > 0 && (
                                    <span className="text-lg font-bold text-amber-400 whitespace-nowrap">
                                        −{violation.creditFine} cr
                                    </span>
                                )}
                                {violation.penaltyMode === ViolationPenaltyMode.EITHER_CHOICE && (
                                    <span className="inline-flex items-center rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-400">
                                        Choice
                                    </span>
                                )}
                            </div>
                        </div>

                        {violation.description && (
                            <p className="text-sm text-muted-foreground">{violation.description}</p>
                        )}

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                            <span>
                                Offender:{" "}
                                <span className="font-medium text-foreground">{violation.offender.username}</span>
                            </span>
                            <span>
                                Issued by:{" "}
                                <span className="font-medium text-foreground">{violation.createdBy.username}</span>
                            </span>
                            <span>Created: {formatDate(violation.createdAt)}</span>
                            {violation.appealedAt && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Appealed {formatDate(violation.appealedAt)}
                                </span>
                            )}
                            {violation.expiresAt && (
                                <span className="flex items-center gap-1">
                                    <Timer className="h-3 w-3" /> Expires {formatDate(violation.expiresAt)}
                                </span>
                            )}
                        </div>

                        {/* Appeal note */}
                        {violation.appealNote && (
                            <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm">
                                <span className="font-medium">Appeal note: </span>
                                <span className="italic text-muted-foreground">"{violation.appealNote}"</span>
                            </div>
                        )}

                        {/* Verdict (shown for closed cases) */}
                        {violation.verdict && (
                            <div className="rounded-md bg-muted px-3 py-2 text-sm">
                                <span className="font-medium">Verdict: </span>
                                <span
                                    className={
                                        violation.verdict === ViolationVerdictEnum.UPHELD
                                            ? "text-red-400"
                                            : violation.verdict === ViolationVerdictEnum.OVERTURNED
                                                ? "text-green-400"
                                                : "text-amber-400"
                                    }
                                >
                                    {violation.verdict.replace(/_/g, " ")}
                                </span>
                                {violation.verdictNote && (
                                    <span className="text-muted-foreground"> — {violation.verdictNote}</span>
                                )}
                                {violation.pointsRefunded > 0 && (
                                    <span className="ml-2 text-green-400">
                                        (+{violation.pointsRefunded} pts refunded)
                                    </span>
                                )}
                                {violation.creditsRefunded > 0 && (
                                    <span className="ml-2 text-green-400">
                                        (+{violation.creditsRefunded} cr refunded)
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Deduction / choice details */}
                        {(violation.creditsDeducted > 0 || violation.pointsDeducted > 0 || violation.offenderChoice) && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                {violation.pointsDeducted > 0 && (
                                    <span>Social score deducted: <strong className="text-destructive">−{violation.pointsDeducted}</strong></span>
                                )}
                                {violation.creditsDeducted > 0 && (
                                    <span>Credits deducted: <strong className="text-amber-400">−{violation.creditsDeducted}</strong></span>
                                )}
                                {violation.offenderChoice && (
                                    <span className="text-indigo-400">
                                        Chose: {violation.offenderChoice === 'CREDITS' ? 'Credits' : 'Social Score'}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* D2: Choose penalty for EITHER_CHOICE violations */}
                        {violation.status === ViolationStatusEnum.ACTIVE &&
                            violation.penaltyMode === ViolationPenaltyMode.EITHER_CHOICE &&
                            !violation.offenderChoice &&
                            violation.offender.id === user?.id && (
                                <div className="border border-amber-500/30 rounded-lg p-3 space-y-2">
                                    <p className="text-sm font-medium text-amber-300">Choose your penalty:</p>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={async () => {
                                                try {
                                                    const { violationsApi: api } = await import('@/api/violations');
                                                    await api.choosePenalty(violationId!, 'SOCIAL_SCORE');
                                                    toast({ title: 'Penalty applied' });
                                                    refetchAppeals();
                                                } catch (e) {
                                                    toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed' });
                                                }
                                            }}
                                        >
                                            Pay {violation.points} Social Score
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                            onClick={async () => {
                                                try {
                                                    const { violationsApi: api } = await import('@/api/violations');
                                                    await api.choosePenalty(violationId!, 'CREDITS');
                                                    toast({ title: 'Penalty applied' });
                                                    refetchAppeals();
                                                } catch (e) {
                                                    toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed' });
                                                }
                                            }}
                                        >
                                            Pay {violation.creditFine} Credits
                                        </Button>
                                    </div>
                                </div>
                            )}

                        {/* Action bar */}
                        {violation.status === ViolationStatusEnum.IN_EVALUATION && isPM && (
                            <div className="flex gap-2 pt-1">
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setCloseModalOpen(true)}
                                >
                                    <Scale className="mr-1 h-3 w-3" />
                                    Close &amp; Verdict
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ══ Defence section ═════════════════════════ */}
                <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Defence — Case Chat
                        {chatClosed && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/15 px-2 py-0.5 text-xs font-medium text-gray-400">
                                <Lock className="h-3 w-3" /> Locked
                            </span>
                        )}
                    </h3>

                    {!chatExists ? (
                        <Card className="glass-card">
                            <CardContent className="py-8 text-center text-muted-foreground">
                                No case chat yet. Start an evaluation to create the chat.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="flex gap-4">
                            {/* ── Message area ──────────────────── */}
                            <Card className="glass-card flex-1">
                                <CardContent className="p-0">
                                    <div className="flex h-[calc(100vh-620px)] min-h-[300px] flex-col">
                                        {/* Messages */}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                            {chatLoading ? (
                                                <div className="flex justify-center py-8">
                                                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                                </div>
                                            ) : messages.length === 0 ? (
                                                <p className="text-center text-sm text-muted-foreground py-8">
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
                                                                        <span className="ml-1 opacity-50 text-[10px]">
                                                                            {m.sender.role}
                                                                        </span>
                                                                    </p>
                                                                )}
                                                                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
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
                                            {chatClosed ? (
                                                <p className="text-center text-sm text-muted-foreground">
                                                    <Lock className="inline h-3 w-3 mr-1" />
                                                    This chat is closed — no new messages.
                                                </p>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Type a message…"
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

                            {/* ── Members sidebar ───────────────── */}
                            {showMembers && (
                                <Card className="glass-card w-72 shrink-0 self-start">
                                    <CardHeader className="py-3 px-4">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-1">
                                            <Users className="h-4 w-4" />
                                            Members ({members.length})
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-4 pb-4 pt-0 space-y-2">
                                        {members.map((m: CaseChatMember) => (
                                            <div key={m.id} className="flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{m.user.username}</p>
                                                    <p className="text-[11px] text-muted-foreground">{m.user.role}</p>
                                                </div>
                                                {isPM && !chatClosed && m.user.id !== user?.id && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 shrink-0"
                                                        onClick={() => handleKick(m.user.id)}
                                                        title="Remove from case chat"
                                                    >
                                                        <UserMinus className="h-3.5 w-3.5 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}

                                        {/* ── Add member (PM only, searchable) ── */}
                                        {isPM && !chatClosed && (
                                            <div className="border-t pt-3 space-y-2 mt-2">
                                                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                                    <UserPlus className="h-3 w-3" /> Add department member
                                                </p>
                                                {deptUsers.length > 0 ? (
                                                    <div className="flex gap-1">
                                                        <Select value={addUserId} onValueChange={setAddUserId}>
                                                            <SelectTrigger className="h-8 text-xs flex-1">
                                                                <SelectValue placeholder="Select user…" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {deptUsers.map((u) => (
                                                                    <SelectItem key={u.id} value={u.id}>
                                                                        {u.username}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 px-2 shrink-0"
                                                            onClick={handleAddMember}
                                                            disabled={!addUserId}
                                                        >
                                                            <UserPlus className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground italic">
                                                        No more users available to add.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Members toggle (bottom) ─────────────────── */}
                {chatExists && (
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowMembers(!showMembers)}
                        >
                            <Users className="mr-1 h-4 w-4" />
                            {showMembers ? "Hide Members" : "Show Members"}
                        </Button>
                    </div>
                )}

                {/* ── Close Evaluation Modal ──────────────────── */}
                {closeModalOpen && (
                    <CloseEvaluationModal
                        open={closeModalOpen}
                        onOpenChange={setCloseModalOpen}
                        violationId={violationId!}
                        onSuccess={() => {
                            setCloseModalOpen(false);
                            refetchAppeals();
                            refetchMessages();
                        }}
                    />
                )}
            </motion.div>
        </div>
    );
}
