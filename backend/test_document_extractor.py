import pytest
from concurrent.futures import ThreadPoolExecutor as RealThreadPoolExecutor
from unittest.mock import patch, MagicMock
from core.document_extractor import (
    extract_document_elements,
    is_extraction_suspiciously_incomplete,
    get_bbox_overlap_iou,
    merge_and_deduplicate_elements
)

@pytest.fixture
def mock_pdf_env():
    # Mock PyMuPDF fitz.open and its page rendering
    mock_doc = MagicMock()
    mock_page = MagicMock()
    mock_page.rect.width = 842.0
    mock_page.rect.height = 595.0
    mock_page.get_text.return_value = "Page 1 raw text layer containing substantial engineering drawings details"
    mock_pix = MagicMock()
    mock_pix.tobytes.return_value = b"fake_image_bytes"
    mock_page.get_pixmap.return_value = mock_pix
    
    mock_doc.__len__.return_value = 1
    mock_doc.__getitem__.return_value = mock_page
    
    with patch("os.path.exists", return_value=True):
        with patch("fitz.open", return_value=mock_doc) as mock_open:
            with patch("core.document_extractor.send_gemini_request", return_value={"candidates": [{"content": {"parts": [{"text": '{"completely_missing_keys": [], "partially_captured_keys": []}'}]}}]}):
                yield mock_open

# 1. Dense engineering drawing
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_dense_engineering_drawing(mock_gemini, mock_pdf_env):
    mock_gemini.return_value = ([
        {"type": "unstructured", "content": "RACK 1 DETAIL", "bbox": [100, 100, 150, 200], "confidence": 0.9},
        {"type": "unstructured", "content": "RACK 2 DETAIL", "bbox": [200, 200, 250, 300], "confidence": 0.9},
        {"type": "unstructured", "content": "FEERDER CABLE TO RBS", "bbox": [300, 300, 350, 400], "confidence": 0.95},
        {"type": "unstructured", "content": "ANTENNA A1 MOUNTING", "bbox": [400, 400, 450, 500], "confidence": 0.92},
        {"type": "unstructured", "content": "EARTH BAR DETAILS", "bbox": [500, 500, 550, 600], "confidence": 0.94}
    ], {"model": "gemini-3.1-flash-lite", "status": "Success"})

    res = extract_document_elements("dummy.pdf")
    assert len(res["elements"]) == 5
    assert res["elements"][0]["content"] == "RACK 1 DETAIL"

# 2. Small text around a drawing
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_small_text_around_drawing(mock_gemini, mock_pdf_env):
    small_text = "NOTE: verify on-site before drilling."
    mock_gemini.return_value = ([
        {"type": "unstructured", "content": small_text, "bbox": [10, 10, 20, 100], "confidence": 0.99}
    ], {})

    res = extract_document_elements("dummy.pdf")
    assert len(res["elements"]) == 1
    assert res["elements"][0]["content"] == small_text

# 3. Multiple callouts on one page
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_multiple_callouts(mock_gemini, mock_pdf_env):
    mock_gemini.return_value = ([
        {"type": "unstructured", "content": "CALLOUT 1", "bbox": [50, 50, 70, 100], "confidence": 0.9},
        {"type": "unstructured", "content": "CALLOUT 2", "bbox": [150, 150, 170, 200], "confidence": 0.91}
    ], {})

    res = extract_document_elements("dummy.pdf")
    assert len(res["elements"]) == 2

# 4. Equipment labels outside tables
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_equipment_labels_outside_tables(mock_gemini, mock_pdf_env):
    mock_gemini.return_value = ([
        {"type": "unstructured", "content": "RBS6102 CABINET", "bbox": [400, 100, 420, 250], "confidence": 0.93}
    ], {})

    res = extract_document_elements("dummy.pdf")
    assert len(res["elements"]) == 1
    assert res["elements"][0]["content"] == "RBS6102 CABINET"

# 5. Cable/feeder descriptions
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_cable_feeder_descriptions(mock_gemini, mock_pdf_env):
    cable_text = "2x Eupen 7/8\" hybrid cables running along ladder"
    mock_gemini.return_value = ([
        {"type": "unstructured", "content": cable_text, "bbox": [600, 200, 620, 450], "confidence": 0.96}
    ], {})

    res = extract_document_elements("dummy.pdf")
    assert len(res["elements"]) == 1
    assert res["elements"][0]["content"] == cable_text

# 6. Elevation and dimension annotations
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_elevation_dimension_annotations(mock_gemini, mock_pdf_env):
    elevation_text = "E.L. 25.40m AHD"
    mock_gemini.return_value = ([
        {"type": "unstructured", "content": elevation_text, "bbox": [800, 50, 810, 120], "confidence": 0.94}
    ], {})

    res = extract_document_elements("dummy.pdf")
    assert len(res["elements"]) == 1
    assert res["elements"][0]["content"] == elevation_text

# 7. Title-block information
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_title_block_information(mock_gemini, mock_pdf_env):
    mock_gemini.return_value = ([
        {
            "type": "structured",
            "title": "Title Block Metadata",
            "content": {
                "fields": {
                    "Drawing Number": "S1-123456",
                    "Sheet": "1 of 3",
                    "Client": "Telstra"
                }
            },
            "bbox": [900, 800, 1000, 1000],
            "confidence": 0.99
        }
    ], {})

    res = extract_document_elements("dummy.pdf")
    assert len(res["elements"]) == 1
    assert res["elements"][0]["type"] == "structured"
    assert res["elements"][0]["content"]["fields"]["Drawing Number"] == "S1-123456"

# 8. Repeated identical information in different locations
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_repeated_information_different_locations(mock_gemini, mock_pdf_env):
    # Two identical notes in different parts of the drawing should be kept.
    mock_gemini.return_value = ([
        {"type": "unstructured", "content": "GPS ANTENNA", "bbox": [100, 100, 120, 180], "confidence": 0.95},
        {"type": "unstructured", "content": "GPS ANTENNA", "bbox": [800, 800, 820, 880], "confidence": 0.94}
    ], {})

    res = extract_document_elements("dummy.pdf")
    assert len(res["elements"]) == 2

# 9. Scanned PDF with no text layer
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_scanned_pdf_no_text_layer(mock_gemini):
    mock_doc = MagicMock()
    mock_page = MagicMock()
    mock_page.rect.width = 842.0
    mock_page.rect.height = 595.0
    mock_page.get_text.return_value = "" # Empty native text layer
    mock_pix = MagicMock()
    mock_pix.tobytes.return_value = b"bytes"
    mock_page.get_pixmap.return_value = mock_pix
    
    mock_doc.__len__.return_value = 1
    mock_doc.__getitem__.return_value = mock_page

    mock_gemini.return_value = ([
        {"type": "unstructured", "content": "SCANNED DRAWING NOTE 1", "bbox": [200, 200, 220, 400]},
        {"type": "unstructured", "content": "SCANNED DRAWING NOTE 2", "bbox": [300, 200, 320, 400]},
        {"type": "unstructured", "content": "SCANNED DRAWING NOTE 3", "bbox": [400, 200, 420, 400]}
    ], {})

    with patch("os.path.exists", return_value=True):
        with patch("fitz.open", return_value=mock_doc):
            res = extract_document_elements("scanned.pdf")

    assert len(res["elements"]) == 3
    assert res["elements"][0]["content"] == "SCANNED DRAWING NOTE 1"

# 10. High-resolution extraction
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_high_resolution_extraction(mock_gemini):
    mock_doc = MagicMock()
    mock_page = MagicMock()
    mock_page.rect.width = 842.0
    mock_page.rect.height = 595.0
    mock_page.get_text.return_value = "Drawing notes"
    mock_pix = MagicMock()
    mock_pix.tobytes.return_value = b"bytes"
    mock_page.get_pixmap.return_value = mock_pix
    
    mock_doc.__len__.return_value = 1
    mock_doc.__getitem__.return_value = mock_page
    mock_gemini.return_value = ([], {})

    with patch("os.path.exists", return_value=True):
        with patch("fitz.open", return_value=mock_doc):
            extract_document_elements("dummy.pdf")
            
    # Verify page rendering default DPI is 150
    assert mock_page.get_pixmap.call_args_list[0][1].get('dpi') == 150



# 13. Preservation of original text
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_preservation_of_original_text(mock_gemini, mock_pdf_env):
    original_text = "   Ø100 hybrid feeder cable (recovered/reused) - RL +12.5m   "
    mock_gemini.return_value = ([
        {"type": "unstructured", "content": original_text}
    ], {})

    res = extract_document_elements("dummy.pdf")
    assert res["elements"][0]["content"] == original_text

# 14. No summarization
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_no_summarization(mock_gemini, mock_pdf_env):
    detailed_annotation = "EXISTING TELSTRA RBS6102 ODU TO ACCOMMODATE PROPOSED EQUIPMENT. REFER SHEET E1-1"
    mock_gemini.return_value = ([
        {"type": "unstructured", "content": detailed_annotation}
    ], {})

    res = extract_document_elements("dummy.pdf")
    assert res["elements"][0]["content"] == detailed_annotation

# 15. No filtering based on perceived importance
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_no_filtering_on_importance(mock_gemini, mock_pdf_env):
    mock_gemini.return_value = ([
        {"type": "unstructured", "content": "Minor boundary marker #13", "bbox": [5, 5, 10, 20]}
    ], {})

    res = extract_document_elements("dummy.pdf")
    assert len(res["elements"]) == 1
    assert res["elements"][0]["content"] == "Minor boundary marker #13"

# 16. Mixed structured and unstructured layout
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_mixed_layout(mock_gemini, mock_pdf_env):
    mock_gemini.return_value = ([
        {"type": "structured", "title": "Table A", "content": {"headers": ["H1"], "rows": [["R1"]]}},
        {"type": "unstructured", "content": "Note B"}
    ], {})

    res = extract_document_elements("dummy.pdf")
    assert len(res["elements"]) == 2
    assert res["elements"][0]["type"] == "structured"
    assert res["elements"][1]["type"] == "unstructured"

# 18. Multi-page document completeness
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_multipage_completeness(mock_gemini):
    mock_doc = MagicMock()
    mock_doc.__len__.return_value = 2
    
    mock_page_1 = MagicMock()
    mock_page_1.rect.width = 800.0
    mock_page_1.rect.height = 600.0
    mock_page_1.get_text.return_value = "Page 1 notes"
    
    mock_page_2 = MagicMock()
    mock_page_2.rect.width = 800.0
    mock_page_2.rect.height = 600.0
    mock_page_2.get_text.return_value = "Page 2 notes"
    
    mock_pix = MagicMock()
    mock_pix.tobytes.return_value = b"fake"
    mock_page_1.get_pixmap.return_value = mock_pix
    mock_page_2.get_pixmap.return_value = mock_pix
    
    mock_doc.__getitem__.side_effect = lambda idx: mock_page_1 if idx == 0 else mock_page_2

    def gemini_side_effect(img, text, prompt, key, *args, **kwargs):
        if "Page 1" in text or "page 1" in text.lower():
            return ([{"type": "unstructured", "content": "P1 Note"}], {})
        else:
            return ([{"type": "unstructured", "content": "P2 Note"}], {})
            
    mock_gemini.side_effect = gemini_side_effect

    with patch("os.path.exists", return_value=True):
        with patch("fitz.open", return_value=mock_doc):
            with patch("core.document_extractor.send_gemini_request", return_value={"candidates": [{"content": {"parts": [{"text": '{"completely_missing_keys": [], "partially_captured_keys": []}'}]}}]}):
                res = extract_document_elements("multipage.pdf")

    assert len(res["elements"]) == 2
    assert res["elements"][0]["page"] == 1
    assert res["elements"][0]["content"] == "P1 Note"
    assert res["elements"][1]["page"] == 2
    assert res["elements"][1]["content"] == "P2 Note"

# Test validation checker logic
def test_completeness_validation_signals():
    mock_page = MagicMock()
    mock_page.rect.width = 800.0
    mock_page.rect.height = 600.0
    
    # Set mock quadrant get_text return values
    def get_text_side_effect(mode, clip=None):
        if clip:
            # Let's say top-left quadrant has text, but others are empty
            if clip.x0 == 0 and clip.y0 == 0:
                return "word " * 20
        return ""
    mock_page.get_text.side_effect = get_text_side_effect

    # Quadrant Top-Left has substantial text but elements list has 0 elements inside Top-Left
    elements = [
        {"type": "unstructured", "content": "Notes bottom right", "bbox": [500, 500, 600, 600], "confidence": 0.99}
    ]
    
    assert is_extraction_suspiciously_incomplete(elements, "word " * 20, mock_page) is True

# Test structured elements authority merge rule
def test_structured_elements_authority_merge():
    # If the global pass contains a structured element (table A), and the tiled pass returns an overlapping structured table,
    # it must be discarded to prevent table fragmentation.
    existing = [
        {"type": "structured", "content": {"headers": ["Item"], "rows": [["1"]]}, "bbox": [100, 100, 300, 300]}
    ]
    new_tiled = [
        # Overlapping structured table (should be discarded)
        {"type": "structured", "content": {"headers": ["Item"], "rows": [["1"]]}, "bbox": [150, 150, 250, 250]},
        # Non-overlapping structured table (should be merged)
        {"type": "structured", "content": {"headers": ["Qty"], "rows": [["2"]]}, "bbox": [500, 500, 700, 700]}
    ]
    
    merged = merge_and_deduplicate_elements(existing, new_tiled)
    assert len(merged) == 2
    assert merged[1]["content"]["headers"] == ["Qty"]

@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_document_extractor_visual_path(mock_gemini, mock_pdf_env):
    mock_gemini.return_value = ([
        {"type": "unstructured", "content": "VISUAL CONTENT", "bbox": [100, 100, 150, 200], "confidence": 0.98}
    ], {})

    res = extract_document_elements("dummy.pdf")
    
    assert mock_gemini.called
    assert len(res["elements"]) == 1
    assert res["elements"][0]["content"] == "VISUAL CONTENT"

@patch("core.document_extractor.get_prompt_by_name")
@patch("core.document_extractor.run_gemini_vision_document_extractor")
def test_client_specific_instructions_appended(mock_gemini, mock_get_prompt, mock_pdf_env):
    mock_gemini.return_value = ([], {})
    
    def get_prompt_side_effect(name, fallback):
        if name == "unified_extractor":
            return "UNIVERSAL RULES"
        elif name == "additional_extraction_instructions":
            return "TELSTRA SPECIAL RULES"
        return fallback
    
    mock_get_prompt.side_effect = get_prompt_side_effect
    
    extract_document_elements("dummy.pdf")
    
    # Check that mock_gemini was called with a prompt containing BOTH parts
    args, kwargs = mock_gemini.call_args
    sent_prompt = args[2]
    assert "UNIVERSAL RULES" in sent_prompt
    assert "ADDITIONAL CLIENT-SPECIFIC INSTRUCTIONS:" in sent_prompt
    assert "TELSTRA SPECIAL RULES" in sent_prompt



# 21. Coordinate mapping and overlap tests
def test_coordinate_mapping_and_overlap():
    from core.document_extractor import map_global_to_local_bbox, is_bbox_overlapping_rect
    
    # Test is_bbox_overlapping_rect
    # bbox: [xmin, ymin, xmax, ymax]
    # rect: [xmin_crop, ymin_crop, xmax_crop, ymax_crop]
    assert is_bbox_overlapping_rect([10.0, 10.0, 50.0, 50.0], (0.0, 0.0, 100.0, 100.0)) is True
    assert is_bbox_overlapping_rect([150.0, 150.0, 200.0, 200.0], (0.0, 0.0, 100.0, 100.0)) is False

    # Test map_global_to_local_bbox
    crop_coords = (100.0, 100.0, 300.0, 300.0)
    global_bbox = [150.0, 150.0, 250.0, 250.0]
    # expected local: xmin = 250, ymin = 250, xmax = 750, ymax = 750 (scaled to 1000)
    # output order is [ymin, xmin, ymax, xmax]
    local_bbox = map_global_to_local_bbox(global_bbox, crop_coords)
    assert local_bbox == [250.0, 250.0, 750.0, 750.0]



# 23. Test spatial-only and block-id-only deduplication in merge
def test_spatial_and_block_id_deduplication():
    from core.document_extractor import merge_and_deduplicate_elements
    
    existing = [
        {"type": "unstructured", "bbox": [10.0, 10.0, 50.0, 50.0], "block_ids": ["B0", "B1"], "content": "Note 1"}
    ]
    
    # Case 1: Same block_ids but different bbox and text -> duplicate
    new_el1 = {"type": "unstructured", "bbox": [100.0, 100.0, 150.0, 150.0], "block_ids": ["B1"], "content": "Note 1 modified"}
    res1 = merge_and_deduplicate_elements(existing, [new_el1])
    assert len(res1) == 1  # Not added because B1 is shared
    
    # Case 2: Same spatial area (IoU > 0.40) but different block_ids and text -> duplicate
    new_el2 = {"type": "unstructured", "bbox": [12.0, 12.0, 48.0, 48.0], "block_ids": ["B2"], "content": "Note 2"}
    res2 = merge_and_deduplicate_elements(existing, [new_el2])
    assert len(res2) == 1  # Not added because they overlap spatially
    
    # Case 3: Completely separate element -> added
    new_el3 = {"type": "unstructured", "bbox": [200.0, 200.0, 250.0, 250.0], "block_ids": ["B2"], "content": "Note 3"}
    res3 = merge_and_deduplicate_elements(existing, [new_el3])
    assert len(res3) == 2  # Added successfully

# 24. Test render_page_to_jpeg_safe quality/DPI fallback loop
def test_render_page_to_jpeg_safe():
    from core.document_extractor import render_page_to_jpeg_safe
    from unittest.mock import MagicMock
    
    mock_page = MagicMock()
    mock_pix = MagicMock()
    mock_page.get_pixmap.return_value = mock_pix
    
    # First attempt: returns 2MB (exceeds 1MB)
    # Second attempt (quality 70): returns 500KB (passes)
    sizes = [2 * 1024 * 1024, 500 * 1024]
    call_idx = 0
    
    def mock_tobytes(fmt, jpg_quality=85):
        nonlocal call_idx
        sz = sizes[call_idx]
        call_idx += 1
        return b"A" * sz
        
    mock_pix.tobytes = mock_tobytes
    
    img_b64, mime = render_page_to_jpeg_safe(mock_page, 150)
    assert mime == "image/jpeg"
    # Should have run 2 times (first attempt: 2MB, second: 500KB)
    assert call_idx == 2

# 25. Test snapped coordinate without unstructured content override
def test_snapped_coordinate_and_verbatim_text_resolution():
    from core.document_extractor import parse_and_scale_ai_elements
    from unittest.mock import MagicMock
    
    mock_page = MagicMock()
    mock_page.rect.width = 800.0
    mock_page.rect.height = 600.0
    
    complete_blocks = [
        {"id": "B0", "text": "LINE 1 OF ANNOTATION", "bbox": [10.0, 20.0, 100.0, 40.0]},
        {"id": "B1", "text": "LINE 2 OF ANNOTATION", "bbox": [10.0, 45.0, 100.0, 65.0]}
    ]
    
    ai_elements = [
        # Bbox is snapped to block union, but content is preserved verbatim (no override)
        {
            "type": "unstructured",
            "title": "Test Annotation",
            "content": "AI-authored content",
            "bbox": None,
            "block_ids": ["B0", "B1"]
        }
    ]
    
    res = parse_and_scale_ai_elements(
        ai_elements, 
        page_num=1, 
        fitz_page=mock_page, 
        complete_canonical_blocks=complete_blocks
    )
    
    assert len(res) == 1
    assert res[0]["block_ids"] == ["B0", "B1"]
    assert res[0]["bbox"] == [10.0, 20.0, 100.0, 65.0]
    # AI-authored content must be preserved verbatim (Step 6)
    assert res[0]["content"] == "AI-authored content"
    assert res[0]["is_reconciled"] is True
