import os
import tempfile
import pytest
import services.db
from services.db import init_db
from services.matcher import (
    load_master_price_list,
    update_price_item_in_excel,
    clear_price_item_in_excel,
    add_price_item_to_excel,
    generate_populated_boq_excel,
    write_cell_value_to_excel,
    clear_column_values_in_excel,
    clear_price_items_in_excel_batch,
    clear_all_price_items_in_excel
)

# Override database path to use a temporary SQLite file for the test run
temp_db_fd, temp_db_path = tempfile.mkstemp(suffix=".db")
services.db.DB_PATH = temp_db_path

def test_price_list_sqlite_operations():
    try:
        # Initialize tables
        init_db()

        # 1. Clear database initially
        clear_all_price_items_in_excel("")
        all_rows_init = load_master_price_list("")
        assert len(all_rows_init) == 0

        # 2. Add pricing items manually
        add_success_1 = add_price_item_to_excel("", code="W7893", name="Tower Mounted Device", unit="each", rate=400.0, category="Mobiles")
        add_success_2 = add_price_item_to_excel("", code="R12513", name="Remote Radio Unit Removal", unit="each", rate=292.5, category="Mobiles")
        add_success_3 = add_price_item_to_excel("", code="W13358", name="One 5G AAU", unit="each", rate=1248.0, category="Antennas")
        assert add_success_1 is True
        assert add_success_2 is True
        assert add_success_3 is True

        # Load back
        all_rows = load_master_price_list("")
        # Should include: Section "Antennas" + 1 item, Section "Mobiles" + 2 items = 5 elements
        assert len(all_rows) == 5

        # Verify classifications and fields
        antennas_section = [r for r in all_rows if r["row_type"] == "section_header" and r["name"] == "Antennas"]
        assert len(antennas_section) == 1

        mobiles_section = [r for r in all_rows if r["row_type"] == "section_header" and r["name"] == "Mobiles"]
        assert len(mobiles_section) == 1

        data_items = [r for r in all_rows if r["row_type"] == "data_item"]
        assert len(data_items) == 3
        
        # 3. Test specific row update
        row_id_to_update = data_items[0]["row_idx"]
        up_success = update_price_item_in_excel("", row_idx=row_id_to_update, code="W7893", name="Tower Mounted Device - Updated", unit="each", rate=450.0, category="Mobiles")
        assert up_success is True

        all_rows_2 = load_master_price_list("")
        updated_item = [r for r in all_rows_2 if r["row_type"] == "data_item" and r["row_idx"] == row_id_to_update][0]
        assert updated_item["name"] == "Tower Mounted Device - Updated"
        assert updated_item["rate"] == 450.0

        # 4. Test cell value update (quantity sync)
        write_success = write_cell_value_to_excel("", row_idx=row_id_to_update, col_idx=5, value="5")
        assert write_success is True
        all_rows_3 = load_master_price_list("")
        qty_item = [r for r in all_rows_3 if r["row_type"] == "data_item" and r["row_idx"] == row_id_to_update][0]
        assert qty_item["cells"][4] == "5"

        # 5. Test clear column values (reset quantities)
        clear_col_success = clear_column_values_in_excel("", "QTY")
        assert clear_col_success is True
        all_rows_4 = load_master_price_list("")
        cleared_qty_item = [r for r in all_rows_4 if r["row_type"] == "data_item" and r["row_idx"] == row_id_to_update][0]
        assert cleared_qty_item["cells"][4] == ""

        # 6. Test specific item deletion
        row_id_to_delete = data_items[1]["row_idx"]
        delete_success = clear_price_item_in_excel("", row_idx=row_id_to_delete)
        assert delete_success is True
        all_rows_5 = load_master_price_list("")
        data_items_after_delete = [r for r in all_rows_5 if r["row_type"] == "data_item"]
        assert len(data_items_after_delete) == 2
        assert not any(r["row_idx"] == row_id_to_delete for r in data_items_after_delete)

        # 7. Test batch deletion
        batch_ids = [data_items[0]["row_idx"], data_items[2]["row_idx"]]
        batch_success = clear_price_items_in_excel_batch("", batch_ids)
        assert batch_success is True
        all_rows_6 = load_master_price_list("")
        data_items_after_batch = [r for r in all_rows_6 if r["row_type"] == "data_item"]
        assert len(data_items_after_batch) == 0

    finally:
        # Cleanup temporary database
        try:
            os.close(temp_db_fd)
            os.remove(temp_db_path)
        except Exception:
            pass

def test_multi_pricebook_and_comments():
    # Setup fresh database override
    temp_db_fd, temp_db_path = tempfile.mkstemp(suffix="_multi.db")
    services.db.DB_PATH = temp_db_path
    
    try:
        init_db()
        
        # We start with default price list (id 1)
        from services.db import get_db_connection
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, is_active FROM price_lists")
        books = cursor.fetchall()
        assert len(books) == 1
        assert books[0]["name"] == "Default Price List"
        assert books[0]["is_active"] == 1
        
        # 1. Create a second price book
        cursor.execute("INSERT INTO price_lists (name, is_active) VALUES ('Optus Book', 0)")
        new_id = cursor.lastrowid
        conn.commit()
        assert new_id is not None
        
        # 2. Add item with comments to Default list (id 1)
        add_price_item_to_excel("", code="W1", name="Default Item", unit="each", rate=100.0, category="Default Cat")
        # Add item to new list (Optus Book)
        cursor.execute(
            "INSERT INTO price_items (code, name, unit, rate, quantity, category, price_list_id) VALUES (?, ?, ?, ?, 0.0, ?, ?)",
            ("O1", "Optus Item", "each", 200.0, "Optus Cat", new_id)
        )
        conn.commit()
        
        # Check load isolation
        default_items = load_master_price_list("", price_list_id=1)
        optus_items = load_master_price_list("", price_list_id=new_id)
        
        default_data = [r for r in default_items if r["row_type"] == "data_item"]
        optus_data = [r for r in optus_items if r["row_type"] == "data_item"]
        
        assert len(default_data) > 1
        assert any(r["code"] == "W1" for r in default_data)
        assert len(optus_data) == 1
        assert optus_data[0]["code"] == "O1"
        
        # 3. Test inline comment edit
        row_id_optus = optus_data[0]["row_idx"]
        comment_success = write_cell_value_to_excel("", row_idx=row_id_optus, col_idx=6, value="Optus special item comment")
        assert comment_success is True
        
        # Reload and check comments mapping (cells index 6)
        optus_items_reloaded = load_master_price_list("", price_list_id=new_id)
        optus_data_reloaded = [r for r in optus_items_reloaded if r["row_type"] == "data_item"][0]
        assert optus_data_reloaded["cells"][6] == "Optus special item comment"
        
        # 4. Try to delete the only remaining price book from front/back guards
        # We have 2 price books. Deleting Default list is fine because Optus exists
        cursor.execute("DELETE FROM price_items WHERE price_list_id = ?", (1,))
        cursor.execute("DELETE FROM price_lists WHERE id = ?", (1,))
        conn.commit()
        
        cursor.execute("SELECT id FROM price_lists")
        remaining_books = cursor.fetchall()
        assert len(remaining_books) == 1
        assert remaining_books[0]["id"] == new_id
        
        # Verify deleting the last remaining price book is blocked/prevented at API level
        # (This is validated in main.py, here we verify the database state constraints)
        assert len(remaining_books) == 1
        
        conn.close()
        
    finally:
        try:
            os.close(temp_db_fd)
            os.remove(temp_db_path)
        except Exception:
            pass

def test_price_list_deletion_flow():
    from main import get_price_lists, create_price_list, delete_price_list, PriceListCreateModel
    from fastapi import HTTPException
    
    # Use temporary database
    temp_db_fd, temp_db_path = tempfile.mkstemp(suffix="_test_delete_api.db")
    import services.db
    services.db.DB_PATH = temp_db_path
    
    try:
        init_db()
        
        # 1. Fetch initial price lists (should have only 1: Default Price List)
        lists = get_price_lists()
        assert len(lists) == 1
        assert lists[0]["id"] == 1
        assert lists[0]["is_active"] == 1
        
        # 2. Try to delete the only price list (should fail)
        with pytest.raises(HTTPException) as exc_info:
            delete_price_list(1)
        assert exc_info.value.status_code == 400
        assert "Cannot delete the last remaining Price Book" in exc_info.value.detail
        
        # 3. Create a second price book
        res = create_price_list(PriceListCreateModel(name="Second Price Book"))
        second_id = res["id"]
        assert second_id is not None
        
        # Now we have 2 lists: ID 1 and second_id
        # 4. Deleting ID 1 (default) should now succeed!
        res_del = delete_price_list(1)
        assert res_del["status"] == "success"
        
        # 5. Check price lists again
        lists_2 = get_price_lists()
        assert len(lists_2) == 1
        assert lists_2[0]["id"] == second_id
        assert lists_2[0]["is_active"] == 1  # Should be automatically set active!
        
        # 6. Try to delete the second book (which is now the last one) - should fail
        with pytest.raises(HTTPException) as exc_info_2:
            delete_price_list(second_id)
        assert exc_info_2.value.status_code == 400
        assert "Cannot delete the last remaining Price Book" in exc_info_2.value.detail
        
    finally:
        try:
            os.close(temp_db_fd)
            os.remove(temp_db_path)
            # also remove temporary file created by sync_db_to_active_excel if exists
            import services.matcher
            file_path = services.matcher.get_price_list_path(second_id)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
            file_path_1 = services.matcher.get_price_list_path(1)
            if os.path.exists(file_path_1):
                try:
                    os.remove(file_path_1)
                except Exception:
                    pass
        except Exception:
            pass

def test_import_hierarchical_telstra_pb():
    import openpyxl
    from main import import_price_list
    from services.db import get_db_connection
    from fastapi import UploadFile
    import io
    
    # Use temporary database
    temp_db_fd, temp_db_path = tempfile.mkstemp(suffix="_test_hierarchical.db")
    import services.db
    services.db.DB_PATH = temp_db_path
    
    try:
        init_db()
        
        # 1. Create a dummy Telstra Wireless pricebook layout in memory
        wb = openpyxl.Workbook()
        sheet = wb.active
        sheet.title = "SOR"
        
        # Row 1: headers
        sheet.append(["Item Name", None, "Unit of Qty", "Rate Excluding GST", "Qty", "Total Cost Excluding GST", "Comments"])
        # Row 2: Category Header
        sheet.append(["MOBILES - SMR and INTEGRATION", None, None, None, None, None, None])
        # Row 3: Subcategory Header
        sheet.append([None, "SMR CIVILS (inc plant)", None, None, None, None, None])
        # Row 4: Subsection Header
        sheet.append(["Foundation", None, None, None, None, None, None])
        # Row 5: Data Item 1
        sheet.append(["W11407", "Shelter Slab Foundation", "EaCh", 4980.00, None, None, "Special comment"])
        # Row 6: Blank spacer row (should be skipped!)
        sheet.append([None, None, None, None, None, None, None])
        # Row 7: Data Item 2
        sheet.append(["W13292", "Additional slab volume", "m3", 1050.00, None, None, None])
        # Row 8: Data Item 3 (empty rate and unit, should import as item, NOT category!)
        sheet.append(["W11537", "Equipment installed in the shelter", None, None, None, None, None])
        
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        wb.close()
        
        # Simulate FastAPI UploadFile
        upload_file = UploadFile(filename="Telstra_Wireless.xlsx", file=out)
        
        # 2. Run import
        import asyncio
        asyncio.run(import_price_list(price_list_id=1, file=upload_file))
        
        # 3. Query DB to verify
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT code, name, unit, rate, category, comments FROM price_items WHERE price_list_id = 1")
        items = cursor.fetchall()
        conn.close()
        
        # Verification assertions
        assert len(items) == 3
        
        # Verify Unit case normalization (EaCh -> each)
        assert items[0]["code"] == "W11407"
        assert items[0]["name"] == "Shelter Slab Foundation"
        assert items[0]["unit"] == "each"
        assert items[0]["rate"] == 4980.00
        assert items[0]["comments"] == "Special comment"
        assert items[0]["category"] == "Foundation"
        
        assert items[1]["code"] == "W13292"
        assert items[1]["unit"] == "m3"
        assert items[1]["rate"] == 1050.00
        assert items[1]["category"] == "Foundation"
        
        # Verify empty rate/unit item imports as regular data item
        assert items[2]["code"] == "W11537"
        assert items[2]["name"] == "Equipment installed in the shelter"
        assert items[2]["unit"] == "each"
        assert items[2]["rate"] == 0.0
        assert items[2]["category"] == "Foundation"
        
    finally:
        try:
            os.close(temp_db_fd)
            os.remove(temp_db_path)
            # clean up generated book
            import services.matcher
            file_path = services.matcher.get_price_list_path(1)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass


def test_price_list_profiling():
    import json
    from services.matcher import deterministic_parse_row, normalize_price_list_to_knowledge_base
    
    # 1. Test deterministic parsing
    res1 = deterministic_parse_row("Feeder - 30m Structure - 7/8 Feeder Cable x 2", "each")
    assert res1["semantic_class"] == "FEEDER"
    assert res1["commercial_action"] == "INSTALL"
    assert res1["quantity_basis"] == "EACH"
    assert res1["attributes"]["cable_size"] == "7/8"
    assert res1["attributes"]["cable_count"] == 2
    
    res2 = deterministic_parse_row("Proposed Monopole - 30m Tower", "each")
    assert res2["semantic_class"] == "STRUCTURE"
    assert res2["attributes"]["structure_height_m"] == 30.0
    
    res3 = deterministic_parse_row("Concrete Slab Foundation 12m3", "m3")
    assert res3["semantic_class"] == "FOUNDATION"
    assert res3["quantity_basis"] == "M3"
    assert res3["attributes"]["volume_m3"] == 12.0
    
    res4 = deterministic_parse_row("Decommissioning tech hourly labour rate", "hour")
    assert res4["semantic_class"] == "LABOUR"
    assert res4["commercial_action"] == "REMOVE"
    assert res4["quantity_basis"] == "HOUR"

    # 2. Test database profiling flow
    temp_db_fd, temp_db_path = tempfile.mkstemp(suffix=".db")
    services.db.DB_PATH = temp_db_path
    try:
        init_db()
        add_price_item_to_excel("", code="W12818", name="Feeder - 30m Structure - 7/8 Feeder Cable x 2", unit="each", rate=1250.0, category="Feeders")
        add_price_item_to_excel("", code="W11407", name="Monopole - 30m Tower", unit="each", rate=15000.0, category="Structures")
        
        # Profile DB
        updated = normalize_price_list_to_knowledge_base(1)
        assert updated >= 2
        
        # Verify profiles are saved
        from services.db import get_db_connection
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, row_hash, profile_json FROM price_items WHERE price_list_id = 1")
        items = cursor.fetchall()
        conn.close()
        
        assert len(items) >= 2
        for it in items:
            assert it["row_hash"] != ""
            assert it["profile_json"] != ""
            profile = json.loads(it["profile_json"])
            assert "semantic_class" in profile
            assert "attributes" in profile
            assert "critical_attributes" in profile
            
        # Re-run profiling (should return 0 updated items since hashes match)
        updated_2 = normalize_price_list_to_knowledge_base(1)
        assert updated_2 == 0
        
    finally:
        try:
            os.close(temp_db_fd)
            os.remove(temp_db_path)
        except Exception:
            pass


def test_matcher_gates_and_ontologies():
    import json
    from services.matcher import match_item_to_price_list
    
    # Setup a mock price list with profiles
    price_list = [
        {
            "row_type": "data_item",
            "code": "W12818",
            "name": "Feeder - 30m Structure - 7/8 Feeder Cable x 2",
            "unit": "each",
            "rate": 1250.0,
            "row_idx": 1,
            "profile_json": json.dumps({
                "sor_code": "W12818",
                "semantic_class": "FEEDER",
                "attributes": {"structure_height_m": 30.0, "cable_size": "7/8", "cable_count": 2},
                "critical_attributes": ["structure_height_m", "cable_size", "cable_count"],
                "commercial_action": "INSTALL",
                "compatible_actions": ["INSTALL"],
                "quantity_basis": "EACH",
                "commercial_basis": "BASE"
            })
        },
        {
            "row_type": "data_item",
            "code": "W12819",
            "name": "Feeder - 30m Structure - 7/8 Feeder Cable x 6",
            "unit": "each",
            "rate": 2500.0,
            "row_idx": 2,
            "profile_json": json.dumps({
                "sor_code": "W12819",
                "semantic_class": "FEEDER",
                "attributes": {"structure_height_m": 30.0, "cable_size": "7/8", "cable_count": 6},
                "critical_attributes": ["structure_height_m", "cable_size", "cable_count"],
                "commercial_action": "INSTALL",
                "compatible_actions": ["INSTALL"],
                "quantity_basis": "EACH",
                "commercial_basis": "BASE"
            })
        },
        {
            "row_type": "data_item",
            "code": "R12818",
            "name": "Remove Feeder - 30m Structure - 7/8 Feeder Cable x 2",
            "unit": "each",
            "rate": 300.0,
            "row_idx": 3,
            "profile_json": json.dumps({
                "sor_code": "R12818",
                "semantic_class": "FEEDER",
                "attributes": {"structure_height_m": 30.0, "cable_size": "7/8", "cable_count": 2},
                "critical_attributes": ["structure_height_m", "cable_size", "cable_count"],
                "commercial_action": "REMOVE",
                "compatible_actions": ["REMOVE"],
                "quantity_basis": "EACH",
                "commercial_basis": "BASE"
            })
        }
    ]
    
    # Test cable count constraint gate (matches W12818 vs W12819)
    item_x2 = {
        "equipment_type": "FEEDER",
        "model": "7/8 cable x 2",
        "action": "INSTALL",
        "unit": "each",
        "quantity": 1.0,
        "raw_text": "Install feeder on 30m structure"
    }
    res_x2 = match_item_to_price_list(item_x2, price_list)
    assert res_x2["code"] == "W12818"
    
    item_x6 = {
        "equipment_type": "FEEDER",
        "model": "7/8 cable x 6",
        "action": "INSTALL",
        "unit": "each",
        "quantity": 1.0,
        "raw_text": "Install feeder on 30m structure"
    }
    res_x6 = match_item_to_price_list(item_x6, price_list)
    assert res_x6["code"] == "W12819"
    
    # Test action constraint gate (matches R12818 for REMOVE)
    item_remove = {
        "equipment_type": "FEEDER",
        "model": "7/8 cable x 2",
        "action": "REMOVE",
        "unit": "each",
        "quantity": 1.0,
        "raw_text": "Remove feeder on 30m structure"
    }
    res_remove = match_item_to_price_list(item_remove, price_list)
    assert res_remove["code"] == "R12818"


def test_correction_logging():
    from main import log_correction, CorrectionLogModel
    from services.db import get_db_connection, init_db
    
    init_db()
    
    # 1. Clear db and cache
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM correction_log")
    conn.commit()
    conn.close()
    
    from services.matcher import clear_user_mappings
    clear_user_mappings()
    
    # 2. Call log-correction function directly
    payload = CorrectionLogModel(
        pdf_name="test_drawing.pdf",
        original_description="Hypothetical Anten 3 sector",
        corrected_code="W12345",
        corrected_name="Standard Kathrein Antenna",
        corrected_rate=890.0,
        estimator_username="John Doe"
    )
    
    res = log_correction(payload)
    assert res["status"] == "success"
    
    # 3. Verify in Database
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM correction_log")
    row = cursor.fetchone()
    conn.close()
    
    assert row is not None
    assert row["pdf_name"] == "test_drawing.pdf"
    assert row["original_description"] == "HYPOTHETICAL ANTEN 3 SECTOR"
    assert row["corrected_code"] == "W12345"
    assert row["corrected_name"] == "Standard Kathrein Antenna"
    assert row["corrected_rate"] == 890.0
    assert row["estimator_username"] == "John Doe"
    
    # 4. Verify in cache
    from services.matcher import load_user_mappings
    mappings = load_user_mappings()
    assert "HYPOTHETICAL ANTEN 3 SECTOR" in mappings
    assert mappings["HYPOTHETICAL ANTEN 3 SECTOR"]["code"] == "W12345"








