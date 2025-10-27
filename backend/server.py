from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import pandas as pd
import numpy as np
from prophet import Prophet
import asyncio
import json
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

# Pydantic Models
class UserResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    full_name: str
    role: str

class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str
    name: str
    description: str
    quantity: int
    reorder_threshold: int
    price: float
    category: str
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryItemCreate(BaseModel):
    sku: str
    name: str
    description: str
    quantity: int
    reorder_threshold: int
    price: float
    category: str
    image_url: Optional[str] = None

class InventoryUpdate(BaseModel):
    quantity: int
    action: str  # "purchase" or "restock"

class BlockchainTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_type: str  # "register", "purchase", "restock"
    sku: str
    quantity: int
    previous_hash: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    hash: str

class ForecastData(BaseModel):
    sku: str
    date: str
    predicted_demand: float
    lower_bound: float
    upper_bound: float

class DeliverySchedule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    sku: str
    status: str  # "pending", "in_transit", "delivered"
    route: str
    estimated_delivery: datetime
    current_location: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeliveryCreate(BaseModel):
    order_id: str
    sku: str
    route: str
    estimated_delivery: datetime

def calculate_hash(data: str) -> str:
    import hashlib
    return hashlib.sha256(data.encode()).hexdigest()

# Inventory Routes
@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory_item(item_data: InventoryItemCreate):
    logger.info(f"Received inventory item creation request: {item_data.model_dump_json()}")
    # Check if SKU exists
    existing = await db.inventory.find_one({"sku": item_data.sku})
    if existing:
        logger.warning(f"Attempted to create item with existing SKU: {item_data.sku}")
        raise HTTPException(status_code=400, detail="SKU already exists")
    
    try:
        item = InventoryItem(**item_data.model_dump())
        item_dict = item.model_dump()
        item_dict['created_at'] = item_dict['created_at'].isoformat()
        item_dict['updated_at'] = item_dict['updated_at'].isoformat()
        
        await db.inventory.insert_one(item_dict)
        
        # Record in blockchain
        await record_blockchain_transaction("register", item.sku, item.quantity)
        
        logger.info(f"Successfully created inventory item: {item.sku}")
        return item
    except Exception as e:
        logger.error(f"Error creating inventory item: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create item: {e}")

@api_router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory():
    items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item['created_at'], str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if isinstance(item['updated_at'], str):
            item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return items

@api_router.get("/inventory/{sku}", response_model=InventoryItem)
async def get_inventory_item(sku: str):
    item = await db.inventory.find_one({"sku": sku}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if isinstance(item['created_at'], str):
        item['created_at'] = datetime.fromisoformat(item['created_at'])
    if isinstance(item['updated_at'], str):
        item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return item

@api_router.put("/inventory/{sku}")
async def update_inventory(sku: str, update_data: InventoryUpdate):
    item = await db.inventory.find_one({"sku": sku})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    current_quantity = item["quantity"]
    
    if update_data.action == "purchase":
        new_quantity = current_quantity - update_data.quantity
        if new_quantity < 0:
            raise HTTPException(status_code=400, detail="Insufficient inventory")
    elif update_data.action == "restock":
        new_quantity = current_quantity + update_data.quantity
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    await db.inventory.update_one(
        {"sku": sku},
        {"$set": {"quantity": new_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Record in blockchain
    await record_blockchain_transaction(update_data.action, sku, update_data.quantity)
    
    # Check reorder threshold
    if new_quantity <= item["reorder_threshold"]:
        # Auto-trigger reorder notification
        pass
    
    return {"message": "Inventory updated", "new_quantity": new_quantity}

# Blockchain Routes
async def record_blockchain_transaction(transaction_type: str, sku: str, quantity: int):
    # Get the last transaction to create a chain
    last_transaction = await db.blockchain.find_one(sort=[("timestamp", -1)])
    previous_hash = last_transaction["hash"] if last_transaction else "0" * 64
    
    # Create transaction data
    transaction_data = f"{transaction_type}{sku}{quantity}{previous_hash}{datetime.now(timezone.utc).isoformat()}"
    transaction_hash = calculate_hash(transaction_data)
    
    transaction = BlockchainTransaction(
        transaction_type=transaction_type,
        sku=sku,
        quantity=quantity,
        previous_hash=previous_hash,
        hash=transaction_hash
    )
    
    transaction_dict = transaction.model_dump()
    transaction_dict['timestamp'] = transaction_dict['timestamp'].isoformat()
    
    await db.blockchain.insert_one(transaction_dict)

@api_router.get("/blockchain", response_model=List[BlockchainTransaction])
async def get_blockchain():
    transactions = await db.blockchain.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    for tx in transactions:
        if isinstance(tx['timestamp'], str):
            tx['timestamp'] = datetime.fromisoformat(tx['timestamp'])
    return transactions

# Forecasting Routes
@api_router.get("/forecast/{sku}", response_model=List[ForecastData])
async def get_forecast(sku: str):
    # Generate mock historical data for Prophet
    # In production, this would come from actual sales data
    dates = pd.date_range(end=datetime.now(), periods=90, freq='D')
    
    # Create synthetic data with trend and seasonality
    np.random.seed(hash(sku) % 2**32)
    trend = np.linspace(50, 100, 90)
    seasonal = 20 * np.sin(np.arange(90) * 2 * np.pi / 7)  # Weekly seasonality
    noise = np.random.normal(0, 10, 90)
    y = trend + seasonal + noise
    y = np.maximum(y, 0)  # Ensure non-negative
    
    df = pd.DataFrame({
        'ds': dates,
        'y': y
    })
    
    # Train Prophet model
    try:
        model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=False,
            interval_width=0.95
        )
        model.fit(df)
        
        # Forecast next 7 days
        future = model.make_future_dataframe(periods=7)
        forecast = model.predict(future)
        
        # Get only future predictions
        future_forecast = forecast.tail(7)
        
        results = []
        for _, row in future_forecast.iterrows():
            results.append(ForecastData(
                sku=sku,
                date=row['ds'].strftime('%Y-%m-%d'),
                predicted_demand=max(0, round(row['yhat'], 2)),
                lower_bound=max(0, round(row['yhat_lower'], 2)),
                upper_bound=max(0, round(row['yhat_upper'], 2))
            ))
        
        return results
    except Exception as e:
        logging.error(f"Forecast error: {str(e)}")
        raise HTTPException(status_code=500, detail="Forecast generation failed")
 
# Delivery Routes
@api_router.post("/delivery", response_model=DeliverySchedule)
async def create_delivery(delivery_data: DeliveryCreate):
    delivery = DeliverySchedule(
        order_id=delivery_data.order_id,
        sku=delivery_data.sku,
        status="pending",
        route=delivery_data.route,
        estimated_delivery=delivery_data.estimated_delivery,
        current_location="Warehouse"
    )
    
    delivery_dict = delivery.model_dump()
    delivery_dict['estimated_delivery'] = delivery_dict['estimated_delivery'].isoformat()
    delivery_dict['updated_at'] = delivery_dict['updated_at'].isoformat()
    
    await db.deliveries.insert_one(delivery_dict)
    return delivery

@api_router.get("/delivery", response_model=List[DeliverySchedule])
async def get_deliveries():
    deliveries = await db.deliveries.find({}, {"_id": 0}).to_list(1000)
    for delivery in deliveries:
        if isinstance(delivery['estimated_delivery'], str):
            delivery['estimated_delivery'] = datetime.fromisoformat(delivery['estimated_delivery'])
        if isinstance(delivery['updated_at'], str):
            delivery['updated_at'] = datetime.fromisoformat(delivery['updated_at'])
    return deliveries

# WebSocket for real-time delivery updates
@app.websocket("/ws/delivery")
async def websocket_delivery_updates(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await asyncio.sleep(10)  # Update every 10 seconds
            
            # Simulate delivery updates
            deliveries = await db.deliveries.find({}, {"_id": 0}).to_list(100)
            
            for delivery in deliveries:
                if delivery['status'] != 'delivered':
                    # Simulate progress
                    locations = ["Warehouse", "Processing Center", "In Transit", "Local Hub", "Out for Delivery", "Delivered"]
                    current_idx = locations.index(delivery['current_location']) if delivery['current_location'] in locations else 0
                    
                    if current_idx < len(locations) - 1 and random.random() > 0.5:
                        new_idx = current_idx + 1
                        new_location = locations[new_idx]
                        new_status = "delivered" if new_idx == len(locations) - 1 else "in_transit"
                        
                        await db.deliveries.update_one(
                            {"id": delivery['id']},
                            {"$set": {
                                "current_location": new_location,
                                "status": new_status,
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                        
                        # Broadcast update
                        update_message = json.dumps({
                            "id": delivery['id'],
                            "order_id": delivery['order_id'],
                            "current_location": new_location,
                            "status": new_status
                        })
                        await manager.broadcast(update_message)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logging.error(f"WebSocket error: {str(e)}")
        manager.disconnect(websocket)

# Dashboard Stats
@api_router.get("/stats")
async def get_stats():
    total_items = await db.inventory.count_documents({})
    low_stock_items = await db.inventory.count_documents({"$expr": {"$lte": ["$quantity", "$reorder_threshold"]}})
    pending_deliveries = await db.deliveries.count_documents({"status": {"$in": ["pending", "in_transit"]}})
    total_transactions = await db.blockchain.count_documents({})
    
    return {
        "total_items": total_items,
        "low_stock_items": low_stock_items,
        "pending_deliveries": pending_deliveries,
        "total_transactions": total_transactions
    }

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["http://localhost:3000", "http://localhost:3001"], # Added port 3000
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Set uvicorn's access log level to warning to reduce verbosity, but keep our app logs at INFO
uvicorn_access_logger = logging.getLogger("uvicorn.access")
uvicorn_access_logger.setLevel(logging.INFO) # Change to INFO to see all requests

uvicorn_error_logger = logging.getLogger("uvicorn.error")
uvicorn_error_logger.setLevel(logging.INFO) # Change to INFO to see all errors

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()