"""
Backend API module.

Provides the main API endpoints for the application.
"""

from typing import Optional


def get_items(limit: int = 10, offset: int = 0) -> list[dict]:
    """
    Get a list of items.

    Args:
        limit: Maximum number of items to return.
        offset: Number of items to skip.

    Returns:
        List of item dictionaries.
    """
    return [{"id": i, "name": f"Item {i}"} for i in range(offset, offset + limit)]


def create_item(name: str, description: Optional[str] = None) -> dict:
    """
    Create a new item.

    Args:
        name: The name of the item.
        description: Optional description.

    Returns:
        The created item.
    """
    return {"id": 1, "name": name, "description": description}
