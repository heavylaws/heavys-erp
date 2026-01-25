import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Box, Package } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Component, ProductComponent } from "@shared/schema";

const addProductComponentSchema = z.object({
  componentId: z.string().min(1, "Please select a component"),
  quantity: z.string().min(1, "Quantity is required"),
  isOptional: z.boolean().optional().default(false),
});

type AddProductComponent = z.infer<typeof addProductComponentSchema>;

interface BundleManagerProps {
  productId: string;
  productName: string;
  trigger?: React.ReactNode;
}

export function BundleManager({ productId, productName, trigger }: BundleManagerProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<AddProductComponent>({
    resolver: zodResolver(addProductComponentSchema),
    defaultValues: {
      componentId: "",
      quantity: "",
      isOptional: false,
    },
  });

  // Fetch components
  const { data: components = [] } = useQuery<Component[]>({
    queryKey: ["/api/components"],
  });

  // Fetch product components
  const { data: productComponents = [], isLoading } = useQuery<ProductComponent[]>({
    queryKey: ["/api/products", productId, "components"],
    enabled: open,
  });

  // Add product component mutation
  const addComponentMutation = useMutation({
    mutationFn: async (data: AddProductComponent) => {
      const response = await apiRequest("POST", `/api/products/${productId}/components`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "components"] });
      toast({
        title: "Success",
        description: "Component added to bundle",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add component to bundle",
        variant: "destructive",
      });
    },
  });

  // Remove product component mutation
  const removeComponentMutation = useMutation({
    mutationFn: async (productComponentId: string) => {
      const response = await apiRequest("DELETE", `/api/product-components/${productComponentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "components"] });
      toast({
        title: "Success",
        description: "Component removed from bundle",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove component from bundle",
        variant: "destructive",
      });
    },
  });

  // Toggle optional mutation
  const toggleOptionalMutation = useMutation({
    mutationFn: async (item: ProductComponent) => {
      const response = await apiRequest("PATCH", `/api/product-components/${item.id}`, { isOptional: !item.isOptional });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "components"] });
    },
  });

  const onSubmit = (data: AddProductComponent) => {
    addComponentMutation.mutate(data);
  };

  const getComponentName = (componentId: string) => {
    const component = components.find(i => i.id === componentId);
    return component ? `${component.name} (${component.unit})` : "Unknown";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="flex items-center space-x-1">
            <Box className="h-4 w-4" />
            <span>Manage Bundle</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Box className="h-5 w-5" />
            <span>Bundle for {productName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Component Form */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3 flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Component</span>
            </h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="componentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Component</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select component" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {components.map((component) => (
                              <SelectItem key={component.id} value={component.id}>
                                {component.name} ({component.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" placeholder="Amount needed" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="isOptional"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={(val) => field.onChange(Boolean(val))} />
                      </FormControl>
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Optional Component</FormLabel>
                        <p className="text-xs text-muted-foreground">If checked, stock deduction occurs only when selected manually later.</p>
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={addComponentMutation.isPending}
                  className="w-full"
                >
                  {addComponentMutation.isPending ? "Adding..." : "Add to Bundle"}
                </Button>
              </form>
            </Form>
          </div>

          {/* Current Bundle */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3 flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Current Bundle</span>
            </h3>

            {isLoading ? (
              <div className="text-center py-4">Loading bundle...</div>
            ) : productComponents.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No components added yet. Add components above to create the bundle.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Optional</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productComponents.map((item) => {
                    const component = components.find(i => i.id === item.componentId); // Standardized to componentId
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {getComponentName(item.componentId)}
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          {component && (
                            <Badge variant={Number(component.stockQuantity) > Number(component.minThreshold) ? "default" : "destructive"}>
                              {component.stockQuantity} {component.unit}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant={item.isOptional ? "outline" : "secondary"}
                            size="sm"
                            onClick={() => toggleOptionalMutation.mutate(item)}
                            disabled={toggleOptionalMutation.isPending}
                          >
                            {item.isOptional ? 'Optional' : 'Required'}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeComponentMutation.mutate(item.id)}
                            disabled={removeComponentMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}