import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { CameraCapture } from './camera-capture';
import { Laptop } from 'lucide-react';


import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Loader2, X, Camera } from "lucide-react";

const addProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  barcode: z.string().optional(),
  barcodes: z.array(z.string()).default([]),
  price: z.coerce.number().min(0.01, "Selling price is required and must be greater than 0"),
  costPerUnit: z.coerce.number().optional(),
  profitMargin: z.string().default("25"),
  categoryId: z.string().min(1, "Category is required"),
  type: z.enum(["finished_good", "component_based"]).default("finished_good"),
  stockQuantity: z.coerce.number().min(0, "Stock quantity must be 0 or greater").default(0),
  minThreshold: z.coerce.number().min(0, "Minimum threshold must be 0 or greater").default(5),
  requiresFulfillment: z.boolean().default(false),
  imageUrl: z.string().optional(),
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
  const [uploading, setUploading] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);

  const handleWebcamCapture = (file: File) => {
    // Reuse existing upload logic
    const event = { target: { files: [file] } } as any;
    handleImageUpload(event);
  };

  const form = useForm<AddProductForm>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      name: "",
      description: "",
      barcode: "",
      barcodes: [],
      price: 0,
      costPerUnit: 0,
      profitMargin: "25",
      categoryId: "",
      type: "finished_good",
      stockQuantity: 0,
      minThreshold: 5,
      requiresFulfillment: false,
      imageUrl: "",
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/v1/products/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        form.setValue("imageUrl", data.url);
        toast({ title: "Success", description: "Image uploaded successfully" });
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Prevent implicit submission on Enter key (standard for barcode scanners)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // Check if the target is the temporary barcode input, which HAS its own handler
      // We don't want to double-block it if it's already handled, but purely blocking form submit is specific
      // The scanner usually sends 'Enter' at the end of a scan.
      // If we are in the barcode field, we want that specific logic (add tag).
      // If we are in 'Name' or 'Price', we do NOT want to submit the form.

      const target = e.target as HTMLElement;
      // Allow Enter on Textareas
      if (target.tagName === "TEXTAREA") return;

      // Allow Enter on Buttons (accessibility)
      if (target.tagName === "BUTTON") return;

      // For all other inputs (text, number), prevent default form submission
      e.preventDefault();
    }
  };

  // Watch cost and margin to auto-calculate price
  const watchCost = form.watch("costPerUnit");
  const watchMargin = form.watch("profitMargin");

  const calculatePrice = (cost: number | undefined, margin: string) => {
    const costNum = cost || 0;
    const marginNum = parseFloat(margin) || 0;
    if (costNum > 0) {
      return (costNum * (1 + marginNum / 100)).toFixed(2);
    }
    return "";
  };

  const autoCalcPrice = () => {
    const calculated = calculatePrice(watchCost, watchMargin || "25");
    if (calculated) {
      form.setValue("price", parseFloat(calculated));
    }
  };

  // Fetch categories for the dropdown
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: AddProductForm) => {
      // Ensure specific transforms if needed (e.g. string to number) - zod handles coerce now
      const payload = {
        ...data,
        // The server expects strings for decimals often in this app? 
        // Let's check schema.ts. Usually 'decimal' in postgres is returned as string, but accepted as number/string in JSON.
        // Let's send as is, zod coerced them to numbers.
      };
      const response = await apiRequest("POST", "/api/products", payload);
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
    <>
      <CameraCapture
        open={showWebcam}
        onOpenChange={setShowWebcam}
        onCapture={handleWebcamCapture}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {children || defaultTrigger}
        </DialogTrigger>

        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="p-6 pb-2">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>
                Create a new product for your menu. Make sure to set appropriate pricing and stock levels.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 min-h-0">
            <Form {...form}>
              <form id="add-product-form" onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-4 py-4">

                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <label
                      htmlFor="image-upload"
                      className="h-32 w-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      {form.watch("imageUrl") ? (
                        <img src={form.watch("imageUrl")} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <Camera className="h-10 w-10 text-gray-300" />
                      )}
                    </label>
                    <div className="absolute -bottom-2 -right-2 flex gap-2">
                      {/* Gallery Input */}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="image-upload"
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                      {/* Camera Input */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        id="camera-upload"
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />

                      {/* Webcam Button (Desktop) */}
                      <button
                        type="button"
                        onClick={() => setShowWebcam(true)}
                        className="h-8 w-8 bg-purple-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-700 shadow-sm"
                        title="Use Webcam (Laptop)"
                      >
                        <Laptop className="h-4 w-4" />
                      </button>

                      {/* Camera Button */}
                      <label
                        htmlFor="camera-upload"
                        className="h-8 w-8 bg-blue-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 shadow-sm"
                        title="Take Photo"
                      >
                        <Camera className="h-4 w-4" />
                      </label>

                      {/* Gallery Button */}
                      <label
                        htmlFor="image-upload"
                        className="h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90 shadow-sm"
                        title="Upload from Gallery"
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </label>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Cappuccino, Hammer"
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
                          <SelectItem value="component_based">Bundle / Component Based</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requiresFulfillment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Required Fulfillment (Technician)</FormLabel>
                        <span className="text-sm text-muted-foreground">
                          When enabled, this item will appear on the technician/fulfillment screen.
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
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
          </div>

          <DialogFooter className="p-6 pt-2">
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
              form="add-product-form"
              disabled={createProductMutation.isPending}
            >
              {createProductMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}