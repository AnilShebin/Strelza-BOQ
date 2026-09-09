import os
import sys
import sqlite3

# Ensure backend directory is in python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.agent_tools import (
    tool_resolve_feeder_cable,
    tool_verify_commercial_basis,
    tool_get_estimator_precedents,
    tool_resolve_antenna,
    execute_agent_tool
)

def test_feeder_cables():
    print("=== TEST 1: Feeder Cable Resolution ===")
    # 1a: Single run 35m 7/8" -> W12817
    res_1a = tool_resolve_feeder_cable("7/8\" feeder cable single run", runs=1, route_length_m=35)
    print("1a (Single 7/8\"): ", res_1a.get("allocations"))
    assert any(a["sor_code"] == "W12817" for a in res_1a["allocations"]), "Expected W12817"

    # 1b: Pair run 40m 1-1/4" -> W12821
    res_1b = tool_resolve_feeder_cable("1-1/4\" feeder pair", runs=2, route_length_m=40)
    print("1b (Pair 1-1/4\"): ", res_1b.get("allocations"))
    assert any(a["sor_code"] == "W12821" for a in res_1b["allocations"]), "Expected W12821"

    # 1c: 3-pair run 45m 7/8" -> W12819
    res_1c = tool_resolve_feeder_cable("7/8\" feeder 3-pair (6 runs)", runs=6, route_length_m=45)
    print("1c (3-pair 7/8\"): ", res_1c.get("allocations"))
    assert any(a["sor_code"] == "W12819" for a in res_1c["allocations"]), "Expected W12819"

    # 1d: Feeder exceeding threshold (70m of 1/2", threshold is 50m) -> W12814 + W12826 x 20m
    res_1d = tool_resolve_feeder_cable("1/2\" feeder 70m", runs=1, route_length_m=70)
    print("1d (1/2\" + Extra Over): ", res_1d.get("allocations"), res_1d.get("extra_lm"))
    assert any(a["sor_code"] == "W12814" for a in res_1d["allocations"]), "Expected W12814 base"
    assert any(x["sor_code"] == "W12826" and x["quantity"] == 20 for x in res_1d["extra_lm"]), "Expected W12826 x 20m"
    print("Feeder Cable tests passed!")

def test_commercial_basis_verification():
    print("\n=== TEST 2: Commercial Basis Self-Verification ===")
    # 2a: First antenna with primary code W7520 -> Valid
    res_2a = tool_verify_commercial_basis("W7520", item_ordinal=1, total_proposed=3)
    print("2a (First antenna W7520):", res_2a)
    assert res_2a["valid"] is True, "Expected valid=True for first antenna"

    # 2b: Subsequent antenna (ordinal 2) with primary code W7520 -> Invalid, must recommend W13360
    res_2b = tool_verify_commercial_basis("W7520", item_ordinal=2, total_proposed=3)
    print("2b (Subsequent antenna W7520):", res_2b)
    assert res_2b["valid"] is False and res_2b["recommended_code"] == "W13360", "Expected W13360"

    # 2c: Subsequent 5G AAU (ordinal 2) with primary code W13358 -> Invalid, must recommend W13359
    res_2c = tool_verify_commercial_basis("W13358", item_ordinal=2, total_proposed=3)
    print("2c (Subsequent AAU W13358):", res_2c)
    assert res_2c["valid"] is False and res_2c["recommended_code"] == "W13359", "Expected W13359"
    print("Commercial basis verification tests passed!")

def test_dynamic_precedent_feedback_loop():
    print("\n=== TEST 3: Dynamic Precedent Feedback Loop ===")
    from services.feedback_service import log_human_feedback, FEEDBACK_STORE_PATH
    import json

    test_equipment = "TEST-ALPHA-HYBRID-FEEDER-CABLE"
    test_sor_code = "W12818"

    # 1. Log a human estimator feedback override
    feedback_record = log_human_feedback(
        takeoff_item={
            "raw_description": test_equipment,
            "equipment_type": "FEEDER_CABLE",
            "action": "INSTALL",
            "quantity": 1
        },
        system_decision={"chosen_code": "UNQUOTED"},
        corrected_code=test_sor_code,
        correction_reason="Human estimator verified 7/8 inch pair feeder"
    )
    print("Logged feedback record ID:", feedback_record.get("id"))

    # 2. Retrieve precedents via the agent tool
    retrieval_res = tool_get_estimator_precedents(test_equipment, limit=3)
    print("Agent tool retrieved count:", retrieval_res.get("count"))
    precedents = retrieval_res.get("precedents", [])
    assert len(precedents) > 0, "Expected at least 1 precedent returned"
    
    top_prec = precedents[0]
    matched_code = top_prec.get("corrected_code")
    print("Top matched precedent code:", matched_code)
    assert matched_code == test_sor_code, f"Expected {test_sor_code}, got {matched_code}"

    # 3. Clean up test record from store
    if os.path.exists(FEEDBACK_STORE_PATH):
        try:
            with open(FEEDBACK_STORE_PATH, "r", encoding="utf-8") as f:
                records = json.load(f)
            records = [r for r in records if r.get("id") != feedback_record.get("id")]
            with open(FEEDBACK_STORE_PATH, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)
        except Exception as e:
            print("Cleanup warning:", e)

    print("Dynamic precedent feedback loop test passed!")

if __name__ == "__main__":
    test_feeder_cables()
    test_commercial_basis_verification()
    test_dynamic_precedent_feedback_loop()
    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
