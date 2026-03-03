import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import get_nutrition_report

def run():
    try:
        data = get_nutrition_report()
        print("Report length:", len(data))
        if len(data) > 0:
            print("First item keys:", data[0].keys() if isinstance(data[0], dict) else "Not a dict")
            print("First item:", data[0])
    except Exception as e:
        print("Report API Error:", str(e))

if __name__ == "__main__":
    run()
