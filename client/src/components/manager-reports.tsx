import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Calendar, Clock, DollarSign, TrendingUp, Users, Download, Filter, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { User } from "@shared/schema";
import { ShiftReportDialog } from "./shift-report-dialog";
import { CustomReportDialog } from "./custom-report-dialog";
import { FileText, Calculator } from "lucide-react";

interface ManagerReportsProps {
  currentUser: User;
}

export function ManagerReports({ currentUser }: ManagerReportsProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [shiftSearchTerm, setShiftSearchTerm] = useState("");
  const [performanceSearchTerm, setPerformanceSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [viewShiftId, setViewShiftId] = useState<string | null>(null);
  const [customReportRange, setCustomReportRange] = useState<{ start: string; end: string } | null>(null);
  // Helper to get local ISO string for datetime-local inputs
  const getLocalISOString = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
  };

  const [isLiveOnline, setIsLiveOnline] = useState(false);

  const [customStart, setCustomStart] = useState<string>(
    getLocalISOString(new Date(new Date().setHours(0, 0, 0, 0)))
  );
  const [customEnd, setCustomEnd] = useState<string>(
    getLocalISOString(new Date(new Date().setHours(23, 59, 59, 999)))
  );

  // Real-time Dashboard: WebSocket Listener (Phase 9)
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => setIsLiveOnline(true);
    socket.onclose = () => setIsLiveOnline(false);

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'order_update') {
          // Invalidate overview stats to trigger a soft refresh (Live Ticker)
          // We only invalidate if the date range covers "today", but simpler to just invalidate always for now
          // as React Query matches keys.
          queryClient.invalidateQueries({ queryKey: ["/api/reports/custom", "overview"] });
          queryClient.invalidateQueries({ queryKey: ["/api/reports/performance"] });
        }
      } catch (e) {
        console.error("WS Parse Error", e);
      }
    };

    return () => socket.close();
  }, [queryClient]);

  // Get all users for filtering (only for admin/manager roles)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: ['admin', 'manager'].includes(currentUser.role),
    retry: false,
    meta: {
      onError: () => {
        // Silently handle permission errors for managers
        return [];
      }
    }
  });

  // Get shift reports
  const { data: shiftReports = [], isLoading: isLoadingShifts } = useQuery({
    queryKey: ["/api/reports/shifts", selectedUserId, dateRange.start, dateRange.end, selectedRole],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedUserId !== "all") params.append("userId", selectedUserId);
      if (dateRange.start) params.append("startDate", dateRange.start);
      if (dateRange.end) params.append("endDate", dateRange.end);
      if (selectedRole !== "all") params.append("role", selectedRole);

      const response = await fetch(`/api/reports/shifts?${params}`);
      if (!response.ok) throw new Error("Failed to fetch shift reports");
      return response.json();
    },
  });

  // Get performance reports
  const { data: performanceReports = [], isLoading: isLoadingPerformance } = useQuery({
    queryKey: ["/api/reports/performance", selectedDate, selectedRole],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDate) params.append("date", selectedDate);
      if (selectedRole !== "all") params.append("role", selectedRole);

      const response = await fetch(`/api/reports/performance?${params}`);
      if (!response.ok) throw new Error("Failed to fetch performance reports");
      return response.json();
    },
  });

  // Get overview stats (independent of shifts)
  const { data: overviewStats = { summary: { totalSales: 0, totalOrders: 0, expectedCash: 0, cashCollected: 0, cardCollected: 0 } } } = useQuery({
    queryKey: ["/api/reports/custom", "overview", dateRange.start, dateRange.end],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Ensure we cover the full day for the end date
      const start = new Date(dateRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);

      params.append("start", start.toISOString());
      params.append("end", end.toISOString());

      const response = await fetch(`/api/reports/custom?${params}`);
      if (!response.ok) throw new Error("Failed to fetch overview stats");
      return response.json();
    },
  });

  const handleExportData = (data: any[], filename: string) => {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const convertToCSV = (data: any[]): string => {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row =>
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      }).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
  };

  // Calculate summary statistics
  const shiftSummary = shiftReports.reduce((acc: any, report: any) => {
    const shift = report.shift;
    const shiftHours = shift.endTime ?
      (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60) : 0;

    return {
      totalShifts: acc.totalShifts + 1,
      totalSales: acc.totalSales + (Number(shift.totalSales) || 0),
      totalOrders: acc.totalOrders + (Number(shift.totalOrders) || 0),
      totalHours: acc.totalHours + (Number(shiftHours) || 0),
      expectedCash: acc.expectedCash + (Number(shift.expectedCash) || 0),
    };
  }, { totalShifts: 0, totalSales: 0, totalOrders: 0, totalHours: 0, expectedCash: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Manager Reports</h2>
          <p className="text-muted-foreground">
            Track performance, shifts, and analytics across your team
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <BarChart className="h-4 w-4" />
          Analytics Dashboard
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="shifts" data-testid="tab-shifts">Shifts</TabsTrigger>
          <TabsTrigger value="custom" data-testid="tab-custom">Custom Report</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Total Shifts</p>
                    <p className="text-2xl font-bold" data-testid="text-total-shifts">
                      {shiftSummary.totalShifts}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Total Sales</p>
                      {isLiveOnline && (
                        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live Updates Active"></span>
                      )}
                    </div>
                    <p className="text-2xl font-bold" data-testid="text-total-sales">
                      {formatCurrency(overviewStats.summary.totalSales)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Expected Cash</p>
                    <p className="text-2xl font-bold" data-testid="text-expected-cash">
                      {formatCurrency(overviewStats.summary.expectedCash)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium">Total Orders</p>
                    <p className="text-2xl font-bold" data-testid="text-total-orders">
                      {overviewStats.summary.totalOrders}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium">Total Hours</p>
                    <p className="text-2xl font-bold" data-testid="text-total-hours">
                      {shiftSummary.totalHours.toFixed(1)}h
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Date Range Filter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    data-testid="input-end-date"
                  />
                </div>
                <div>
                  <Label htmlFor="role-filter">Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="barista">Barista</SelectItem>
                      <SelectItem value="courier">Courier</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="user-filter">User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger data-testid="select-user">
                      <SelectValue placeholder="All Users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} ({user.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shifts Tab */}
        <TabsContent value="shifts" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Shift Reports</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={shiftSearchTerm}
                  onChange={(e) => setShiftSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                  data-testid="input-search-shifts"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportData(
                  shiftReports.filter((report: any) => {
                    const user = report.user;
                    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
                    return fullName.includes(shiftSearchTerm.toLowerCase()) ||
                      user.role.toLowerCase().includes(shiftSearchTerm.toLowerCase());
                  }),
                  'shift_reports'
                )}
                className="gap-2"
                data-testid="button-export-shifts"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingShifts ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Sales</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const filteredReports = shiftReports.filter((report: any) => {
                        const user = report.user;
                        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
                        return fullName.includes(shiftSearchTerm.toLowerCase()) ||
                          user.role.toLowerCase().includes(shiftSearchTerm.toLowerCase());
                      });

                      if (filteredReports.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              {shiftSearchTerm ? 'No shifts found matching your search.' : 'No shift data available.'}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return filteredReports.map((report: any) => {
                        const shift = report.shift;
                        const user = report.user;
                        const duration = shift.endTime
                          ? (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60)
                          : 0;

                        return (
                          <TableRow key={shift.id}>
                            <TableCell className="font-medium">{user.firstName} {user.lastName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.role}</Badge>
                            </TableCell>
                            <TableCell>{new Date(shift.startTime).toLocaleDateString()}</TableCell>
                            <TableCell>{new Date(shift.startTime).toLocaleTimeString()}</TableCell>
                            <TableCell>
                              {shift.endTime ? new Date(shift.endTime).toLocaleTimeString() : "Active"}
                            </TableCell>
                            <TableCell>
                              {duration > 0 ? `${duration.toFixed(1)}h` : "Active"}
                            </TableCell>
                            <TableCell>{formatCurrency(parseFloat(shift.totalSales || 0))}</TableCell>
                            <TableCell>{shift.totalOrders || 0}</TableCell>
                            <TableCell>
                              <Badge variant={shift.isActive ? "default" : "secondary"}>
                                {shift.isActive ? "Active" : "Completed"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewShiftId(shift.id)}
                                className="h-8 w-8 p-0"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <ShiftReportDialog
            shiftId={viewShiftId}
            open={!!viewShiftId}
            onOpenChange={(open) => !open && setViewShiftId(null)}
          />
        </TabsContent>

        {/* Custom Report Tab */}
        <TabsContent value="custom" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Custom Time-Range Report</h3>
              <p className="text-sm text-muted-foreground">
                Generate a performance audit for any specific date and time window.
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Report Parameters</CardTitle>
              <CardDescription>Select the start and end time for the report.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="custom-start">Start Time</Label>
                  <Input
                    id="custom-start"
                    type="datetime-local"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-end">End Time</Label>
                  <Input
                    id="custom-end"
                    type="datetime-local"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => setCustomReportRange({ start: new Date(customStart).toISOString(), end: new Date(customEnd).toISOString() })}
                  className="gap-2"
                >
                  <Calculator className="h-4 w-4" />
                  Generate Custom Report
                </Button>
              </div>
            </CardContent>
          </Card>

          <CustomReportDialog
            dateRange={customReportRange}
            open={!!customReportRange}
            onOpenChange={(open) => !open && setCustomReportRange(null)}
          />
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Performance Analytics</h3>
              <p className="text-sm text-muted-foreground">
                Daily performance metrics by employee
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={performanceSearchTerm}
                  onChange={(e) => setPerformanceSearchTerm(e.target.value)}
                  className="pl-8 w-48"
                  data-testid="input-search-performance"
                />
              </div>
              <Label htmlFor="performance-date">Date:</Label>
              <Input
                id="performance-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
                data-testid="input-performance-date"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportData(
                  performanceReports.filter((report: any) => {
                    const user = report.user;
                    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
                    return fullName.includes(performanceSearchTerm.toLowerCase()) ||
                      user.role.toLowerCase().includes(performanceSearchTerm.toLowerCase());
                  }),
                  'performance_reports'
                )}
                className="gap-2"
                data-testid="button-export-performance"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingPerformance ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Shifts</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Total Sales</TableHead>
                      <TableHead>Total Orders</TableHead>
                      <TableHead>Avg Sales/Shift</TableHead>
                      <TableHead>Avg Orders/Shift</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const filteredReports = performanceReports.filter((report: any) => {
                        const user = report.user;
                        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
                        return fullName.includes(performanceSearchTerm.toLowerCase()) ||
                          user.role.toLowerCase().includes(performanceSearchTerm.toLowerCase());
                      });

                      if (filteredReports.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              {performanceSearchTerm ? 'No employees found matching your search.' : 'No performance data available.'}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return filteredReports.map((report: any) => (
                        <TableRow key={report.user.id}>
                          <TableCell className="font-medium">{report.user.firstName} {report.user.lastName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{report.user.role}</Badge>
                          </TableCell>
                          <TableCell>{report.totalShifts || 0}</TableCell>
                          <TableCell>{(Number(report.totalHours) || 0).toFixed(1)}h</TableCell>
                          <TableCell>{formatCurrency(report.totalSales || 0)}</TableCell>
                          <TableCell>{report.totalOrders || 0}</TableCell>
                          <TableCell>{formatCurrency(report.avgSalesPerShift || 0)}</TableCell>
                          <TableCell>{(Number(report.avgOrdersPerShift) || 0).toFixed(1)}</TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Analytics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Staff</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Shifts</p>
                    <p className="text-2xl font-bold">{shiftSummary.totalShifts}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(shiftSummary.totalSales)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Avg Sales/Hour</p>
                    <p className="text-2xl font-bold">
                      {shiftSummary.totalHours > 0
                        ? formatCurrency(shiftSummary.totalSales / shiftSummary.totalHours)
                        : formatCurrency(0)
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Breakdown by Role */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Performance by Role
              </CardTitle>
              <CardDescription>
                Sales and productivity breakdown by employee role
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['cashier', 'barista', 'courier', 'manager'].map((role) => {
                  const roleReports = performanceReports.filter((report: any) => report.user.role === role);
                  const roleSales = roleReports.reduce((sum: number, report: any) => sum + (report.totalSales || 0), 0);
                  const roleShifts = roleReports.reduce((sum: number, report: any) => sum + (report.totalShifts || 0), 0);
                  const roleHours = roleReports.reduce((sum: number, report: any) => sum + (report.totalHours || 0), 0);

                  return (
                    <div key={role} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="capitalize">{role}</Badge>
                        <div className="text-sm text-muted-foreground">
                          {roleReports.length} employee{roleReports.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Sales: </span>
                          <span className="font-medium">{formatCurrency(roleSales)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Shifts: </span>
                          <span className="font-medium">{roleShifts}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Hours: </span>
                          <span className="font-medium">{(Number(roleHours) || 0).toFixed(1)}h</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top Performers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Performers
              </CardTitle>
              <CardDescription>
                Highest performing employees by total sales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performanceReports
                  .sort((a: any, b: any) => (b.totalSales || 0) - (a.totalSales || 0))
                  .slice(0, 5)
                  .map((report: any, index: number) => (
                    <div key={report.user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{report.user.firstName} {report.user.lastName}</p>
                          <p className="text-sm text-muted-foreground capitalize">{report.user.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(report.totalSales || 0)}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.totalShifts || 0} shifts • {(Number(report.totalHours) || 0).toFixed(1)}h
                        </p>
                      </div>
                    </div>
                  ))}
                {performanceReports.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No performance data available yet</p>
                    <p className="text-sm">Data will appear after employees complete shifts</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}