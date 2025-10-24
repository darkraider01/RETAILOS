import { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Truck, MapPin, Clock, Package, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Delivery({ user, onLogout }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    order_id: '',
    sku: '',
    route: '',
    estimated_delivery: ''
  });

  useEffect(() => {
    fetchDeliveries();
    
    // Setup WebSocket connection for real-time updates
    const wsUrl = BACKEND_URL.replace('https', 'wss').replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/delivery`);
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setDeliveries(prev => 
        prev.map(d => d.id === update.id ? { ...d, ...update } : d)
      );
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return () => {
      ws.close();
    };
  }, []);

  const fetchDeliveries = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/delivery`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeliveries(response.data);
    } catch (error) {
      toast.error('Failed to fetch deliveries');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDelivery = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/delivery`,
        {
          ...formData,
          estimated_delivery: new Date(formData.estimated_delivery).toISOString()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Delivery scheduled successfully');
      setShowAddDialog(false);
      setFormData({
        order_id: '',
        sku: '',
        route: '',
        estimated_delivery: ''
      });
      fetchDeliveries();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to schedule delivery');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'in_transit': return 'bg-blue-100 text-blue-700';
      case 'delivered': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5" />;
      case 'in_transit': return <Truck className="w-5 h-5" />;
      case 'delivered': return <Package className="w-5 h-5" />;
      default: return <MapPin className="w-5 h-5" />;
    }
  };

  const canManageDelivery = ['manager', 'supplier'].includes(user.role);

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-lg">Loading deliveries...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6 fade-in" data-testid="delivery-container">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-800" data-testid="delivery-title">Delivery Tracking</h1>
            <p className="text-gray-600 mt-1">Real-time delivery updates via WebSocket</p>
          </div>
          
          {canManageDelivery && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button data-testid="schedule-delivery-button" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Delivery
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Schedule New Delivery</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddDelivery} className="space-y-4">
                  <div>
                    <Label>Order ID</Label>
                    <Input
                      value={formData.order_id}
                      onChange={(e) => setFormData({ ...formData, order_id: e.target.value })}
                      required
                      data-testid="order-id-input"
                    />
                  </div>
                  <div>
                    <Label>SKU</Label>
                    <Input
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      required
                      data-testid="delivery-sku-input"
                    />
                  </div>
                  <div>
                    <Label>Route</Label>
                    <Input
                      value={formData.route}
                      onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                      placeholder="e.g., NYC to LA"
                      required
                      data-testid="route-input"
                    />
                  </div>
                  <div>
                    <Label>Estimated Delivery</Label>
                    <Input
                      type="datetime-local"
                      value={formData.estimated_delivery}
                      onChange={(e) => setFormData({ ...formData, estimated_delivery: e.target.value })}
                      required
                      data-testid="estimated-delivery-input"
                    />
                  </div>
                  <Button type="submit" className="w-full" data-testid="submit-delivery-button">
                    Schedule Delivery
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {deliveries.map((delivery) => (
            <Card key={delivery.id} className="p-6 card-hover" data-testid={`delivery-card-${delivery.order_id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${getStatusColor(delivery.status).replace('text-', 'bg-').replace('100', '200')}`}>
                    {getStatusIcon(delivery.status)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Order #{delivery.order_id}</h3>
                    <p className="text-sm text-gray-600">{delivery.sku}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(delivery.status)}`}>
                  {delivery.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Current Location:</span>
                  <span className="font-semibold" data-testid={`location-${delivery.order_id}`}>{delivery.current_location}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Route:</span>
                  <span className="font-semibold">{delivery.route}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Estimated Delivery:</span>
                  <span className="font-semibold">
                    {new Date(delivery.estimated_delivery).toLocaleDateString()} at{' '}
                    {new Date(delivery.estimated_delivery).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Last Updated:</span>
                  <span>{new Date(delivery.updated_at).toLocaleString()}</span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      delivery.status === 'delivered' ? 'bg-green-500 w-full' :
                      delivery.status === 'in_transit' ? 'bg-blue-500 w-2/3' :
                      'bg-yellow-500 w-1/3'
                    }`}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {deliveries.length === 0 && (
          <Card className="p-12 text-center">
            <Truck className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No deliveries scheduled</h3>
            <p className="text-gray-600">Schedule your first delivery to start tracking</p>
          </Card>
        )}

        <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Real-Time Updates</h3>
              <p className="text-blue-800 text-sm leading-relaxed">
                This page uses WebSocket technology to provide live delivery updates every 10 seconds.
                Watch as delivery statuses automatically update without refreshing the page.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}