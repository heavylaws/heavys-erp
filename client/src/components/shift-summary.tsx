import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, DollarSign, ShoppingCart, TrendingUp, Award, LogOut, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDualCurrency } from "@shared/currency-utils";
import type { Shift, User, CurrencyRate, CompanySettings } from "@shared/schema";

interface ShiftSummaryProps {
  currentUser: User;
  completedShift: Shift;
  onLogout: () => void;
}

export function ShiftSummary({ currentUser, completedShift, onLogout }: ShiftSummaryProps) {
  const [shiftDuration, setShiftDuration] = useState<string>("");

  // Get current exchange rate
  const { data: currentRate } = useQuery<CurrencyRate>({
    queryKey: ["/api/currency-rates/current"],
  });

  const { data: settings } = useQuery<CompanySettings>({ queryKey: ['/api/settings/company'] });
  const companyName = settings?.name || "Highway Cafe";

  useEffect(() => {
    if (completedShift.startTime && completedShift.endTime) {
      const start = new Date(completedShift.startTime);
      const end = new Date(completedShift.endTime);
      const durationMs = end.getTime() - start.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      setShiftDuration(`${hours}h ${minutes}m`);
    }
  }, [completedShift]);

  const totalSales = parseFloat(completedShift.totalSales);
  const cashCollected = parseFloat(completedShift.cashCollected);
  const cardCollected = parseFloat(completedShift.cardCollected);
  const avgOrderValue = completedShift.totalOrders > 0 ? totalSales / completedShift.totalOrders : 0;

  const printShiftSummary = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shift Summary - ${currentUser.firstName} ${currentUser.lastName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .summary-item { padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
          .total { font-size: 1.2em; font-weight: bold; color: #2563eb; }
          .footer { margin-top: 30px; text-align: center; font-size: 0.9em; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>{companyName} - Shift Summary</h1>
          <p><strong>Employee:</strong> ${currentUser.firstName} ${currentUser.lastName} (${currentUser.role})</p>
          <p><strong>Date:</strong> ${new Date(completedShift.startTime).toLocaleDateString()}</p>
          <p><strong>Shift Time:</strong> ${new Date(completedShift.startTime).toLocaleTimeString()} - ${new Date(completedShift.endTime!).toLocaleTimeString()}</p>
          <p><strong>Duration:</strong> ${shiftDuration}</p>
        </div>

        <div class="summary-grid">
          <div class="summary-item">
            <h3>Total Sales</h3>
            <p class="total">${formatCurrency(totalSales)}</p>
          </div>
          <div class="summary-item">
            <h3>Orders Processed</h3>
            <p class="total">${completedShift.totalOrders}</p>
          </div>
          <div class="summary-item">
            <h3>Cash Collected</h3>
            <p class="total">${formatCurrency(cashCollected)}</p>
          </div>
          <div class="summary-item">
            <h3>Card Payments</h3>
            <p class="total">${formatCurrency(cardCollected)}</p>
          </div>
          <div class="summary-item">
            <h3>Average Order Value</h3>
            <p class="total">${formatCurrency(avgOrderValue)}</p>
          </div>
          <div class="summary-item">
            <h3>Orders per Hour</h3>
            <p class="total">${shiftDuration ? (completedShift.totalOrders / parseFloat(shiftDuration)).toFixed(1) : '0'}</p>
          </div>
        </div>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          <p>Highway Cafe POS System</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Award className="h-12 w-12 text-yellow-500" />
            </div>
            <CardTitle className="text-2xl">Shift Complete!</CardTitle>
            <CardDescription>
              Great work, {currentUser.firstName}! Here's your shift summary for {new Date(completedShift.startTime).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Shift Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Shift Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Start Time</p>
                <p className="font-medium">{new Date(completedShift.startTime).toLocaleTimeString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">End Time</p>
                <p className="font-medium">{completedShift.endTime && new Date(completedShift.endTime).toLocaleTimeString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium">{shiftDuration}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold" data-testid="text-shift-sales">
                    {currentRate && (currentRate as any).rate ?
                      formatDualCurrency(totalSales, parseFloat((currentRate as any).rate)) :
                      formatCurrency(totalSales)
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Orders Processed</p>
                  <p className="text-2xl font-bold" data-testid="text-shift-orders">
                    {completedShift.totalOrders}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Avg Order Value</p>
                  <p className="text-2xl font-bold" data-testid="text-avg-order">
                    {formatCurrency(avgOrderValue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Clock className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Orders/Hour</p>
                  <p className="text-2xl font-bold" data-testid="text-orders-hour">
                    {shiftDuration ? (completedShift.totalOrders / parseFloat(shiftDuration.split('h')[0])).toFixed(1) : '0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Cash Payments</span>
                  <Badge variant="secondary">
                    {formatCurrency(cashCollected)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Card Payments</span>
                  <Badge variant="secondary">
                    {formatCurrency(cardCollected)}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-medium">
                  <span>Total</span>
                  <Badge>
                    {formatCurrency(totalSales)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Cash Percentage</span>
                  <Badge variant="outline">
                    {totalSales > 0 ? ((cashCollected / totalSales) * 100).toFixed(1) : 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Card Percentage</span>
                  <Badge variant="outline">
                    {totalSales > 0 ? ((cardCollected / totalSales) * 100).toFixed(1) : 0}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Strong Performance</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  {completedShift.totalOrders > 10 && (
                    <li>• Processed {completedShift.totalOrders} orders efficiently</li>
                  )}
                  {totalSales > 50 && (
                    <li>• Generated {formatCurrency(totalSales)} in sales</li>
                  )}
                  {avgOrderValue > 10 && (
                    <li>• Maintained good average order value</li>
                  )}
                </ul>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Shift Highlights</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Worked {shiftDuration} total</li>
                  <li>• {((cashCollected / totalSales) * 100).toFixed(0)}% cash transactions</li>
                  <li>• {((cardCollected / totalSales) * 100).toFixed(0)}% card transactions</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={printShiftSummary}
                variant="outline"
                className="gap-2"
                data-testid="button-print-summary"
              >
                <Printer className="h-4 w-4" />
                Print Summary
              </Button>
              <Button
                onClick={async () => {
                  // Clear any local storage/session data
                  localStorage.clear();
                  sessionStorage.clear();
                  // Proper logout
                  try {
                    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                    window.location.href = '/';
                  } catch (error) {
                    window.location.href = '/';
                  }
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                size="lg"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}