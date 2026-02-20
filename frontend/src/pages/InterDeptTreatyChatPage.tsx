import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { interDeptTreatiesApi } from '@/api/interDeptTreaties';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Globe } from 'lucide-react';
import type { CaseChatMessage } from '@/types';

export default function InterDeptTreatyChatPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['inter-dept-treaty-chat', id],
        queryFn: () => interDeptTreatiesApi.getChatMessages(id!),
        enabled: !!id,
        refetchInterval: 3000,
    });

    const sendMut = useMutation({
        mutationFn: (content: string) => interDeptTreatiesApi.sendChatMessage(id!, content),
        onSuccess: () => {
            setMessage('');
            queryClient.invalidateQueries({ queryKey: ['inter-dept-treaty-chat', id] });
        },
    });

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [data?.items]);

    const handleSend = () => {
        if (!message.trim()) return;
        sendMut.mutate(message.trim());
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="border-b p-4 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/app/inter-dept-treaties/${id}`)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <Globe className="h-5 w-5 text-emerald-400" />
                <h2 className="font-semibold">Inter-Dept Treaty Chat</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading ? (
                    <p className="text-muted-foreground text-center">Loading messages...</p>
                ) : (data?.items ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No messages yet. Start the conversation!</p>
                ) : (
                    (data?.items ?? []).map((msg: CaseChatMessage) => {
                        const isMe = msg.sender.id === user?.id;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] rounded-lg p-3 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                    <p className="text-xs font-medium mb-1">{msg.sender.username}</p>
                                    <p className="text-sm">{msg.content}</p>
                                    <p className="text-xs opacity-60 mt-1">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {!data?.closed && (
                <div className="border-t p-4 flex gap-2">
                    <Input
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message..."
                        className="flex-1"
                    />
                    <Button onClick={handleSend} disabled={!message.trim() || sendMut.isPending}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
