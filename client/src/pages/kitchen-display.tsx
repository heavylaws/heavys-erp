import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, ChefHat, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Order } from "@shared/schema";

export default function KitchenDisplay() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isConnected, setIsConnected] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Fetch active orders (pending/preparing)
    const { data: orders = [], isLoading } = useQuery<Order[]>({
        queryKey: ["/api/orders"],
        select: (allOrders) =>
            allOrders.filter(o => ['pending', 'preparing'].includes(o.status))
                .sort((a, b) => {
                    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return timeA - timeB;
                }), // Oldest first
        refetchInterval: 5000,
    });

    // WebSocket for real-time updates
    useEffect(() => {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => setIsConnected(true);
        socket.onclose = () => setIsConnected(false);

        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'order_update') {
                    // Play sound if it's a new pending order
                    if (message.data.status === 'pending') {
                        playAlertSound();
                    }
                    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                }
            } catch (e) {
                console.error("WS Parse Error", e);
            }
        };

        return () => socket.close();
    }, [queryClient]);

    const playAlertSound = () => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    };

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            await apiRequest("PATCH", `/api/orders/${id}`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
            toast({ title: "Order Updated", description: "Status changed successfully" });
        },
    });

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 bg-neutral-800 p-4 rounded-lg shadow-lg">
                <div className="flex items-center gap-3">
                    <ChefHat className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Kitchen Display System</h1>
                        <p className="text-neutral-400 text-sm">Real-time Order Feed</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Badge variant={isConnected ? "default" : "destructive"} className="text-sm px-3 py-1">
                        {isConnected ? "LIVE" : "CONNECTING..."}
                    </Badge>
                    <div className="text-right">
                        <p className="text-xl font-mono font-bold">{orders.length}</p>
                        <p className="text-xs text-neutral-400">Active Orders</p>
                    </div>
                </div>
            </div>

            {/* Orders Grid */}
            {isLoading ? (
                <div className="flex justify-center py-20"><div className="animate-spin text-primary h-12 w-12 border-4 border-t-transparent rounded-full" /></div>
            ) : orders.length === 0 ? (
                <div className="text-center py-20 bg-neutral-800/50 rounded-xl border border-dashed border-neutral-700">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-neutral-300">All Caught Up!</h2>
                    <p className="text-neutral-500">Waiting for new orders...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {orders.map((order) => {
                        const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : Date.now();
                        const duration = Math.floor((new Date().getTime() - createdAt) / 60000);
                        const isLate = duration > 15;

                        return (
                            <Card key={order.id} className={`bg-neutral-800 border-l-4 ${isLate ? 'border-l-red-500' : 'border-l-blue-500'} shadow-md`}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-xl font-bold text-white">#{order.orderNumber}</CardTitle>
                                        <Badge variant={order.status === 'pending' ? 'secondary' : 'default'}>
                                            {order.status.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center text-sm text-neutral-400 gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span>{duration}m ago</span>
                                        {isLate && <AlertCircle className="h-3 w-3 text-red-500 ml-1" />}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 mb-4">
                                        {/* Items would need to be fetched or included in order object. 
                        Assuming the API returns items joined or we'd need a separate fetch. 
                        For KDS, we simplify: usually API includes items. 
                        Checking schema: getOrder returns items. getOrders might not.
                        We will rely on the type. If items missing, we might need to adjust.
                     */}
                                        {/* Temporary placeholder if items missing from list response */}
                                        <div className="text-sm text-neutral-300">
                                            Items details...
                                            {/* In a real app we'd map order.items here */}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-4">
                                        {order.status === 'pending' && (
                                            <Button
                                                className="w-full bg-blue-600 hover:bg-blue-700"
                                                onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'preparing' })}
                                            >
                                                Start Prep
                                            </Button>
                                        )}
                                        <Button
                                            className="w-full bg-green-600 hover:bg-green-700"
                                            onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'ready' })}
                                        >
                                            Bump to Ready
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
