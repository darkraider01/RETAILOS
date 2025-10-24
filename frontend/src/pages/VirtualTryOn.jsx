import { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function VirtualTryOn({ user, onLogout }) {
  const [showWebcam, setShowWebcam] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('tshirt');
  const webcamRef = useRef(null);

  const products = [
    {
      id: 'tshirt',
      name: 'Classic T-Shirt',
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80',
      category: 'Apparel'
    },
    {
      id: 'shirt',
      name: 'Button-Up Shirt',
      image: 'https://images.unsplash.com/photo-1602810318660-d2c46b552f88?w=400&q=80',
      category: 'Apparel'
    },
    {
      id: 'jacket',
      name: 'Denim Jacket',
      image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80',
      category: 'Apparel'
    }
  ];

  const selectedProductData = products.find(p => p.id === selectedProduct);

  const handleStartWebcam = () => {
    setShowWebcam(true);
    toast.success('Webcam started');
  };

  const handleStopWebcam = () => {
    setShowWebcam(false);
    toast.info('Webcam stopped');
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6 fade-in" data-testid="try-on-container">
        <div>
          <h1 className="text-4xl font-bold text-gray-800" data-testid="try-on-title">Virtual Try-On</h1>
          <p className="text-gray-600 mt-1">See how products look on you using your webcam</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Selection */}
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Select Product</h3>
              <div className="space-y-3">
                {products.map((product) => (
                  <button
                    key={product.id}
                    data-testid={`product-${product.id}`}
                    onClick={() => setSelectedProduct(product.id)}
                    className={`w-full p-4 rounded-lg border-2 transition-all ${
                      selectedProduct === product.id
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="text-left">
                        <h4 className="font-semibold">{product.name}</h4>
                        <p className="text-sm text-gray-600">{product.category}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Controls</h3>
              <div className="space-y-3">
                {!showWebcam ? (
                  <Button
                    onClick={handleStartWebcam}
                    data-testid="start-webcam-button"
                    className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Start Webcam
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopWebcam}
                    data-testid="stop-webcam-button"
                    variant="destructive"
                    className="w-full"
                  >
                    <CameraOff className="w-4 h-4 mr-2" />
                    Stop Webcam
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Try-On View */}
          <div className="lg:col-span-2">
            <Card className="p-6 h-full">
              <h3 className="text-xl font-semibold mb-4">Try-On Preview</h3>
              
              <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden" data-testid="try-on-preview">
                {showWebcam ? (
                  <>
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      screenshotFormat="image/jpeg"
                      className="w-full h-full object-cover"
                      mirrored
                    />
                    
                    {/* Product Overlay - Simple 2D overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative" style={{
                        width: '40%',
                        top: '10%'
                      }}>
                        <img
                          src={selectedProductData?.image}
                          alt="Product overlay"
                          className="opacity-60 mix-blend-overlay"
                          style={{
                            filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))'
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Info overlay */}
                    <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-lg">
                      <p className="text-sm font-semibold">{selectedProductData?.name}</p>
                      <p className="text-xs text-gray-300">Adjust position for best fit</p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-white">
                    <Camera className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-semibold mb-2">Webcam Not Active</p>
                    <p className="text-sm text-gray-400">Click "Start Webcam" to begin</p>
                  </div>
                )}
              </div>
              
              <div className="mt-6 space-y-3">
                <Card className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
                  <h4 className="font-semibold text-purple-900 mb-2">About Virtual Try-On</h4>
                  <p className="text-sm text-purple-800 leading-relaxed">
                    This is a basic 2D overlay implementation. The selected product image is overlaid on your webcam feed
                    to give you a preview of how it might look. For production use, this can be enhanced with AI-powered
                    body detection and 3D mesh fitting using technologies like MediaPipe or Three.js.
                  </p>
                </Card>
                
                <div className="grid grid-cols-3 gap-3">
                  {products.map((product) => (
                    <button
                      key={`thumb-${product.id}`}
                      onClick={() => setSelectedProduct(product.id)}
                      className={`p-2 rounded-lg border-2 transition-all ${
                        selectedProduct === product.id
                          ? 'border-purple-600'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full aspect-square object-cover rounded"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}