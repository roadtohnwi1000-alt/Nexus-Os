# Core API root package
import sys
import os
from importlib.abc import MetaPathFinder
from importlib.util import spec_from_file_location

class PurePythonSQLAlchemyFinder(MetaPathFinder):
    """
    Bypasses Windows Application Control / Smart App Control policy
    which blocks unsigned .pyd binaries in SQLAlchemy by transparently falling
    back to SQLAlchemy's built-in pure Python implementations.
    """
    def find_spec(self, fullname, path, target=None):
        if fullname.startswith("sqlalchemy.") and fullname.endswith("_cy"):
            if path:
                mod_name = fullname.split(".")[-1]
                for p in path:
                    py_file = os.path.join(p, mod_name + ".py")
                    if os.path.isfile(py_file):
                        return spec_from_file_location(fullname, py_file)
        return None

if not any(isinstance(f, PurePythonSQLAlchemyFinder) for f in sys.meta_path):
    sys.meta_path.insert(0, PurePythonSQLAlchemyFinder())

