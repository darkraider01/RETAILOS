from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
import jwt
from passlib.context import CryptContext
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

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

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
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    full_name: str
    role: str  # "manager", "supplier", "customer"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "customer"

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

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

# Helper Functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_hash(data: str) -> str:
    import hashlib
    return hashlib.sha256(data.encode()).hexdigest()

# Authentication Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user.id, "role": user.role})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role
        )
    )

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user["full_name"],
        role=current_user["role"]
    )

# Inventory Routes
@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory_item(item_data: InventoryItemCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["manager", "supplier"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if SKU exists
    existing = await db.inventory.find_one({"sku": item_data.sku})
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")
    
    item = InventoryItem(**item_data.model_dump())
    item_dict = item.model_dump()
    item_dict['created_at'] = item_dict['created_at'].isoformat()
    item_dict['updated_at'] = item_dict['updated_at'].isoformat()
    
    await db.inventory.insert_one(item_dict)
    
    # Record in blockchain
    await record_blockchain_transaction("register", item.sku, item.quantity)
    
    return item

@api_router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory(current_user: dict = Depends(get_current_user)):
    items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item['created_at'], str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if isinstance(item['updated_at'], str):
            item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return items

@api_router.get("/inventory/{sku}", response_model=InventoryItem)
async def get_inventory_item(sku: str, current_user: dict = Depends(get_current_user)):
    item = await db.inventory.find_one({"sku": sku}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if isinstance(item['created_at'], str):
        item['created_at'] = datetime.fromisoformat(item['created_at'])
    if isinstance(item['updated_at'], str):
        item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return item

@api_router.put("/inventory/{sku}")
async def update_inventory(sku: str, update_data: InventoryUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["manager", "supplier"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
async def get_blockchain(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["manager", "supplier"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    transactions = await db.blockchain.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    for tx in transactions:
        if isinstance(tx['timestamp'], str):
            tx['timestamp'] = datetime.fromisoformat(tx['timestamp'])
    return transactions

# Forecasting Routes
@api_router.get("/forecast/{sku}", response_model=List[ForecastData])
async def get_forecast(sku: str, current_user: dict = Depends(get_current_user)):
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
async def create_delivery(delivery_data: DeliveryCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["manager", "supplier"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
async def get_deliveries(current_user: dict = Depends(get_current_user)):
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
async def get_stats(current_user: dict = Depends(get_current_user)):
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
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()