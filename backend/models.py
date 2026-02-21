"""
Database Models - Radar de Preço & CMV
SQLModel schemas matching Supabase PostgreSQL tables.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlmodel import SQLModel, Field
from enum import Enum


class CategoryEnum(str, Enum):
    MERCADO = "MERCADO"
    LIMPEZA = "LIMPEZA"
    HORTIFRUTI = "HORTIFRUTI"
    ACOUGUE = "ACOUGUE"
    EMBALAGEM = "EMBALAGEM"
    OUTROS = "OUTROS"


class ReceiptStatusEnum(str, Enum):
    PENDING_VALIDATION = "pending_validation"
    VERIFIED = "verified"
    REJECTED = "rejected"


class Ingredient(SQLModel, table=True):
    __tablename__ = "ingredients"
    
    id: Optional[str] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    category: CategoryEnum
    current_price: Decimal = Field(default=Decimal("0.00"))
    yield_coefficient: Decimal = Field(default=Decimal("1.0000"))
    unit: str = Field(default="UN")  # kg, L, un, pct
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Receipt(SQLModel, table=True):
    __tablename__ = "receipts"
    
    id: Optional[str] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    market_name: Optional[str] = None
    total_amount: Optional[Decimal] = None
    image_url: Optional[str] = None
    status: ReceiptStatusEnum = Field(default=ReceiptStatusEnum.PENDING_VALIDATION)


class ProductMap(SQLModel, table=True):
    __tablename__ = "product_map"
    
    id: Optional[str] = Field(default=None, primary_key=True)
    raw_name: str = Field(index=True)
    ingredient_id: str = Field(foreign_key="ingredients.id")
    confidence: Decimal = Field(default=Decimal("1.0"))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ReceiptItem(SQLModel, table=True):
    __tablename__ = "receipt_items"
    
    id: Optional[str] = Field(default=None, primary_key=True)
    receipt_id: str = Field(foreign_key="receipts.id", index=True)
    raw_name: str
    parsed_price: Optional[Decimal] = None
    quantity: Decimal = Field(default=Decimal("1.0"))
    matched_ingredient_id: Optional[str] = Field(default=None, foreign_key="ingredients.id")
    category_suggestion: Optional[str] = None
    verified: bool = Field(default=False)


class Recipe(SQLModel, table=True):
    __tablename__ = "recipes"
    
    id: Optional[str] = Field(default=None, primary_key=True)
    name: str
    current_cost: Decimal = Field(default=Decimal("0.00"))
    yield_units: int  # How many units produced (e.g., 10 lasagnas)
    total_weight_kg: Decimal  # Total weight in kg (e.g., 12.5)
    labor_cost: Decimal = Field(default=Decimal("0.00"))
    sku: Optional[str] = Field(default=None, unique=True)
    product_id: Optional[int] = Field(default=None)
    cmv_per_unit: Optional[Decimal] = None  # Computed: current_cost / yield_units
    cmv_per_kg: Optional[Decimal] = None  # Computed: current_cost / total_weight_kg
    is_pre_preparo: bool = Field(default=False)
    derived_ingredient_id: Optional[str] = Field(default=None)
    production_unit: str = Field(default="KG")
    last_calculated: datetime = Field(default_factory=datetime.utcnow)


class RecipeIngredient(SQLModel, table=True):
    __tablename__ = "recipe_ingredients"
    
    id: Optional[str] = Field(default=None, primary_key=True)
    recipe_id: str = Field(foreign_key="recipes.id")
    ingredient_id: str = Field(foreign_key="ingredients.id")
    quantity: Decimal  # Amount of ingredient used


class CMVHistory(SQLModel, table=True):
    __tablename__ = "cmv_history"
    
    id: Optional[str] = Field(default=None, primary_key=True)
    recipe_id: str = Field(foreign_key="recipes.id")
    product_id: Optional[int] = Field(default=None)
    cost: Decimal
    recorded_at: datetime = Field(default_factory=datetime.utcnow)
