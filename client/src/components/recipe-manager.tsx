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
import { Plus, Trash2, ChefHat, Package } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Ingredient, RecipeIngredient } from "@shared/schema";

const addRecipeIngredientSchema = z.object({
  ingredientId: z.string().min(1, "Please select an ingredient"),
  quantity: z.string().min(1, "Quantity is required"),
  isOptional: z.boolean().optional().default(false),
});

type AddRecipeIngredient = z.infer<typeof addRecipeIngredientSchema>;

interface RecipeManagerProps {
  productId: string;
  productName: string;
  trigger?: React.ReactNode;
}

export function RecipeManager({ productId, productName, trigger }: RecipeManagerProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<AddRecipeIngredient>({
    resolver: zodResolver(addRecipeIngredientSchema),
    defaultValues: {
      ingredientId: "",
      quantity: "",
      isOptional: false,
    },
  });

  // Fetch ingredients
  const { data: ingredients = [] } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  });

  // Fetch recipe ingredients
  const { data: recipeIngredients = [], isLoading } = useQuery<RecipeIngredient[]>({
    queryKey: ["/api/products", productId, "recipe"],
    enabled: open,
  });

  // Add recipe ingredient mutation
  const addIngredientMutation = useMutation({
    mutationFn: async (data: AddRecipeIngredient) => {
      const response = await apiRequest("POST", `/api/products/${productId}/recipe`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "recipe"] });
      toast({
        title: "Success",
        description: "Ingredient added to recipe",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add ingredient to recipe",
        variant: "destructive",
      });
    },
  });

  // Remove recipe ingredient mutation
  const removeIngredientMutation = useMutation({
    mutationFn: async (recipeIngredientId: string) => {
      const response = await apiRequest("DELETE", `/api/recipe-ingredients/${recipeIngredientId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "recipe"] });
      toast({
        title: "Success",
        description: "Ingredient removed from recipe",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove ingredient from recipe",
        variant: "destructive",
      });
    },
  });

  // Toggle optional mutation
  const toggleOptionalMutation = useMutation({
    mutationFn: async (item: RecipeIngredient) => {
      const response = await apiRequest("PATCH", `/api/recipe-ingredients/${item.id}`, { isOptional: !item.isOptional });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", productId, "recipe"] });
    },
  });

  const onSubmit = (data: AddRecipeIngredient) => {
    addIngredientMutation.mutate(data);
  };

  const getIngredientName = (ingredientId: string) => {
    const ingredient = ingredients.find(i => i.id === ingredientId);
    return ingredient ? `${ingredient.name} (${ingredient.unit})` : "Unknown";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="flex items-center space-x-1">
            <ChefHat className="h-4 w-4" />
            <span>Manage Recipe</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <ChefHat className="h-5 w-5" />
            <span>Recipe for {productName}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Add Ingredient Form */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3 flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Ingredient</span>
            </h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ingredientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ingredient</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select ingredient" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ingredients.map((ingredient) => (
                              <SelectItem key={ingredient.id} value={ingredient.id}>
                                {ingredient.name} ({ingredient.unit})
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
                        <FormLabel className="text-sm">Optional Ingredient</FormLabel>
                        <p className="text-xs text-muted-foreground">If checked, stock deduction occurs only when selected manually later.</p>
                      </div>
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  disabled={addIngredientMutation.isPending}
                  className="w-full"
                >
                  {addIngredientMutation.isPending ? "Adding..." : "Add to Recipe"}
                </Button>
              </form>
            </Form>
          </div>

          {/* Current Recipe */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3 flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Current Recipe</span>
            </h3>
            
            {isLoading ? (
              <div className="text-center py-4">Loading recipe...</div>
            ) : recipeIngredients.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No ingredients added yet. Add ingredients above to create the recipe.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Optional</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipeIngredients.map((item) => {
                    const ingredient = ingredients.find(i => i.id === item.ingredientId);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {getIngredientName(item.ingredientId)}
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          {ingredient && (
                            <Badge variant={Number(ingredient.stockQuantity) > Number(ingredient.minThreshold) ? "default" : "destructive"}>
                              {ingredient.stockQuantity} {ingredient.unit}
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
                            onClick={() => removeIngredientMutation.mutate(item.id)}
                            disabled={removeIngredientMutation.isPending}
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