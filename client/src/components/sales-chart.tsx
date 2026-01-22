import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface SalesData {
  date: string;
  sales: number;
  orders: number;
}

export function SalesChart() {
  const { toast } = useToast();

  const { data: salesData = [], isLoading } = useQuery<SalesData[]>({
    queryKey: ['/api/analytics/sales', { days: 7 }],
  });

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (salesData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <BarChart className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No sales data available</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formattedData = salesData.map(item => ({
    ...item,
    date: formatDate(item.date),
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            fontSize={12}
            tick={{ fill: '#6B7280' }}
          />
          <YAxis 
            fontSize={12}
            tick={{ fill: '#6B7280' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value: number, name: string) => [
              name === 'sales' ? `$${value.toFixed(2)}` : value,
              name === 'sales' ? 'Sales' : 'Orders'
            ]}
          />
          <Bar 
            dataKey="sales" 
            fill="hsl(207, 90%, 54%)" 
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
