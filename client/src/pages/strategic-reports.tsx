
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { AlertCircle, TrendingUp, Grid, BarChart3, LayoutGrid } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function StrategicReports() {
    const [dateRange, setDateRange] = useState("30"); // days

    return (
        <div className="space-y-6 container mx-auto p-6 max-w-7xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Strategic Command Center</h2>
                    <p className="text-muted-foreground mt-1">High-level business intelligence for owners and managers.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 Days</SelectItem>
                            <SelectItem value="30">Last 30 Days</SelectItem>
                            <SelectItem value="90">Last 90 Days</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Tabs defaultValue="heatmap" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 max-w-xl">
                    <TabsTrigger value="heatmap" className="gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        Staffing Heatmap
                    </TabsTrigger>
                    <TabsTrigger value="pnl" className="gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Profit & Loss
                    </TabsTrigger>
                    <TabsTrigger value="matrix" className="gap-2">
                        <Grid className="h-4 w-4" />
                        Menu Matrix
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="heatmap">
                    <StaffingHeatmap />
                </TabsContent>

                <TabsContent value="pnl">
                    <ProfitLossChart days={Number(dateRange)} />
                </TabsContent>

                <TabsContent value="matrix">
                    <MenuMatrixChart days={Number(dateRange)} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function StaffingHeatmap() {
    const { data: heatmapData = [], isLoading } = useQuery<any[]>({
        queryKey: ['/api/reports/strategic/heatmap'],
    });

    if (isLoading) return <div className="h-96 flex items-center justify-center">Loading heat map...</div>;

    // Process data into a grid: 7 rows (days) x 24 cols (hours)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const getIntensity = (day: number, hour: number) => {
        const point = heatmapData?.find((d: any) => d.dayOfWeek === day && d.hourOfDay === hour);
        return point?.orderCount || 0;
    };

    const maxCount = heatmapData?.reduce((max: number, curr: any) => Math.max(max, curr.orderCount), 0) || 1;

    const getColor = (count: number) => {
        if (count === 0) return 'bg-gray-100';
        const intensity = count / maxCount;
        if (intensity < 0.25) return 'bg-blue-100';
        if (intensity < 0.5) return 'bg-blue-300';
        if (intensity < 0.75) return 'bg-blue-500 text-white';
        return 'bg-blue-700 text-white font-bold';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Operating Hours Intensity</CardTitle>
                <CardDescription>
                    Identify peak order times to optimize staff scheduling. Darker blue indicates higher order volume.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                        <div className="grid grid-cols-[50px_repeat(24,1fr)] gap-1">
                            <div className="col-start-1"></div>
                            {hours.map(h => (
                                <div key={h} className="text-xs text-center text-muted-foreground">
                                    {h}
                                </div>
                            ))}

                            {days.map((dayName, dayIndex) => (
                                <>
                                    <div key={dayName} className="text-sm font-medium flex items-center justify-end pr-2">
                                        {dayName}
                                    </div>
                                    {hours.map(hour => {
                                        const count = getIntensity(dayIndex, hour);
                                        return (
                                            <div
                                                key={`${dayIndex}-${hour}`}
                                                className={`h-8 rounded-sm flex items-center justify-center text-[10px] transition-colors ${getColor(count)}`}
                                                title={`Orders: ${count}`}
                                            >
                                                {count > 0 ? count : ''}
                                            </div>
                                        );
                                    })}
                                </>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ProfitLossChart({ days }: { days: number }) {
    const startDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        date.setHours(0, 0, 0, 0); // Normalize time
        return date;
    }, [days]);

    const { data: pnlData, isLoading, error } = useQuery({
        queryKey: ['/api/reports/strategic/pnl', startDate.toISOString()],
        queryFn: async () => {
            const res = await fetch(`/api/reports/strategic/pnl?startDate=${startDate.toISOString()}`);
            if (!res.ok) {
                throw new Error('Network response was not ok');
            }
            return res.json();
        }
    });

    if (isLoading) return <div className="h-96 flex items-center justify-center">Calculating financials...</div>;
    if (error) return <div className="h-96 flex items-center justify-center text-red-500">Error loading data.</div>;

    return (
        <div className="space-y-6">
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Estimated Profitability</AlertTitle>
                <AlertDescription>
                    Based on <strong>current</strong> ingredient costs. Past sales are calculated using today's cost prices.
                </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(pnlData?.reduce((sum: number, d: any) => sum + d.revenue, 0) || 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground">Est. Cost of Goods</div>
                        <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(pnlData?.reduce((sum: number, d: any) => sum + d.cost, 0) || 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-sm font-medium text-muted-foreground">Net Profit</div>
                        <div className="text-2xl font-bold text-blue-600">
                            {formatCurrency(pnlData?.reduce((sum: number, d: any) => sum + d.profit, 0) || 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Revenue vs Cost Trend</CardTitle>
                    <CardDescription>Daily breakdown of financial performance.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={pnlData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ff8042" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#ff8042" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                                <Area type="monotone" dataKey="revenue" stroke="#82ca9d" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                                <Area type="monotone" dataKey="cost" stroke="#ff8042" fillOpacity={1} fill="url(#colorCost)" name="Cost (Est)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function MenuMatrixChart({ days }: { days: number }) {
    const startDate = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        date.setHours(0, 0, 0, 0);
        return date;
    }, [days]);

    const { data: matrixData, isLoading } = useQuery({
        queryKey: ['/api/reports/strategic/menu-matrix', startDate.toISOString()],
        queryFn: async () => {
            const res = await fetch(`/api/reports/strategic/menu-matrix?startDate=${startDate.toISOString()}`);
            return res.json();
        }
    });

    if (isLoading) return <div className="h-96 flex items-center justify-center">Analyzing menu performance...</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Helper Cards explaining quadrants could go here */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <h4 className="font-bold text-green-700">Stars (High Profit, High Vol)</h4>
                    <p className="text-xs text-green-600">Keep these visible! Do not change.</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                    <h4 className="font-bold text-yellow-700">Plowhorses (Low Profit, High Vol)</h4>
                    <p className="text-xs text-yellow-600">Increase price or lower cost.</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h4 className="font-bold text-blue-700">Puzzles (High Profit, Low Vol)</h4>
                    <p className="text-xs text-blue-600">Promote these more!</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                    <h4 className="font-bold text-red-700">Dogs (Low Profit, Low Vol)</h4>
                    <p className="text-xs text-red-600">Consider removing from menu.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Menu Engineering Matrix</CardTitle>
                    <CardDescription>
                        Visualizing Sales Volume (Popularity) vs Profit Margin (Profitability).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[500px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    type="number"
                                    dataKey="salesVolume"
                                    name="Sales Volume"
                                    unit=" units"
                                    label={{ value: 'Sales Volume (Qty)', position: 'insideBottom', offset: -10 }}
                                />
                                <YAxis
                                    type="number"
                                    dataKey="margin"
                                    name="Margin"
                                    unit="%"
                                    label={{ value: 'Profit Margin (%)', angle: -90, position: 'insideLeft' }}
                                />
                                <ZAxis type="number" dataKey="profit" range={[60, 400]} name="Total Profit" unit="$" />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                                <Scatter name="Products" data={matrixData} fill="#8884d8" shape="circle" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-4 border rounded shadow-lg">
                <p className="font-bold">{data.name}</p>
                <div className="text-sm space-y-1">
                    <p>Volume: {data.salesVolume}</p>
                    <p>Margin: {data.margin.toFixed(1)}%</p>
                    <p>Total Profit: {formatCurrency(data.profit)}</p>
                </div>
            </div>
        );
    }
    return null;
};
