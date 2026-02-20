import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { treatiesApi } from '@/api/treaties';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send } from 'lucide-react';

export default function TreatyChatPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['treaty-chat', id],
        queryFn: () => treatiesApi.getChatMessages(id!, 50),
        enabled: !!id,
        refetchInterval: 3000,
    });

    const sendMut = useMutation({
        mutationFn: (content: string) => treatiesApi.sendChatMessage(id!, content),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['treaty-chat', id] });
            setMessage('');
        },
    });

    const messages = data?.items ? [...data.items].reverse() : [];

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length]);

    const handleSend = () => {
        if (!message.trim()) return;
        sendMut.mutate(message.trim());
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b p-4 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(`/app/treaties/${id}`)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="font-semibold text-lg">Treaty Chat</h2>
                {data?.closed && <span className="text-xs text-red-400 ml-2">(Closed)</span>}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading ? (
                    <p className="text-muted-foreground text-center">Loading messages...</p>
                ) : messages.length === 0 ? (
                    <p className="text-muted-foreground text-center text-sm">No messages yet. Start the conversation!</p>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender.id === user?.id;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] rounded-lg px-3 py-2 ${isMe ? 'bg-primary text-primary-foreground' : 'glass-card'}`}>
                                    {!isMe && (
                                        <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                            {msg.sender.username}
                                        </p>
                                    )}
                                    <p className="text-sm">{msg.content}</p>
                                    <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                        {new Date(msg.createdAt).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input */}
            {!data?.closed && (
                <div className="border-t p-4 flex gap-2">
                    <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message..."
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <Button onClick={handleSend} disabled={!message.trim() || sendMut.isPending}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
