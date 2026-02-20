import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { electionsApi } from '@/api/elections';
import { departmentsApi } from '@/api/departments';
import { Department, CaseChatMessage, DepartmentListItem } from '@/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Users, Send, Crown, Search, Briefcase, Landmark } from 'lucide-react';

// ─── SearchableDropdown ──────────────────────────────────────

function SearchableDropdown({
    items,
    value,
    onChange,
    placeholder,
}: {
    items: { value: string; label: string }[];
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
}) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(
        () => items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase())),
        [items, search],
    );

    return (
        <div className="space-y-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    className="pl-9"
                    placeholder={`Search ${placeholder}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {filtered.length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground text-center">No results</div>
                    )}
                    {filtered.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────

export default function SenateChatPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [message, setMessage] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Get departments
    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: departmentsApi.getDepartments,
    });

    // Auto-select user's department
    useEffect(() => {
        if (user?.room?.department?.id && !selectedDeptId) {
            setSelectedDeptId(user.room.department.id);
        }
    }, [user, selectedDeptId]);

    // Senate chat room
    const {
        data: senateChatRoom,
        isLoading: loadingChat,
        error: chatError,
    } = useQuery({
        queryKey: ['senate-chat', selectedDeptId],
        queryFn: () => electionsApi.getSenateChatRoom(selectedDeptId),
        enabled: !!selectedDeptId,
        retry: false,
    });

    // Messages
    const { data: messagesData } = useQuery({
        queryKey: ['senate-messages', selectedDeptId],
        queryFn: () => electionsApi.getSenateMessages(selectedDeptId),
        enabled: !!selectedDeptId && !!senateChatRoom,
        refetchInterval: 3000,
    });

    const messages = (messagesData?.items || []).slice().reverse();

    // Auto scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length]);

    // Send message
    const sendMut = useMutation({
        mutationFn: (content: string) =>
            electionsApi.sendSenateMessage(selectedDeptId, content),
        onSuccess: () => {
            setMessage('');
            qc.invalidateQueries({ queryKey: ['senate-messages', selectedDeptId] });
        },
        onError: (err: any) =>
            toast({ title: 'Error', description: err.message, variant: 'destructive' }),
    });

    const handleSend = () => {
        const trimmed = message.trim();
        if (!trimmed) return;
        sendMut.mutate(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Get the current dept for PM check
    const selectedDept = departments.find((d) => d.id === selectedDeptId) as DepartmentListItem | undefined;
    const isPM = !!(user && selectedDept && (selectedDept as any).primeMinister?.id === user.id);

    return (
        <div className="max-w-4xl mx-auto p-6 h-[calc(100vh-2rem)] flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Crown className="h-7 w-7 text-amber-400" />
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Senate Chamber</h1>
                        <p className="text-muted-foreground text-sm">
                            Group chat for department mayors
                        </p>
                    </div>
                </div>

                <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                        {departments.map((d: Department) => (
                            <SelectItem key={d.id} value={d.id}>
                                {d.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* ─── PM Minister Assignment ───────────────────────────── */}
            {selectedDeptId && isPM && (
                <MinisterAssignment
                    departmentId={selectedDeptId}
                    departments={departments as DepartmentListItem[]}
                />
            )}

            {!selectedDeptId && (
                <Card className="glass-card flex-1 flex items-center justify-center">
                    <CardContent className="text-center text-muted-foreground">
                        <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p>Select a department to view the senate chat</p>
                    </CardContent>
                </Card>
            )}

            {selectedDeptId && loadingChat && (
                <Card className="glass-card flex-1 flex items-center justify-center">
                    <CardContent className="text-center text-muted-foreground">
                        Loading senate chat...
                    </CardContent>
                </Card>
            )}

            {selectedDeptId && chatError && (
                <Card className="glass-card flex-1 flex items-center justify-center">
                    <CardContent className="text-center text-muted-foreground">
                        <MessageSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p>
                            {(chatError as any)?.message ||
                                'Senate chat not available. You must be a mayor in this department.'}
                        </p>
                    </CardContent>
                </Card>
            )}

            {selectedDeptId && senateChatRoom && (
                <Card className="glass-card flex-1 flex flex-col overflow-hidden">
                    {/* Members bar */}
                    <CardHeader className="pb-2 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Members ({senateChatRoom.members.length})
                            </CardTitle>
                            <div className="flex gap-1 overflow-x-auto max-w-md">
                                {senateChatRoom.members.map((m) => (
                                    <Badge key={m.id} variant="outline" className="text-xs whitespace-nowrap">
                                        {m.user.username}
                                        <span className="ml-1 opacity-60">({m.user.role})</span>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </CardHeader>

                    {/* Messages */}
                    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                        <div className="space-y-3">
                            {messages.length === 0 && (
                                <div className="text-center text-muted-foreground py-12">
                                    No messages yet. Start the conversation!
                                </div>
                            )}
                            {messages.map((msg: CaseChatMessage) => {
                                const isMe = msg.sender.id === user?.id;
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-xl px-4 py-2 ${isMe
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-secondary'
                                                }`}
                                        >
                                            {!isMe && (
                                                <div className="text-xs font-semibold mb-1 opacity-70">
                                                    {msg.sender.username}
                                                </div>
                                            )}
                                            <p className="text-sm break-words">{msg.content}</p>
                                            <div className="text-[10px] opacity-50 text-right mt-1">
                                                {new Date(msg.createdAt).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>

                    {/* Input */}
                    <div className="border-t p-3">
                        <div className="flex gap-2">
                            <Input
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a message..."
                                disabled={sendMut.isPending}
                            />
                            <Button
                                size="icon"
                                onClick={handleSend}
                                disabled={!message.trim() || sendMut.isPending}
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}

// ─── Minister Assignment Component ────────────────────────────

function MinisterAssignment({
    departmentId,
    departments,
}: {
    departmentId: string;
    departments: DepartmentListItem[];
}) {
    const { toast } = useToast();
    const qc = useQueryClient();

    const [open, setOpen] = useState(false);
    const [fmId, setFmId] = useState('');
    const [finMinId, setFinMinId] = useState('');

    const dept = departments.find((d) => d.id === departmentId);

    // Get all mayors of this dept
    const mayorItems = useMemo(() => {
        if (!dept?.rooms) return [];
        return dept.rooms
            .flatMap((r) =>
                r.users.filter(
                    (u) => dept.rooms.some((rm) => rm.users.find((mu) => mu.id === u.id)),
                ),
            )
            .filter(
                (u, i, arr) => arr.findIndex((x) => x.id === u.id) === i,
            )
            .map((u) => ({ value: u.id, label: u.username }));
    }, [dept]);

    // Better: get mayors from rooms that have a mayor
    const realMayorItems = useMemo(() => {
        if (!dept?.rooms) return [];
        const allUsers = new Map<string, string>();
        for (const room of dept.rooms) {
            for (const u of room.users) {
                if (u.role === 'MAYOR' || u.role === 'PM' || u.role === 'MINISTER') {
                    allUsers.set(u.id, u.username);
                }
            }
        }
        return Array.from(allUsers.entries()).map(([id, name]) => ({
            value: id,
            label: name,
        }));
    }, [dept]);

    const assignMut = useMutation({
        mutationFn: () =>
            electionsApi.assignMinisters(departmentId, {
                foreignMinisterId: fmId,
                financeMinisterId: finMinId,
            }),
        onSuccess: () => {
            toast({ title: 'Ministers assigned successfully!' });
            qc.invalidateQueries({ queryKey: ['departments'] });
            qc.invalidateQueries({ queryKey: ['senate-chat', departmentId] });
            setFmId('');
            setFinMinId('');
        },
        onError: (err: any) =>
            toast({ title: 'Error', description: err.message, variant: 'destructive' }),
    });

    const currentFM = dept?.foreignMinister;
    const currentFinMin = dept?.financeMinister;

    return (
        <Card className="glass-card border-amber-500/20">
            <CardHeader
                className="pb-3 cursor-pointer select-none"
                onClick={() => setOpen((o) => !o)}
            >
                <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-amber-400" />
                    Minister Appointments
                    <span className={`ml-auto transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
                </CardTitle>
                {!open && (currentFM || currentFinMin) && (
                    <div className="flex flex-wrap gap-2 mt-1">
                        {currentFM && (
                            <Badge variant="outline" className="gap-1 text-xs">
                                <Landmark className="h-3 w-3" /> FM: {currentFM.username}
                            </Badge>
                        )}
                        {currentFinMin && (
                            <Badge variant="outline" className="gap-1 text-xs">
                                <Briefcase className="h-3 w-3" /> Finance: {currentFinMin.username}
                            </Badge>
                        )}
                    </div>
                )}
            </CardHeader>
            {open && (
                <CardContent className="space-y-4">
                    {/* Current ministers */}
                    {(currentFM || currentFinMin) && (
                        <div className="flex flex-wrap gap-3 text-sm">
                            {currentFM && (
                                <Badge variant="outline" className="gap-1">
                                    <Landmark className="h-3 w-3" />
                                    FM: {currentFM.username}
                                </Badge>
                            )}
                            {currentFinMin && (
                                <Badge variant="outline" className="gap-1">
                                    <Briefcase className="h-3 w-3" />
                                    Finance: {currentFinMin.username}
                                </Badge>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Foreign Minister</Label>
                            <SearchableDropdown
                                items={realMayorItems}
                                value={fmId}
                                onChange={setFmId}
                                placeholder="Select Foreign Minister"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Finance Minister</Label>
                            <SearchableDropdown
                                items={realMayorItems}
                                value={finMinId}
                                onChange={setFinMinId}
                                placeholder="Select Finance Minister"
                            />
                        </div>
                    </div>

                    {fmId && finMinId && fmId === finMinId && (
                        <p className="text-sm text-destructive">
                            Foreign Minister and Finance Minister must be different people
                        </p>
                    )}

                    <Button
                        disabled={!fmId || !finMinId || fmId === finMinId || assignMut.isPending}
                        onClick={() => assignMut.mutate()}
                    >
                        <Crown className="mr-2 h-4 w-4" />
                        {assignMut.isPending ? 'Assigning...' : 'Assign Ministers'}
                    </Button>
                </CardContent>
            )}
        </Card>
    );
}
