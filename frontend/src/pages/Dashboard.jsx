import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Package, AlertTriangle, Truck, TrendingUp } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, inventoryRes] = await Promise.all([
        axios.get(`${API}/stats`),
        axios.get(`${API}/inventory`)
      ]);

      setStats(statsRes.data);
      setInventory(inventoryRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981'];

  const categoryData = inventory.reduce((acc, item) => {
    const existing = acc.find(x => x.name === item.category);
    if (existing) {
      existing.value += item.quantity;
    } else {
      acc.push({ name: item.category, value: item.quantity });
    }
    return acc;
  }, []);

  const stockData = inventory.slice(0, 6).map(item => ({
    name: item.name,
    quantity: item.quantity,
    threshold: item.reorder_threshold
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in" data-testid="dashboard-container">
      <div>
        <h1 className="text-4xl font-bold text-gray-800" data-testid="dashboard-title">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {user?.full_name}</p>
      </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white card-hover" data-testid="total-items-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Total Items</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.total_items || 0}</h3>
              </div>
              <div className="p-3 bg-white/20 rounded-lg">
                <Package className="w-8 h-8" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-500 to-red-600 text-white card-hover" data-testid="low-stock-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Low Stock Items</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.low_stock_items || 0}</h3>
              </div>
              <div className="p-3 bg-white/20 rounded-lg">
                <AlertTriangle className="w-8 h-8" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white card-hover" data-testid="deliveries-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Active Deliveries</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.pending_deliveries || 0}</h3>
              </div>
              <div className="p-3 bg-white/20 rounded-lg">
                <Truck className="w-8 h-8" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-500 to-teal-600 text-white card-hover" data-testid="transactions-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Blockchain Transactions</p>
                <h3 className="text-3xl font-bold mt-2">{stats?.total_transactions || 0}</h3>
              </div>
              <div className="p-3 bg-white/20 rounded-lg">
                <TrendingUp className="w-8 h-8" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6" data-testid="stock-levels-chart">
            <h3 className="text-xl font-semibold mb-4">Stock Levels by Item</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stockData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="quantity" fill="#8b5cf6" name="Current Stock" />
                <Bar dataKey="threshold" fill="#ef4444" name="Reorder Threshold" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6" data-testid="category-distribution-chart">
            <h3 className="text-xl font-semibold mb-4">Inventory by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Recent Inventory */}
        <Card className="p-6" data-testid="recent-inventory-table">
          <h3 className="text-xl font-semibold mb-4">Recent Inventory Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">SKU</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Quantity</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Price</th>
                </tr>
              </thead>
              <tbody>
                {inventory.slice(0, 5).map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{item.sku}</td>
                    <td className="py-3 px-4 text-sm font-medium">{item.name}</td>
                    <td className="py-3 px-4 text-sm">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-right">
                      <span className={item.quantity <= item.reorder_threshold ? 'text-red-600 font-semibold' : ''}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-right">${item.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
  );
}