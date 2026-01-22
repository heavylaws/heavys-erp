import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Clock, Play, Square } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Shift, User } from "@shared/schema";

interface ShiftWithUser extends Shift {
  user: User;
}

interface ShiftButtonProps {
  currentUser: User;
  onShiftComplete?: (completedShift: Shift) => void;
  onLogout?: () => void;
}

export function ShiftButton({ currentUser, onShiftComplete, onLogout }: ShiftButtonProps) {
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [startNotes, setStartNotes] = useState("");
  const [endNotes, setEndNotes] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get active shifts to check if user has an active shift
  const { data: activeShifts = [], isLoading } = useQuery<ShiftWithUser[]>({
    queryKey: ["/api/shifts/active"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const currentActiveShift = activeShifts.find(shift => shift.userId === currentUser.id);
  const hasActiveShift = !!currentActiveShift;

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
    onSuccess: (completedShift: Shift) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setShowEndDialog(false);
      setEndNotes("");
      
      toast({
        title: "Shift Ended",
        description: "Your shift has been ended successfully.",
      });

      // Handle role-specific behavior
      if (currentUser.role === 'cashier' && onShiftComplete) {
        onShiftComplete(completedShift);
      } else if (['barista', 'courier'].includes(currentUser.role) && onLogout) {
        onLogout();
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to end shift",
      });
    },
  });

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
      <Button variant="outline" size="sm" disabled>
        <Clock className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  return (
    <>
      {hasActiveShift ? (
        <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <Button
            onClick={() => setShowEndDialog(true)}
            variant="destructive"
            size="sm"
            className="gap-2"
            data-testid="button-end-shift-header"
          >
            <Square className="h-4 w-4" />
            End Shift
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>End Shift</DialogTitle>
              <DialogDescription>
                Are you sure you want to end your current shift? 
                {currentUser.role === 'cashier' && " You'll see your shift summary next."}
                {['barista', 'courier'].includes(currentUser.role) && " This will log you out."}
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
                  data-testid="textarea-end-notes-header"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowEndDialog(false)}
                data-testid="button-cancel-end-header"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleEndShift}
                disabled={endShiftMutation.isPending}
                data-testid="button-confirm-end-header"
              >
                {endShiftMutation.isPending ? "Ending..." : "End Shift"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
          <Button
            onClick={() => setShowStartDialog(true)}
            variant="default"
            size="sm"
            className="gap-2"
            data-testid="button-start-shift-header"
          >
            <Play className="h-4 w-4" />
            Start Shift
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start Shift</DialogTitle>
              <DialogDescription>
                Start your shift to begin tracking your performance and sales.
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
                  data-testid="textarea-start-notes-header"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowStartDialog(false)}
                data-testid="button-cancel-start-header"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleStartShift}
                disabled={startShiftMutation.isPending}
                data-testid="button-confirm-start-header"
              >
                {startShiftMutation.isPending ? "Starting..." : "Start Shift"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}