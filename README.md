# AI-Powered Decentralized Retail Management System

A production-ready web application integrating blockchain-based inventory management, AI demand forecasting, real-time delivery tracking, and virtual try-on functionality.

## 🚀 Features

### 1. **Decentralized Inventory Management (Simulated Blockchain)**
- Immutable transaction ledger
- Cryptographically linked blocks
- Event logging for all inventory operations
- Support for item registration, purchases, and restocking
- Auto-trigger reorder threshold alerts

### 2. **AI Demand Forecasting**
- Prophet-based time series forecasting
- 7-day demand predictions per SKU
- 95% confidence intervals
- Weekly and daily seasonality detection
- Visual charts with uncertainty estimation

### 3. **Real-Time Delivery Tracking**
- WebSocket-powered live updates
- Automatic status progression simulation
- Visual progress indicators
- Route tracking and ETA display
- Updates every 10 seconds


### 5. **Virtual Try-On**
- Webcam integration
- Basic 2D product overlay
- Multiple product selection
- Real-time preview
- Expandable to 3D with MediaPipe/Three.js

### 6. **Interactive Dashboard**
- Real-time statistics
- Inventory charts (bar, pie, line)
- Low stock alerts
- Category distribution
- Recent transactions view

## 🛠️ Tech Stack

### Backend
- **FastAPI** - High-performance Python web framework
- **MongoDB** - NoSQL database with Motor async driver
- **Prophet** - Facebook's time series forecasting library
- **WebSockets** - Real-time bidirectional communication
- **Pydantic** - Data validation

### Frontend
- **React 19** - Modern UI framework
- **Tailwind CSS** - Utility-first styling
- **Shadcn/ui** - Beautiful component library
- **Recharts** - Data visualization
- **React Webcam** - Camera integration
- **Axios** - HTTP client
- **Sonner** - Toast notifications

### Infrastructure
- **Supervisor** - Process management

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)

### Local Development

#### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend Setup
```bash
cd frontend
yarn install
yarn start
```
> **Note:** After modifying `frontend/.env`, you might need to restart the frontend application for changes to take effect.

#### MongoDB
Ensure MongoDB is running locally on port 27017 or update `MONGO_URL` in `backend/.env`

## 🎯 Usage Guide

### 1. **Explore Dashboard**
- View inventory statistics
- Check low stock alerts
- Monitor active deliveries
- See blockchain transaction count

### 2. **Manage Inventory**
- Add new items with SKU, name, price, quantity
- Set reorder thresholds
- Perform purchase operations (decrease stock)
- Restock items (increase stock)
- All transactions recorded on blockchain

### 3. **Generate Demand Forecast**
- Enter any SKU
- Click "Generate Forecast"
- View 7-day predictions with confidence intervals
- Use data for inventory planning

### 4. **Track Deliveries**
- Schedule new deliveries
- Monitor real-time status updates
- View current location and route
- Check estimated delivery times
- Automatic WebSocket updates

### 5. **Try Virtual Try-On**
- Select a product from the list
- Click "Start Webcam"
- See product overlay on your video feed
- Switch between different products

### 6. **View Blockchain**
- See complete transaction history
- Verify cryptographic hashes
- Check block linkage
- View statistics by transaction type

## 🔐 Environment Variables

### Backend (`.env`)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=retail_management_db
CORS_ORIGINS=*
JWT_SECRET_KEY=your-secret-key-change-in-production
```

### Frontend (`.env`)
```
REACT_APP_BACKEND_URL=http://localhost:8000
```

## 📊 API Endpoints


### Inventory
- `GET /api/inventory` - List all items
- `POST /api/inventory` - Add new item
- `GET /api/inventory/{sku}` - Get item by SKU
- `PUT /api/inventory/{sku}` - Update quantity

### Blockchain
- `GET /api/blockchain` - Get transaction history

### Forecasting
- `GET /api/forecast/{sku}` - Generate demand forecast

### Delivery
- `GET /api/delivery` - List deliveries
- `POST /api/delivery` - Schedule delivery
- `WS /ws/delivery` - WebSocket for real-time updates

### Dashboard
- `GET /api/stats` - Get dashboard statistics

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
pytest tests/
```


### Test Forecast Endpoint
```bash
curl -X GET http://localhost:8001/api/forecast/SHIRT-001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🏗️ Architecture

```
┌─────────────────┐
│   React UI      │
│  (Port 3000)    │
└────────┬────────┘
         │
         │ HTTP/WebSocket
         │
┌────────▼────────┐
│  FastAPI Server │
│  (Port 8000)    │
└────────┬────────┘
         │
    ┌────┴────┬────────────┐
    │         │            │
┌───▼───┐ ┌──▼───┐  ┌─────▼─────┐
│MongoDB│ │Prophet│  │WebSocket  │
│  DB   │ │  AI   │  │  Manager  │
└───────┘ └──────┘  └───────────┘
```

## 📈 Future Enhancements

1. **Blockchain Integration**
   - Deploy on Ethereum/Polygon testnet
   - Use Web3.js for real smart contracts
   - Implement wallet connection

2. **Advanced Virtual Try-On**
   - MediaPipe body pose detection
   - Three.js 3D mesh rendering
   - Size recommendation AI

3. **Enhanced Forecasting**
   - LSTM/GRU models for complex patterns
   - Multi-variate predictions
   - External data integration (weather, events)


5. **Monitoring & Analytics**
   - Prometheus metrics
   - Grafana dashboards
   - Error tracking with Sentry

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT License - feel free to use this project for your own purposes.

## 👥 Support

For issues and questions, please open an issue on GitHub.