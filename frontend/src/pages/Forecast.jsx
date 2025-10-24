import { useState } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { TrendingUp, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Forecast({ user, onLogout }) {
  const [sku, setSku] = useState('');
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleForecast = async (e) => {
    e.preventDefault();
    if (!sku.trim()) {
      toast.error('Please enter a SKU');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/forecast/${sku}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setForecastData(response.data);
      toast.success('Forecast generated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate forecast');
      setForecastData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6 fade-in" data-testid="forecast-container">
        <div>
          <h1 className="text-4xl font-bold text-gray-800" data-testid="forecast-title">AI Demand Forecasting</h1>
          <p className="text-gray-600 mt-1">Prophet-powered predictions for inventory planning</p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleForecast} className="space-y-4">
            <div>
              <Label htmlFor="sku">Enter SKU to Forecast</Label>
              <div className="flex gap-4 mt-2">
                <Input
                  id="sku"
                  data-testid="sku-input"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g., SHIRT-001"
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  data-testid="generate-forecast-button"
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  {loading ? 'Generating...' : 'Generate Forecast'}
                </Button>
              </div>
            </div>
          </form>
        </Card>

        {forecastData && (
          <div className="space-y-6">
            <Card className="p-6" data-testid="forecast-chart-card">
              <h3 className="text-xl font-semibold mb-4">7-Day Demand Forecast for {sku}</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '12px'
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="predicted_demand"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#colorDemand)"
                    name="Predicted Demand"
                  />
                  <Line
                    type="monotone"
                    dataKey="upper_bound"
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    name="Upper Bound (95% CI)"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="lower_bound"
                    stroke="#10b981"
                    strokeDasharray="5 5"
                    name="Lower Bound (95% CI)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6" data-testid="forecast-table-card">
              <h3 className="text-xl font-semibold mb-4">Detailed Forecast Data</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Date
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Predicted Demand</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Lower Bound</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Upper Bound</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Confidence Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecastData.map((row, idx) => {
                      const range = row.upper_bound - row.lower_bound;
                      return (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm font-medium">{row.date}</td>
                          <td className="py-3 px-4 text-sm text-right">
                            <span className="font-semibold text-purple-600">
                              {row.predicted_demand.toFixed(0)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-right text-green-600">
                            {row.lower_bound.toFixed(0)}
                          </td>
                          <td className="py-3 px-4 text-sm text-right text-red-600">
                            {row.upper_bound.toFixed(0)}
                          </td>
                          <td className="py-3 px-4 text-sm text-right">
                            <span className="text-gray-600">± {(range / 2).toFixed(0)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900 mb-2">About This Forecast</h3>
              <p className="text-purple-800 text-sm leading-relaxed">
                This forecast uses Facebook Prophet, a time-series forecasting model that accounts for daily and weekly seasonality.
                The 95% confidence interval shows the range where actual demand is expected to fall. Use this data to optimize
                inventory levels and prevent stockouts.
              </p>
            </Card>
          </div>
        )}

        {!forecastData && !loading && (
          <Card className="p-12 text-center">
            <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Forecast Yet</h3>
            <p className="text-gray-600">Enter a SKU above to generate an AI-powered demand forecast</p>
          </Card>
        )}
      </div>
    </Layout>
  );
}