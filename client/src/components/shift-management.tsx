import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Clock, DollarSign, ShoppingCart, Play, Square, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { Shift, User } from "@shared/schema";

interface ShiftWithUser extends Shift {
  user: User;
}

interface ShiftManagementProps {
  currentUser: User;
  showReportsButton?: boolean;
}

export function ShiftManagement({ currentUser, showReportsButton = false }: ShiftManagementProps) {
  const [startNotes, setStartNotes] = useState("");
  const [endNotes, setEndNotes] = useState("");
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get active shifts
  const { data: activeShifts = [], isLoading } = useQuery<ShiftWithUser[]>({
    queryKey: ["/api/shifts/active"],
  });

  // Get current user's shifts
  const { data: userShifts = [] } = useQuery<Shift[]>({
    queryKey: ["/api/shifts/user", currentUser.id],
  });

  // Start shift mutation
  const startShiftMutation = useMutation({
    mutationFn: async (notes: string) => {
      const res = await apiRequest("POST", "/api/shifts/start", { notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setShowStartDialog(false);
      setStartNotes("");
      toast({
        title: "Shift Started",
        description: "Your shift has been started successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to start shift",
      });
    },
  });

  // End shift mutation
  const endShiftMutation = useMutation({
    mutationFn: async ({ shiftId, notes }: { shiftId: string; notes: string }) => {
      const res = await apiRequest("PATCH", `/api/shifts/${shiftId}/end`, { notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setShowEndDialog(false);
      setEndNotes("");
      toast({
        title: "Shift Ended",
        description: "Your shift has been ended successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to end shift",
      });
    },
  });

  const currentActiveShift = activeShifts.find(shift => shift.userId === currentUser.id);
  const hasActiveShift = !!currentActiveShift;

  const handleStartShift = () => {
    startShiftMutation.mutate(startNotes);
  };

  const handleEndShift = () => {
    if (currentActiveShift) {
      endShiftMutation.mutate({ shiftId: currentActiveShift.id, notes: endNotes });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shift Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Shift Management
          </CardTitle>
          <CardDescription>
            {hasActiveShift ? "You have an active shift running" : "Start your shift to begin tracking"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={hasActiveShift ? "default" : "secondary"}>
                {hasActiveShift ? "Active" : "Inactive"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {currentUser.firstName} {currentUser.lastName} ({currentUser.role})
              </span>
            </div>
            
            {hasActiveShift ? (
              <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    data-testid="button-end-shift"
                    className="gap-2"
                  >
                    <Square className="h-4 w-4" />
                    End Shift
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>End Shift</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to end your current shift? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="end-notes">End Notes (Optional)</Label>
                      <Textarea
                        id="end-notes"
                        placeholder="Add any notes about your shift..."
                        value={endNotes}
                        onChange={(e) => setEndNotes(e.target.value)}
                        data-testid="textarea-end-notes"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowEndDialog(false)}
                      data-testid="button-cancel-end"
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleEndShift}
                      disabled={endShiftMutation.isPending}
                      data-testid="button-confirm-end"
                    >
                      {endShiftMutation.isPending ? "Ending..." : "End Shift"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
                <DialogTrigger asChild>
                  <Button 
                    className="gap-2"
                    data-testid="button-start-shift"
                  >
                    <Play className="h-4 w-4" />
                    Start Shift
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Start Shift</DialogTitle>
                    <DialogDescription>
                      Start your shift to begin tracking your sales and performance.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="start-notes">Start Notes (Optional)</Label>
                      <Textarea
                        id="start-notes"
                        placeholder="Add any notes about starting your shift..."
                        value={startNotes}
                        onChange={(e) => setStartNotes(e.target.value)}
                        data-testid="textarea-start-notes"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowStartDialog(false)}
                      data-testid="button-cancel-start"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleStartShift}
                      disabled={startShiftMutation.isPending}
                      data-testid="button-confirm-start"
                    >
                      {startShiftMutation.isPending ? "Starting..." : "Start Shift"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Current Shift Details */}
          {hasActiveShift && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Current Shift Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p className="font-medium">
                      {new Date(currentActiveShift.startTime).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Sales</p>
                    <p className="font-medium" data-testid="text-current-sales">
                      {formatCurrency(parseFloat(currentActiveShift.totalSales))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Orders</p>
                    <p className="font-medium" data-testid="text-current-orders">
                      {currentActiveShift.totalOrders}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Cash</p>
                    <p className="font-medium" data-testid="text-current-cash">
                      {formatCurrency(parseFloat(currentActiveShift.cashCollected))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Shifts Overview (for managers/admins) */}
      {['admin', 'manager'].includes(currentUser.role) && activeShifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Shifts ({activeShifts.length})
            </CardTitle>
            <CardDescription>
              All currently active shifts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeShifts.map((shift) => (
                <div 
                  key={shift.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{shift.user.firstName} {shift.user.lastName}</p>
                      <p className="text-sm text-muted-foreground">
                        {shift.user.role} • Started {new Date(shift.startTime).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-medium">{formatCurrency(parseFloat(shift.totalSales))}</p>
                      <p className="text-muted-foreground">Sales</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{shift.totalOrders}</p>
                      <p className="text-muted-foreground">Orders</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Shifts */}
      {userShifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Shifts</CardTitle>
            <CardDescription>Your last 5 completed shifts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userShifts.slice(0, 5).map((shift) => {
                const duration = shift.endTime 
                  ? Math.round((new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60 * 1000)) / 1000
                  : 0;
                
                return (
                  <div 
                    key={shift.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(shift.startTime).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(shift.startTime).toLocaleTimeString()} - {' '}
                        {shift.endTime ? new Date(shift.endTime).toLocaleTimeString() : "Active"}
                        {duration > 0 && ` (${duration.toFixed(1)}h)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{formatCurrency(parseFloat(shift.totalSales))}</p>
                        <p className="text-muted-foreground">Sales</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{shift.totalOrders}</p>
                        <p className="text-muted-foreground">Orders</p>
                      </div>
                      <Badge variant={shift.isActive ? "default" : "secondary"}>
                        {shift.isActive ? "Active" : "Completed"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}