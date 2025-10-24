import { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Package, Edit, ShoppingCart, RotateCcw } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Inventory({ user, onLogout }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    quantity: 0,
    reorder_threshold: 0,
    price: 0,
    category: ''
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInventory(response.data);
    } catch (error) {
      toast.error('Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/inventory`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Item added successfully');
      setShowAddDialog(false);
      setFormData({
        sku: '',
        name: '',
        description: '',
        quantity: 0,
        reorder_threshold: 0,
        price: 0,
        category: ''
      });
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add item');
    }
  };

  const handleUpdateQuantity = async (sku, quantity, action) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/inventory/${sku}`,
        { quantity, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Inventory ${action === 'purchase' ? 'decreased' : 'restocked'}`);
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update inventory');
    }
  };

  const canManageInventory = ['manager', 'supplier'].includes(user.role);

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-lg">Loading inventory...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6 fade-in" data-testid="inventory-container">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-800" data-testid="inventory-title">Inventory Management</h1>
            <p className="text-gray-600 mt-1">Manage your product stock</p>
          </div>
          
          {canManageInventory && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button data-testid="add-item-button" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Item</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddItem} className="space-y-4">
                  <div>
                    <Label>SKU</Label>
                    <Input
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      required
                      data-testid="sku-input"
                    />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="name-input"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      data-testid="description-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                        required
                        data-testid="quantity-input"
                      />
                    </div>
                    <div>
                      <Label>Reorder Threshold</Label>
                      <Input
                        type="number"
                        value={formData.reorder_threshold}
                        onChange={(e) => setFormData({ ...formData, reorder_threshold: parseInt(e.target.value) })}
                        required
                        data-testid="threshold-input"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                        required
                        data-testid="price-input"
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Input
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                        data-testid="category-input"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" data-testid="submit-item-button">
                    Add Item
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {inventory.map((item) => (
            <Card key={item.id} className="p-6 card-hover" data-testid={`item-card-${item.sku}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Package className="w-6 h-6 text-purple-600" />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  item.quantity <= item.reorder_threshold 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {item.quantity <= item.reorder_threshold ? 'Low Stock' : 'In Stock'}
                </span>
              </div>
              
              <h3 className="text-xl font-bold text-gray-800 mb-2">{item.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{item.description}</p>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">SKU:</span>
                  <span className="font-semibold">{item.sku}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-semibold" data-testid={`quantity-${item.sku}`}>{item.quantity}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Category:</span>
                  <span className="font-semibold">{item.category}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-semibold text-purple-600">${item.price.toFixed(2)}</span>
                </div>
              </div>
              
              {canManageInventory && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`purchase-button-${item.sku}`}
                    onClick={() => handleUpdateQuantity(item.sku, 5, 'purchase')}
                    className="flex-1"
                  >
                    <ShoppingCart className="w-4 h-4 mr-1" />
                    Sell 5
                  </Button>
                  <Button
                    size="sm"
                    data-testid={`restock-button-${item.sku}`}
                    onClick={() => handleUpdateQuantity(item.sku, 10, 'restock')}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Restock 10
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>

        {inventory.length === 0 && (
          <Card className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No inventory items</h3>
            <p className="text-gray-600">Add your first item to get started</p>
          </Card>
        )}
      </div>
    </Layout>
  );
}