import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CameraCapture } from './camera-capture';
import { Laptop } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { Edit, Package, X, Camera, Loader2, Plus } from "lucide-react";

import { insertProductSchema, type InsertProduct, type Product, type Category } from "@shared/schema";

const formSchema = insertProductSchema.extend({
  barcodes: z.array(z.string()).optional(),
  imageUrl: z.string().optional(),
});
type EditProductForm = z.infer<typeof formSchema>;

interface EditProductDialogProps {
  product: Product;
  children?: React.ReactNode;
}

export function EditProductDialog({ product, children }: EditProductDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [tempBarcode, setTempBarcode] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<EditProductForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: product.name,
      description: product.description || "",
      barcode: product.barcode || "",
      price: product.price,
      costPerUnit: (product as any).costPerUnit || "",
      profitMargin: (product as any).profitMargin || "25",
      categoryId: product.categoryId || "",
      type: product.type,
      stockQuantity: product.stockQuantity,
      minThreshold: product.minThreshold,
      isActive: product.isActive,
      requiresFulfillment: (product as any).requiresFulfillment ?? false,
      barcodes: product.barcodes || [],
      imageUrl: (product as any).imageUrl || "",
    },
  });

  useEffect(() => {
    form.reset({
      name: product.name,
      description: product.description || "",
      barcode: product.barcode || "",
      price: product.price,
      costPerUnit: (product as any).costPerUnit || "",
      profitMargin: (product as any).profitMargin || "25",
      categoryId: product.categoryId || "",
      type: product.type,
      stockQuantity: product.stockQuantity,
      minThreshold: product.minThreshold,
      isActive: product.isActive,
      requiresFulfillment: (product as any).requiresFulfillment ?? false,
      barcodes: product.barcodes || [],
      imageUrl: (product as any).imageUrl || "",
    });
  }, [product, form]);

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
    const calculated = calculatePrice(String(watchCost || ""), String(watchMargin || "25"));
    if (calculated) {
      form.setValue("price", calculated);
    }
  };

  const updateProductMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      const response = await apiRequest("PATCH", `/api/products/${product.id}`, data);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({
        title: "Success",
        description: `Product "${data.name}" updated successfully`,
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product. Please try again.",
        variant: "destructive",
      });
    },
  });


  const [showWebcam, setShowWebcam] = useState(false);

  const handleWebcamCapture = (file: File) => {
    // Reuse existing upload logic
    const event = { target: { files: [file] } } as any;
    handleImageUpload(event);
  };

  const onSubmit = (data: EditProductForm) => {
    updateProductMutation.mutate(data);
  };

  const defaultTrigger = (
    <Button variant="ghost" size="sm">
      <Edit className="h-4 w-4" />
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Edit Product</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 pr-4 -mr-4 min-h-0 overflow-y-auto">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <label
                      htmlFor="edit-image-upload"
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
                        id="edit-image-upload"
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                      {/* Camera Input */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        id="edit-camera-upload"
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
                        htmlFor="edit-camera-upload"
                        className="h-8 w-8 bg-blue-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 shadow-sm"
                        title="Take Photo"
                      >
                        <Camera className="h-4 w-4" />
                      </label>

                      {/* Gallery Button */}
                      <label
                        htmlFor="edit-image-upload"
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
                        <Input placeholder="e.g., Cappuccino, Turkey Sandwich" {...field} />
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
                          placeholder="Brief description of the product..."
                          className="resize-none"
                          {...field}
                          value={field.value || ""}
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
                          value={field.value || ""}
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
                            value={field.value || ""}
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
                            value={field.value || "25"}
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
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="requiresFulfillment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Requires Fulfillment</FormLabel>
                        <span className="text-sm text-muted-foreground">
                          When enabled, this item will appear on the technician screen.
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

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="finished_good">Finished Good</SelectItem>
                          <SelectItem value="component_based">Bundle-Based</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="stockQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock Quantity *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
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
                        <FormLabel>Low Stock Alert *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="5"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Active Product</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Product is available for sale
                        </div>
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

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateProductMutation.isPending}>
                    {updateProductMutation.isPending ? "Updating..." : "Update Product"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}