import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coffee, LogOut, CheckCircle, Clock, Play, Check, Volume2, AlertCircle } from "lucide-react";
import { useMobileOptimizations, playNotificationSound, vibrateFeedback } from "@/components/mobile-optimizations";
import { ShiftButton } from "@/components/shift-button";
import type { Order } from "@shared/schema";

interface OrderWithItems extends Order {
  items?: Array<{
    id: string;
    product?: {
      name: string;
      forTechnician?: boolean;
    };
    quantity: number;
    modifications?: string;
  }>;
}

export default function TechnicianScreen() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useMobileOptimizations();

  // WebSocket for real-time updates
  useWebSocket((message) => {
    if (message.type === 'order_update') {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      if (message.data?.status === 'pending') {
        playNotificationSound('success');
        vibrateFeedback([200, 100, 200]);
        toast({ title: "New Order", description: `#${message.data.orderNumber} received`, variant: "default" });
      }
    }
  });

  // Fetch ALL active orders relevant to Technician (Pending, Preparing, Ready) with items included
  const { data: allOrders = [] } = useQuery<OrderWithItems[]>({
    queryKey: ['/api/orders', { active_technician: true }],
    queryFn: async () => {
      // Fetch statuses we care about - now using optimized endpoint with items included
      const statuses = ['pending', 'preparing', 'ready'];
      const responses = await Promise.all(
        statuses.map(s => fetch(`/api/orders?status=${s}&include_items=true`, { credentials: 'include' }))
      );

      let combined: any[] = [];
      for (const res of responses) {
        if (res.ok) combined = [...combined, ...(await res.json())];
      }

      // Filter for orders with technician items (items already included in response)
      return combined
        .map(order => ({
          ...order,
          items: (order.items || []).filter((i: any) => i.product?.forTechnician)
        }))
        .filter(o => o.items && o.items.length > 0);
    },
    refetchInterval: 10000, // Safety poll
  });

  const pendingOrders = allOrders.filter(o => o.status === 'pending');
  const preparingOrders = allOrders.filter(o => o.status === 'preparing');
  const readyOrders = allOrders.filter(o => o.status === 'ready');

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to update order status');
      return res.json();
    },
    // Optimistic update: move order instantly in UI
    onMutate: async ({ id, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/orders'] });

      // Snapshot previous state
      const previousOrders = queryClient.getQueryData<OrderWithItems[]>(['/api/orders', { active_technician: true }]);

      // Optimistically update the cache
      queryClient.setQueryData<OrderWithItems[]>(['/api/orders', { active_technician: true }], (old) => {
        if (!old) return old;
        return old.map(order =>
          order.id === id ? { ...order, status: status as any } : order
        );
      });

      return { previousOrders };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousOrders) {
        queryClient.setQueryData(['/api/orders', { active_technician: true }], context.previousOrders);
      }
      toast({ title: "Error", description: "Failed to update order status", variant: "destructive" });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    }
  });

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    } catch (error) {
      window.location.href = '/';
    }
  };

  const notifyCustomer = async (id: string) => {
    await fetch(`/api/orders/${id}/call`, { method: 'POST', credentials: 'include' });
    toast({ title: "Customer Notified", description: "Bell rung!" });
    queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
  };

  if (isLoading) return <div className="p-10 text-center">Loading Operations...</div>;

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-orange-600 rounded-lg p-2 text-white"><Coffee size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Technician Station</h1>
            <p className="text-sm text-stone-500">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-3">
          {user && <ShiftButton currentUser={user as any} onLogout={handleLogout} />}
          <Button variant="ghost" onClick={handleLogout}><LogOut /></Button>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex gap-6 h-full min-w-[1000px]">

          {/* PENDING COLUMN */}
          <div className="flex-1 flex flex-col bg-gray-200/50 rounded-xl border border-gray-200/60 backdrop-blur-sm">
            <div className="p-4 border-b border-gray-200 bg-white/50 rounded-t-xl flex justify-between items-center sticky top-0">
              <h2 className="font-bold text-gray-700 flex items-center gap-2">
                <Clock size={20} className="text-orange-500" /> Pending
              </h2>
              <Badge variant="outline" className="bg-white text-orange-600 font-mono text-lg">{pendingOrders.length}</Badge>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {pendingOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  actionLabel="Start Prep"
                  actionColor="bg-blue-600 hover:bg-blue-700"
                  onAction={() => updateStatus.mutate({ id: order.id, status: 'preparing' })}
                  accentColor="border-l-orange-500"
                  isDisabled={updateStatus.isPending}
                />
              ))}
              {pendingOrders.length === 0 && <EmptyState label="No pending orders" />}
            </div>
          </div>

          {/* PREPARING COLUMN */}
          <div className="flex-1 flex flex-col bg-blue-50/50 rounded-xl border border-blue-100 backdrop-blur-sm">
            <div className="p-4 border-b border-blue-100 bg-white/50 rounded-t-xl flex justify-between items-center sticky top-0">
              <h2 className="font-bold text-blue-900 flex items-center gap-2">
                <Play size={20} className="text-blue-600" /> Preparing
              </h2>
              <Badge variant="outline" className="bg-white text-blue-600 font-mono text-lg">{preparingOrders.length}</Badge>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {preparingOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  actionLabel="Mark Ready"
                  actionColor="bg-green-600 hover:bg-green-700"
                  onAction={() => updateStatus.mutate({ id: order.id, status: 'ready' })}
                  accentColor="border-l-blue-500"
                  isDisabled={updateStatus.isPending}
                />
              ))}
              {preparingOrders.length === 0 && <EmptyState label="Nothing in progress" />}
            </div>
          </div>

          {/* READY COLUMN */}
          <div className="flex-1 flex flex-col bg-green-50/50 rounded-xl border border-green-100 backdrop-blur-sm">
            <div className="p-4 border-b border-green-100 bg-white/50 rounded-t-xl flex justify-between items-center sticky top-0">
              <h2 className="font-bold text-green-900 flex items-center gap-2">
                <CheckCircle size={20} className="text-green-600" /> Ready for Pickup
              </h2>
              <Badge variant="outline" className="bg-white text-green-600 font-mono text-lg">{readyOrders.length}</Badge>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {readyOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  actionLabel="Notify Customer"
                  actionColor="bg-stone-700 hover:bg-stone-800"
                  onAction={() => notifyCustomer(order.id)}
                  accentColor="border-l-green-500"
                  showTime
                />
              ))}
              {readyOrders.length === 0 && <EmptyState label="Pickup queue clear" />}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, actionLabel, actionColor, onAction, accentColor, showTime, isDisabled }: any) {
  const elapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  const isLate = elapsed > 10;

  return (
    <Card className={`border-l-4 shadow-sm hover:shadow-md transition-shadow ${accentColor}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-xl font-bold text-stone-800">#{order.orderNumber}</h3>
            <div className={`text-xs font-medium flex items-center gap-1 ${isLate && !showTime ? 'text-red-500' : 'text-stone-500'}`}>
              <Clock size={12} /> {elapsed}m ago
            </div>
          </div>
          {isLate && !showTime && <AlertCircle className="text-red-500 animate-pulse" size={20} />}
        </div>

        {/* Items List */}
        <div className="space-y-2 mb-4">
          {order.items.map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm border-b border-dashed border-gray-100 pb-1 last:border-0">
              <span className="font-medium text-stone-700">{item.quantity}x {item.product?.name}</span>
            </div>
          ))}
        </div>

        {/* Large Action Button */}
        <Button
          className={`w-full h-12 text-lg font-semibold shadow-sm ${actionColor}`}
          onClick={onAction}
          disabled={isDisabled}
        >
          {isDisabled ? 'Updating...' : actionLabel}
        </Button>
      </CardContent>
    </Card>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="h-32 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg text-gray-400 font-medium">
      {label}
    </div>
  )
}
