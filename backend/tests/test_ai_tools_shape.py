from pebble.ai.tools import TOOL_DEFINITIONS, TOOL_HANDLERS


def test_every_tool_uses_openai_shape():
    for tool in TOOL_DEFINITIONS:
        assert tool["type"] == "function"
        assert "function" in tool
        fn = tool["function"]
        assert "name" in fn
        assert "description" in fn
        assert "parameters" in fn
        assert fn["parameters"]["type"] == "object"


def test_every_tool_has_a_handler():
    names = {t["function"]["name"] for t in TOOL_DEFINITIONS}
    assert names == set(TOOL_HANDLERS.keys())


def test_no_tool_uses_legacy_input_schema_field():
    for tool in TOOL_DEFINITIONS:
        assert "input_schema" not in tool
        assert "name" not in tool  # name is now nested under function
