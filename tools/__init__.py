"""Tool registry"""

import importlib
import pkgutil
from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    func: Callable[..., str]

    def __call__(self, **kwargs) -> str:
        return self.func(**kwargs)

    @property
    def schema(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


_registry: dict[str, Tool] = {}


def tool(name: str, description: str, parameters: dict[str, Any]):
    def decorator(func: Callable[..., str]) -> Tool:
        t = Tool(name=name, description=description, parameters=parameters, func=func)
        _registry[name] = t
        return t

    return decorator


def load_all() -> dict[str, Tool]:
    """Auto-discover and import all tool modules in tools/ directory"""
    for _, module_name, _ in pkgutil.iter_modules(__path__):
        if module_name != "__init__":
            importlib.import_module(f".{module_name}", __package__)
    return dict(_registry)
