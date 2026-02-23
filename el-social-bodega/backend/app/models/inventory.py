from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class MovementType(str, Enum):
    purchase_entry = "purchase_entry"
    exit_by_request = "exit_by_request"
    adjustment = "adjustment"
    loss_damage = "loss_damage"
    transfer_bodega_to_sede = "transfer_bodega_to_sede"
    transfer_sede_to_bodega = "transfer_sede_to_bodega"


class ProductBase(BaseModel):
    category: str
    name: str
    unit: str
    min_stock: int = 0


class ProductCreate(ProductBase):
    code: Optional[str] = None
    initial_quantity: int = 0
    initial_stock_location: str = "all_sedes"  # "bodega" | "all_sedes" | "single_sede"
    initial_sede_id: Optional[int] = None


class ProductUpdate(BaseModel):
    category: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None
    unit: Optional[str] = None
    min_stock: Optional[int] = None


class ProductResponse(ProductBase):
    id: int
    code: Optional[str] = None
    current_quantity: Optional[int] = 0
    quantity_counted_at: Optional[datetime] = None
    created_by: Optional[str] = None
    is_pending: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProductSupplierLink(BaseModel):
    supplier_id: int
    slot: int  # 1, 2, or 3


class PriceEntry(BaseModel):
    supplier_id: int
    price: float
    recorded_month: int
    recorded_year: int


class PriceRecord(PriceEntry):
    id: int
    product_id: int
    created_at: Optional[datetime] = None


class PriceComparison(BaseModel):
    supplier_id: int
    supplier_name: str
    slot: int
    current_price: Optional[float] = None
    previous_price: Optional[float] = None
    variation_pct: Optional[float] = None
    is_best_price: bool = False


class MovementCreate(BaseModel):
    product_id: int
    movement_type: MovementType
    quantity: int
    sede_id: Optional[int] = None
    notes: Optional[str] = None


class MovementResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    movement_type: MovementType
    quantity: int
    user_id: str
    user_email: Optional[str] = None
    sede_id: Optional[int] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class LowStockAlert(BaseModel):
    product_id: int
    product_name: str
    product_code: str
    current_quantity: int
    min_stock: int
    deficit: int


class SedeStockItem(BaseModel):
    """Product stock at a specific sede."""
    product_id: int
    code: Optional[str] = None
    name: str
    category: str
    unit: str
    quantity: int = 0
    quantity_counted_at: Optional[datetime] = None


class SedeStockUpdate(BaseModel):
    """Body to set stock for a product at a sede."""
    product_id: int
    quantity: int  # must be >= 0


class TransferRequest(BaseModel):
    """Body to transfer stock between bodega and a sede."""
    product_id: int
    direction: str  # "bodega_to_sede" | "sede_to_bodega"
    sede_id: int
    quantity: int  # must be > 0
