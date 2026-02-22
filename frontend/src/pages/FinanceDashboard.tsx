import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { financeApi } from "@/api/finance";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Banknote,
    ArrowUpRight,
    ArrowDownLeft,
    Building2,
    History,
    DollarSign,
    RefreshCw,
} from "lucide-react";
import type { TreasuryTransactionType } from "@/types";

const TX_TYPE_LABELS: Record<string, string> = {
    DEPT_ALLOCATE_TO_ROOM: "Allocated to Room",
    DEPT_RECALL_FROM_ROOM: "Recalled from Room",
    ROOM_TASK_SPEND: "Task Spend",
    USER_BUY_SOCIAL_SCORE: "Social Score Purchase",
};

const TX_TYPE_COLORS: Record<string, string> = {
    DEPT_ALLOCATE_TO_ROOM: "text-blue-400",
    DEPT_RECALL_FROM_ROOM: "text-amber-400",
    ROOM_TASK_SPEND: "text-red-400",
    USER_BUY_SOCIAL_SCORE: "text-green-400",
};

export default function FinanceDashboard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Modal states
    const [allocateOpen, setAllocateOpen] = useState(false);
    const [recallOpen, setRecallOpen] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState<string>("");
    const [selectedRoomLabel, setSelectedRoomLabel] = useState<string>("");
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");

    const {
        data: overview,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["finance", "overview"],
        queryFn: financeApi.getOverview,
    });

    const allocateMutation = useMutation({
        mutationFn: ({ roomId, data }: { roomId: string; data: { amount: number; note?: string } }) =>
            financeApi.allocateToRoom(roomId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["finance"] });
            toast({ title: "Funds allocated", description: "Treasury updated." });
            closeModal();
        },
        onError: (e) => {
            toast({
                title: "Allocation failed",
                description: e instanceof Error ? e.message : "Unknown error",
                variant: "destructive",
            });
        },
    });

    const recallMutation = useMutation({
        mutationFn: ({ roomId, data }: { roomId: string; data: { amount: number; note?: string } }) =>
            financeApi.recallFromRoom(roomId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["finance"] });
            toast({ title: "Funds recalled", description: "Treasury updated." });
            closeModal();
        },
        onError: (e) => {
            toast({
                title: "Recall failed",
                description: e instanceof Error ? e.message : "Unknown error",
                variant: "destructive",
            });
        },
    });

    const closeModal = () => {
        setAllocateOpen(false);
        setRecallOpen(false);
        setAmount("");
        setNote("");
        setSelectedRoomId("");
        setSelectedRoomLabel("");
    };

    const openAllocate = (roomId: string, label: string) => {
        setSelectedRoomId(roomId);
        setSelectedRoomLabel(label);
        setAllocateOpen(true);
    };

    const openRecall = (roomId: string, label: string) => {
        setSelectedRoomId(roomId);
        setSelectedRoomLabel(label);
        setRecallOpen(true);
    };

    const handleSubmit = (type: "allocate" | "recall") => {
        const parsedAmount = parseInt(amount, 10);
        if (!parsedAmount || parsedAmount <= 0 || isNaN(parsedAmount)) {
            toast({ title: "Invalid amount", description: "Enter a positive integer.", variant: "destructive" });
            return;
        }
        const data = { amount: parsedAmount, note: note || undefined };
        if (type === "allocate") {
            allocateMutation.mutate({ roomId: selectedRoomId, data });
        } else {
            recallMutation.mutate({ roomId: selectedRoomId, data });
        }
    };

    const dept = overview?.department;

    return (
        <div className="min-h-screen p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-6xl space-y-6"
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Banknote className="h-8 w-8 text-primary" />
                        <div>
                            <h1 className="text-4xl font-bold">Finance Dashboard</h1>
                            <p className="text-muted-foreground">
                                Manage department and room treasury balances
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => refetch()}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                ) : isError ? (
                    <Card className="glass-card">
                        <CardContent className="py-12 text-center">
                            <p className="text-muted-foreground">
                                {error instanceof Error ? error.message : "Failed to load finance data"}
                            </p>
                            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                                Retry
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Department Treasury */}
                        <Card className="glass-card border-primary/30">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <Building2 className="h-5 w-5 text-primary" />
                                    {dept?.name} — Department Treasury
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-3xl font-bold">
                                    <DollarSign className="h-8 w-8 text-green-400" />
                                    {dept?.treasuryCredits?.toLocaleString() ?? 0}
                                    <span className="text-lg font-normal text-muted-foreground">credits</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Room Treasuries */}
                        <div>
                            <h2 className="text-2xl font-bold mb-4">Room Treasuries</h2>
                            {dept?.rooms?.length === 0 ? (
                                <Card className="glass-card">
                                    <CardContent className="py-8 text-center text-muted-foreground">
                                        No rooms in this department
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {dept?.rooms?.map((room) => (
                                        <Card key={room.id} className="glass-card hover-lift">
                                            <CardHeader>
                                                <CardTitle className="flex items-center justify-between">
                                                    <span>Room {room.roomNumber}</span>
                                                    <span className="text-lg font-bold text-green-400">
                                                        {room.treasuryCredits.toLocaleString()} cr
                                                    </span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={() => openAllocate(room.id, room.roomNumber)}
                                                >
                                                    <ArrowUpRight className="mr-1 h-3 w-3" />
                                                    Allocate
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1"
                                                    onClick={() => openRecall(room.id, room.roomNumber)}
                                                >
                                                    <ArrowDownLeft className="mr-1 h-3 w-3" />
                                                    Recall
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Transaction History */}
                        <div>
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <History className="h-5 w-5" /> Recent Transactions
                            </h2>
                            {overview?.recentTransactions?.length === 0 ? (
                                <Card className="glass-card">
                                    <CardContent className="py-8 text-center text-muted-foreground">
                                        No transactions yet
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-2">
                                    {overview?.recentTransactions?.map((tx) => (
                                        <Card key={tx.id} className="glass-card">
                                            <CardContent className="py-3 flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className={`text-sm font-medium ${TX_TYPE_COLORS[tx.type] ?? ""}`}>
                                                        {TX_TYPE_LABELS[tx.type] ?? tx.type}
                                                    </span>
                                                    {tx.room && (
                                                        <span className="text-xs text-muted-foreground">
                                                            Room {tx.room.roomNumber}
                                                        </span>
                                                    )}
                                                    {tx.note && (
                                                        <span className="text-xs text-muted-foreground truncate">
                                                            — {tx.note}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="font-bold">{tx.amount.toLocaleString()} cr</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(tx.createdAt).toLocaleDateString()}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        by {tx.createdBy.username}
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </motion.div>

            {/* Allocate Modal */}
            <Dialog open={allocateOpen} onOpenChange={(v) => { if (!v) closeModal(); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Allocate Funds to Room {selectedRoomLabel}</DialogTitle>
                        <DialogDescription>
                            Transfer credits from department treasury to this room.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Amount</Label>
                            <Input
                                type="number"
                                min={1}
                                step={1}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Note (optional)</Label>
                            <Input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Reason for allocation"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeModal}>Cancel</Button>
                        <Button
                            onClick={() => handleSubmit("allocate")}
                            disabled={allocateMutation.isPending}
                        >
                            {allocateMutation.isPending ? "Allocating..." : "Allocate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Recall Modal */}
            <Dialog open={recallOpen} onOpenChange={(v) => { if (!v) closeModal(); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Recall Funds from Room {selectedRoomLabel}</DialogTitle>
                        <DialogDescription>
                            Transfer credits from this room back to department treasury.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Amount</Label>
                            <Input
                                type="number"
                                min={1}
                                step={1}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter amount"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Note (optional)</Label>
                            <Input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Reason for recall"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeModal}>Cancel</Button>
                        <Button
                            onClick={() => handleSubmit("recall")}
                            disabled={recallMutation.isPending}
                        >
                            {recallMutation.isPending ? "Recalling..." : "Recall"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
