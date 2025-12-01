"""
Utility functions for the FastAPI application.

This module provides common utilities used across the application.
"""

from datetime import datetime
from typing import Any


def format_datetime(dt: datetime, include_time: bool = True) -> str:
    """
    Format a datetime object to a string.

    Args:
        dt: The datetime to format.
        include_time: Whether to include time in the output.

    Returns:
        Formatted datetime string.
    """
    if include_time:
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return dt.strftime("%Y-%m-%d")


def safe_get(data: dict, key: str, default: Any = None) -> Any:
    """
    Safely get a value from a dictionary.

    Args:
        data: The dictionary to get the value from.
        key: The key to look up.
        default: Default value if key not found.

    Returns:
        The value or default.
    """
    return data.get(key, default)
