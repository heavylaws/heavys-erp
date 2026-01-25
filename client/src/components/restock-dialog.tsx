import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Package, Plus } from "lucide-react";

const restockSchema = z.object({
  quantity: z.number().min(0.001, "Quantity must be greater than 0"),
  reason: z.string().min(1, "Reason is required").max(200, "Reason must be less than 200 characters"),
});

type RestockFormData = z.infer<typeof restockSchema>;

interface RestockDialogProps {
  item: {
    id: string;
    name: string;
    stockQuantity: number | string;
    unit?: string;
    type: 'product' | 'component';
    productType?: 'finished_good' | 'component_based';
  };
  children: React.ReactNode;
}

export function RestockDialog({ item, children }: RestockDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<RestockFormData>({
    resolver: zodResolver(restockSchema),
    defaultValues: {
      quantity: 0,
      reason: "Stock replenishment",
    },
  });

  const restockMutation = useMutation({
    mutationFn: async (data: RestockFormData) => {
      const endpoint = item.type === 'product'
        ? `/api/products/${item.id}/stock`
        : `/api/components/${item.id}/stock`;
      const res = await apiRequest("PATCH", endpoint, {
        quantityChange: data.quantity, // Positive number for adding stock
        reason: data.reason,
      });

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Stock Updated",
        description: `Successfully added ${form.getValues('quantity')} ${item.unit || 'units'} to ${item.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/low-stock'] });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stock",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RestockFormData) => {
    restockMutation.mutate(data);
  };

  const currentStock = typeof item.stockQuantity === 'string'
    ? parseFloat(item.stockQuantity)
    : item.stockQuantity;

  const newQuantity = currentStock + (form.watch('quantity') || 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Restock Item
          </DialogTitle>
          <DialogDescription>
            Add new stock for <strong>{item.name}</strong>
            <br />
            Current stock: <strong>{currentStock} {item.unit || 'units'}</strong>
          </DialogDescription>
        </DialogHeader>

        {item.productType === 'component_based' ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Bundle-Based Product</p>
              <p>
                This product's stock is managed automatically based on its ingredients.
                You should restock the individual ingredients instead.
              </p>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity to Add *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.001"
                        min="0.001"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <div className="text-sm text-gray-600">
                      New total: {newQuantity.toFixed(item.type === 'component' ? 3 : 0)} {item.unit || 'units'}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Weekly delivery, Emergency restock, etc."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={restockMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={restockMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {restockMutation.isPending ? (
                    "Adding Stock..."
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Stock
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}