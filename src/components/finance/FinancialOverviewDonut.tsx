import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface FinancialOverviewDonutProps {
  stats: {
    totalRevenue: number;
    paymentIn: number;
    pendingAmount: number;
    totalExpenses: number;
    netProfit: number;
    // Additional stats that may exist
    totalClosedAmount?: number;
    totalAdvanceAmounts?: number;
  };
}

const FinancialOverviewDonut = ({ stats }: FinancialOverviewDonutProps) => {
  // Calculate total financial flow for proper percentage calculation
  const totalFinancialValue = stats.paymentIn + stats.pendingAmount + stats.totalExpenses;
  
  // Prepare comprehensive financial data showing ALL real categories
  const chartData = [
    {
      name: 'Collected',
      value: stats.paymentIn,
      color: 'hsl(var(--success))',
      percentage: totalFinancialValue > 0 ? ((stats.paymentIn / totalFinancialValue) * 100).toFixed(1) : '0.0'
    },
    {
      name: 'Pending',
      value: stats.pendingAmount,
      color: 'hsl(var(--warning))',
      percentage: totalFinancialValue > 0 ? ((stats.pendingAmount / totalFinancialValue) * 100).toFixed(1) : '0.0'
    },
    {
      name: 'Expenses',
      value: stats.totalExpenses,
      color: 'hsl(var(--destructive))',
      percentage: totalFinancialValue > 0 ? ((stats.totalExpenses / totalFinancialValue) * 100).toFixed(1) : '0.0'
    },
    {
      name: 'Net Profit',
      value: Math.max(0, stats.netProfit),
      color: 'hsl(var(--primary))',
      percentage: totalFinancialValue > 0 ? ((Math.max(0, stats.netProfit) / totalFinancialValue) * 100).toFixed(1) : '0.0'
    }
  ].filter(item => item.value > 0); // Only show categories with positive values

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-card-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Amount: ₹{data.value?.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.payload.percentage}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = () => {
    return (
      <text 
        x="50%" 
        y="50%" 
        textAnchor="middle" 
        dominantBaseline="middle" 
        className="fill-foreground text-sm font-medium"
      >
        <tspan x="50%" dy="-0.5em" className="text-xs text-muted-foreground">Total</tspan>
        <tspan x="50%" dy="1.2em" className="text-lg font-bold">₹{totalFinancialValue.toLocaleString()}</tspan>
      </text>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent"></div>
          Financial Overview
        </CardTitle>
        <CardDescription>
          Complete breakdown of your financial position
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 md:p-6">
        <div className="h-80 md:h-96 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={140}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={2}
                stroke="white"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {renderCustomizedLabel()}
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          {chartData.map((entry, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <div 
                  className="h-3 w-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-sm font-medium text-card-foreground">
                  {entry.name}
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-card-foreground">
                  ₹{entry.value.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {entry.percentage}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default FinancialOverviewDonut;