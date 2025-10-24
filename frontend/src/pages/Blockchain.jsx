import { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Link2, Package, ShoppingCart, RotateCcw, Shield } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Blockchain({ user, onLogout }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockchain();
  }, []);

  const fetchBlockchain = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/blockchain`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(response.data);
    } catch (error) {
      toast.error('Failed to fetch blockchain data');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'register': return <Package className="w-5 h-5" />;
      case 'purchase': return <ShoppingCart className="w-5 h-5" />;
      case 'restock': return <RotateCcw className="w-5 h-5" />;
      default: return <Link2 className="w-5 h-5" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'register': return 'bg-blue-100 text-blue-700';
      case 'purchase': return 'bg-red-100 text-red-700';
      case 'restock': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={onLogout}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-lg">Loading blockchain...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6 fade-in" data-testid="blockchain-container">
        <div>
          <h1 className="text-4xl font-bold text-gray-800" data-testid="blockchain-title">Blockchain Ledger</h1>
          <p className="text-gray-600 mt-1">Immutable transaction history for inventory</p>
        </div>

        <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Shield className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-indigo-900 mb-2">About Blockchain Ledger</h3>
              <p className="text-indigo-800 text-sm leading-relaxed">
                This simulated blockchain provides an immutable record of all inventory transactions.
                Each transaction is cryptographically linked to the previous one, ensuring data integrity and transparency.
                In production, this could be deployed on Ethereum, Polygon, or other blockchain networks.
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {transactions.map((tx, index) => (
            <Card key={tx.id} className="p-6 card-hover" data-testid={`transaction-${tx.id}`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${getTransactionColor(tx.transaction_type)}`}>
                  {getTransactionIcon(tx.transaction_type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800 capitalize">
                        {tx.transaction_type} Transaction
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(tx.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTransactionColor(tx.transaction_type)}`}>
                      Block #{transactions.length - index}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">SKU</p>
                      <p className="font-semibold">{tx.sku}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Quantity</p>
                      <p className="font-semibold">{tx.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Transaction ID</p>
                      <p className="font-mono text-xs">{tx.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Hash:</span>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono" data-testid={`hash-${tx.id}`}>
                        {tx.hash.slice(0, 16)}...{tx.hash.slice(-16)}
                      </code>
                    </div>
                    
                    {index < transactions.length - 1 && (
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Previous Hash:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {tx.previous_hash.slice(0, 16)}...{tx.previous_hash.slice(-16)}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {transactions.length === 0 && (
          <Card className="p-12 text-center">
            <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No transactions yet</h3>
            <p className="text-gray-600">Blockchain will populate as inventory transactions occur</p>
          </Card>
        )}

        <Card className="p-6 bg-gray-50">
          <h3 className="text-lg font-semibold mb-3">Blockchain Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Blocks</p>
              <p className="text-2xl font-bold text-gray-800">{transactions.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Registrations</p>
              <p className="text-2xl font-bold text-blue-600">
                {transactions.filter(t => t.transaction_type === 'register').length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Purchases</p>
              <p className="text-2xl font-bold text-red-600">
                {transactions.filter(t => t.transaction_type === 'purchase').length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Restocks</p>
              <p className="text-2xl font-bold text-green-600">
                {transactions.filter(t => t.transaction_type === 'restock').length}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}