import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Settings, TrendingUp, DollarSign, History } from 'lucide-react';
import { formatDualCurrency, validateExchangeRate } from '@shared/currency-utils';
import { apiRequest, queryClient } from '@/lib/queryClient';

const updateRateSchema = z.object({
  rate: z.string().min(1, 'Exchange rate is required'),
});

type UpdateRateForm = z.infer<typeof updateRateSchema>;

interface CurrencyRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CurrencyRateManagerProps {
  currentUser: any;
  canEdit?: boolean;
}

export function CurrencyRateManager({ currentUser, canEdit = false }: CurrencyRateManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch current exchange rate
  const { data: currentRate, isLoading } = useQuery<CurrencyRate>({
    queryKey: ['/api/currency/current'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/currency/current');
      return res.json();
    },
    enabled: true,
  });

  // Fetch rate history
  const { data: rateHistory } = useQuery<CurrencyRate[]>({
    queryKey: ['/api/currency/history'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/currency/history');
      return res.json();
    },
    enabled: canEdit,
  });

  const form = useForm<UpdateRateForm>({
    resolver: zodResolver(updateRateSchema),
    defaultValues: {
      rate: currentRate?.rate || '',
    },
  });

  // Update rate mutation
  const updateRateMutation = useMutation({
    mutationFn: async (data: UpdateRateForm) => {
      const validation = validateExchangeRate(data.rate);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const res = await apiRequest('POST', '/api/currency/update', {
        fromCurrency: 'USD',
        toCurrency: 'LBP', 
        rate: data.rate,
        updatedBy: currentUser.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/currency/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/currency/history'] });
      toast({
        title: 'Exchange rate updated',
        description: 'Currency conversion rates have been updated successfully.',
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update rate',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: UpdateRateForm) => {
    updateRateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Currency Exchange Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading exchange rate...</div>
        </CardContent>
      </Card>
    );
  }

  const currentExchangeRate = currentRate ? parseFloat(currentRate.rate) : 89500;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Current Exchange Rate
          </CardTitle>
          <CardDescription>
            USD to LBP conversion rate for menu pricing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  1 USD = {currentExchangeRate.toLocaleString()} LBP
                </div>
                <div className="text-sm text-muted-foreground">
                  Last updated: {currentRate ? new Date(currentRate.updatedAt).toLocaleDateString() : 'Never'}
                </div>
              </div>
              {canEdit && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Settings className="mr-2 h-4 w-4" />
                      Update Rate
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Update Exchange Rate</DialogTitle>
                      <DialogDescription>
                        Set the new USD to LBP exchange rate. This will affect all prices.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="rate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Rate (1 USD = ? LBP)</FormLabel>
                              <FormControl>
                                <Input type="number" placeholder="e.g., 89500" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={updateRateMutation.isPending}>
                          {updateRateMutation.isPending ? 'Updating...' : 'Update Rate'}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Rate Change History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rateHistory && rateHistory.length > 0 ? (
              <ul className="space-y-2">
                {rateHistory.slice(0, 5).map((rate) => (
                  <li key={rate.id} className="flex justify-between text-sm">
                    <span>
                      1 USD = {parseFloat(rate.rate).toLocaleString()} LBP
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(rate.updatedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No rate history available.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}