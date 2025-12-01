# Python file with violations in mixed project

import json  # F401: unused import

def bad_func(x,y):  # E231: missing whitespace
    return x+y
