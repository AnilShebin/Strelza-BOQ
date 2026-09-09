import os
import sys
import json

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.ai_service import load_env_file
from services.agent_service import run_agentic_boq_pipeline

load_env_file()
api_key = os.environ.get("GEMINI_API_KEY", "")

def test_full_pipeline():
    print("=== Testing Agentic BOQ Pipeline with Gemini 3.8 Flash ===")
    
    # Mock extracted tables from drawing schedule
    extracted_tables = [
        {
            "page": 2,
            "table_title": "ANTENNA AND FEEDER SCHEDULE",
            "headers": ["ITEM", "DESCRIPTION", "EXISTING", "PROPOSED", "TOTAL"],
            "rows": [
                ["1", "7/8\" Feeder Cable (35m route length, 2 runs)", "0", "2", "2"],
                ["2", "CommScope RVV-65D-R4 Passive Panel Antenna", "0", "3", "3"],
                ["3", "Ericsson AIR 6449 5G AAU", "0", "3", "3"],
                ["4", "Existing Kathrein Panel Antenna to be removed", "1", "0", "0"]
            ]
        }
    ]

    elements = [
        {
            "page": 2,
            "type": "unstructured",
            "content": "ANTENNA SECTOR A: 1 OFF PROPOSED PANEL ANTENNA AND 1 OFF 5G AAU"
        }
    ]

    # Price list containing the target SOR codes
    price_list = [
        {"code": "W12818", "name": "7/8 Feeder Cable x 2 (one pair)", "unit": "Each", "rate": 650.0, "row_idx": 1},
        {"code": "W7520", "name": "One panel Antenna installation", "unit": "Each", "rate": 450.0, "row_idx": 2},
        {"code": "W13360", "name": "One panel Antenna installation- extra over", "unit": "Each", "rate": 320.0, "row_idx": 3},
        {"code": "W13358", "name": "One 5G AAU Installation - first", "unit": "Each", "rate": 780.0, "row_idx": 4},
        {"code": "W13359", "name": "One 5G AAU Installation - extra over", "unit": "Each", "rate": 510.0, "row_idx": 5},
        {"code": "R12513", "name": "Remove Panel Antenna or tower mounted device", "unit": "Each", "rate": 285.0, "row_idx": 6},
    ]

    results = run_agentic_boq_pipeline(
        extracted_tables=extracted_tables,
        elements=elements,
        price_list=price_list,
        api_key=api_key
    )

    print(f"\nGenerated {len(results)} mapped BOQ items:")
    for r in results:
        print(f"  - [{r.get('sor_code')}] {r.get('item_name')} | Qty: {r.get('quantity')} {r.get('unit')} | Rate: ${r.get('rate')} | Total: ${r.get('total_cost')} | Logic: {r.get('comment')}")

    # Assertions
    codes = [r.get("sor_code") for r in results]
    assert "W12818" in codes, "Expected Feeder pair W12818"
    assert "W7520" in codes, "Expected W7520 for 1st antenna"
    assert "W13360" in codes, "Expected W13360 for extra-over antennas"
    assert "W13358" in codes, "Expected W13358 for 1st 5G AAU"
    assert "W13359" in codes, "Expected W13359 for extra-over 5G AAUs"
    print("\nALL PIPELINE TESTS PASSED WITH GEMINI 3.8 FLASH!")

if __name__ == "__main__":
    test_full_pipeline()
