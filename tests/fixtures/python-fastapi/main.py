"""
Main FastAPI application module.

This module defines the FastAPI application and its routes.
"""

from typing import Optional


def get_greeting(name: str, formal: bool = False) -> str:
    """
    Generate a greeting message.

    Args:
        name: The name of the person to greet.
        formal: Whether to use formal greeting.

    Returns:
        A greeting string.
    """
    if formal:
        return f"Good day, {name}."
    return f"Hello, {name}!"


def calculate_total(items: list[dict], tax_rate: float = 0.1) -> float:
    """
    Calculate the total price including tax.

    Args:
        items: List of items with 'price' and 'quantity' keys.
        tax_rate: The tax rate to apply (default 10%).

    Returns:
        The total price including tax.
    """
    subtotal = sum(item["price"] * item["quantity"] for item in items)
    return subtotal * (1 + tax_rate)


class UserService:
    """Service for managing users."""

    def __init__(self, db_url: str) -> None:
        """
        Initialize the user service.

        Args:
            db_url: Database connection URL.
        """
        self.db_url = db_url

    def get_user(self, user_id: int) -> Optional[dict]:
        """
        Retrieve a user by ID.

        Args:
            user_id: The ID of the user to retrieve.

        Returns:
            User data dict or None if not found.
        """
        # Placeholder implementation
        return {"id": user_id, "name": "Test User"}
