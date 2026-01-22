import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2, X } from "lucide-react";

const addProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  barcode: z.string().optional(),
  barcodes: z.array(z.string()).default([]),
  price: z.string().min(1, "Selling price is required"),
  costPerUnit: z.string().optional(),
  profitMargin: z.string().default("25"),
  categoryId: z.string().min(1, "Category is required"),
  type: z.enum(["finished_good", "ingredient_based"]).default("finished_good"),
  stockQuantity: z.number().min(0, "Stock quantity must be 0 or greater").default(0),
  minThreshold: z.number().min(0, "Minimum threshold must be 0 or greater").default(5),
  forBarista: z.boolean().default(false),
});

type AddProductForm = z.infer<typeof addProductSchema>;

interface AddProductDialogProps {
  children?: React.ReactNode;
  buttonVariant?: "default" | "outline" | "secondary" | "ghost";
  buttonSize?: "default" | "sm" | "lg";
  className?: string;
}

export function AddProductDialog({
  children,
  buttonVariant = "default",
  buttonSize = "default",
  className = ""
}: AddProductDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tempBarcode, setTempBarcode] = useState("");

  const form = useForm<AddProductForm>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      name: "",
      description: "",
      barcode: "",
      barcodes: [],
      price: "",
      costPerUnit: "",
      profitMargin: "25",
      categoryId: "",
      type: "finished_good",
      stockQuantity: 0,
      minThreshold: 5,
      forBarista: false,
    },
  });

  // Watch cost and margin to auto-calculate price
  const watchCost = form.watch("costPerUnit");
  const watchMargin = form.watch("profitMargin");

  const calculatePrice = (cost: string, margin: string) => {
    const costNum = parseFloat(cost) || 0;
    const marginNum = parseFloat(margin) || 0;
    if (costNum > 0) {
      return (costNum * (1 + marginNum / 100)).toFixed(2);
    }
    return "";
  };

  const autoCalcPrice = () => {
    const calculated = calculatePrice(watchCost || "", watchMargin || "25");
    if (calculated) {
      form.setValue("price", calculated);
    }
  };

  // Fetch categories for the dropdown
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: AddProductForm) => {
      const response = await apiRequest("POST", "/api/products", data);
      return response.json();
    },
    onSuccess: (newProduct: any) => {
      toast({
        title: "Success",
        description: `Product "${newProduct.name}" has been created successfully.`,
      });

      // Invalidate queries to refresh the product list
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });

      // Reset form and close dialog
      form.reset();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create product. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddProductForm) => {
    createProductMutation.mutate(data);
  };

  const defaultTrigger = (
    <Button
      variant={buttonVariant}
      size={buttonSize}
      className={className}
    >
      <Plus className="h-4 w-4 mr-2" />
      Add Product
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || defaultTrigger}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Create a new product for your cafe menu. Make sure to set appropriate pricing and stock levels.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Cappuccino, Ham Sandwich"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of the product"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Barcode</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 1234567890123"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="barcodes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Barcodes</FormLabel>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {field.value?.map((code, idx) => (
                        <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                          {code}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => {
                            const newCodes = [...(field.value || [])];
                            newCodes.splice(idx, 1);
                            field.onChange(newCodes);
                          }} />
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={tempBarcode}
                        onChange={(e) => setTempBarcode(e.target.value)}
                        placeholder="Scan or type additional barcode"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (tempBarcode) {
                              const newCodes = [...(field.value || [])];
                              if (!newCodes.includes(tempBarcode)) {
                                field.onChange([...newCodes, tempBarcode]);
                                setTempBarcode("");
                              }
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          if (tempBarcode) {
                            const newCodes = [...(field.value || [])];
                            if (!newCodes.includes(tempBarcode)) {
                              field.onChange([...newCodes, tempBarcode]);
                              setTempBarcode("");
                            }
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="costPerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          onBlur={() => autoCalcPrice()}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="profitMargin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profit Margin (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max="500"
                          placeholder="25"
                          {...field}
                          onBlur={() => autoCalcPrice()}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price ($) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          className={watchCost ? "bg-green-50 border-green-300" : ""}
                        />
                      </FormControl>
                      {watchCost && (
                        <span className="text-xs text-green-600">
                          Auto-calculated from cost + {watchMargin || 25}% margin
                        </span>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoriesLoading ? (
                            <SelectItem value="loading" disabled>
                              Loading categories...
                            </SelectItem>
                          ) : (
                            Array.isArray(categories) && categories.map((category: any) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="finished_good">Finished Good</SelectItem>
                        <SelectItem value="ingredient_based">Recipe-Based</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="forBarista"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>For Barista</FormLabel>
                      <span className="text-sm text-muted-foreground">
                        When enabled, this item will appear on the barista screen.
                      </span>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="stockQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Stock</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Low Stock Alert</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={createProductMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createProductMutation.isPending}
                >
                  {createProductMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create Product
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog >
  );
}