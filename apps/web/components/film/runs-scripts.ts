// What each benchmark task's terminal tile scrolls: the first tool calls both agents made and the catch Little
// Brother blocked with, copied from that task's run streams (apps/evals/results/*/runs/*/<agent>.stream.jsonl).
// A hit shows the conflict the task plants; a mislabel shows the duplicate it was wrongly called instead.

export type ScriptLine = [who: 0 | 1, tool: string, arg: string];
export type Script = {
  suite: "STALE-bench" | "CooperBench";
  agents: [string, string];
  lines: ScriptLine[];
  conflict?: string;
  duplicate?: string;
};

const STALE: [string, string] = ["noah", "ash"];
const COOPER: [string, string] = ["leo", "priya"];
const stale = (lines: ScriptLine[], conflict?: string, duplicate?: string): Script => ({
  suite: "STALE-bench",
  agents: STALE,
  lines,
  conflict,
  duplicate,
});
const cooper = (lines: ScriptLine[], conflict?: string, duplicate?: string): Script => ({
  suite: "CooperBench",
  agents: COOPER,
  lines,
  conflict,
  duplicate,
});

// biome-ignore format: tabular transcript data
export const SCRIPTS: Record<string, Script> = {
  base36_to_int__rename: stale([
    [0, "Grep", "base36_to_int"], [1, "Bash", "git status --short && grep -n \"base36\" django/utils/http.py"],
    [0, "Read", "django/utils/http.py"], [1, "Read", "django/utils/http.py"], [0, "Edit", "django/utils/http.py"],
    [0, "Edit", "django/contrib/auth/tokens.py"], [1, "Edit", "django/utils/http.py"],
    [1, "Bash", "python tests/runtests.py utils_tests.test_http"],
  ], "base36_to_int is renamed on one side but referenced on the other"),
  capfirst__rename: stale([
    [0, "Grep", "\\bcapfirst\\b"], [1, "Grep", "def capfirst|capfirst|^import|^from"], [0, "Read", "django/utils/text.py"],
    [1, "Read", "django/utils/text.py"], [0, "Bash", "perl -pi -e 's/\\bcapfirst\\b/capitalize_first/g' django/utils/text.py"],
    [0, "Edit", "django/utils/text.py"], [1, "Edit", "django/utils/text.py"],
  ], "capfirst is renamed on one side but referenced on the other"),
  slugify__signature: stale([
    [0, "Grep", "slugify\\("], [1, "Grep", "def slugify|^import|^from|^def |^class"], [0, "Read", "django/utils/text.py"],
    [1, "Read", "django/utils/text.py"], [0, "Read", "django/template/defaultfilters.py"],
    [1, "Edit", "django/utils/text.py"], [1, "Bash", "python tests/runtests.py utils_tests.test_text"],
  ]),
  urlencode__rettype: stale([
    [0, "Grep", "urlencode"], [1, "Grep", "urlencode|^import|^from|^def |__all__"], [0, "Read", "django/utils/http.py"],
    [1, "Read", "django/utils/http.py"], [0, "Read", "django/test/client.py"], [0, "Edit", "django/utils/http.py"],
    [1, "Edit", "django/utils/http.py"],
  ], undefined, "django/utils/http.py is already being created"),
  strip_tags__signature: stale([
    [0, "Grep", "strip_tags"], [1, "Read", "django/utils/html.py"], [0, "Read", "django/utils/html.py"],
    [1, "Grep", "def strip_tags|strip_tags\\("], [0, "Edit", "django/utils/html.py"],
    [0, "Edit", "django/template/defaultfilters.py"], [1, "Edit", "django/utils/html.py"],
    [1, "Bash", "python tests/runtests.py utils_tests.test_html"],
  ], "signature of strip_tags changes on one side while the other calls it"),
  get_valid_filename__rettype: stale([
    [0, "Grep", "get_valid_filename"], [1, "Bash", "git status --short && grep -n \"get_valid_filename\" -A 22"],
    [0, "Read", "django/utils/text.py"], [0, "Read", "django/core/files/storage/base.py"],
    [0, "Edit", "django/utils/text.py"], [1, "Edit", "django/utils/text.py"],
    [1, "Bash", "python tests/runtests.py utils_tests.test_text"],
  ], undefined, "django/utils/text.py is already being created"),
  "pallets_jinja_task/1621/5+8": cooper([
    [0, "Grep", "def __init__|def get_source|class FileSystemLoader"], [1, "Grep", "def list_templates|^class |^import"],
    [0, "Read", "src/jinja2/loaders.py"], [1, "Read", "src/jinja2/loaders.py"], [0, "Edit", "src/jinja2/loaders.py"],
    [1, "Edit", "src/jinja2/loaders.py"],
  ], "both edit src/jinja2/loaders.py lines 222-235 vs 231-231"),
  "pallets_jinja_task/1621/2+10": cooper([
    [0, "Grep", "split_template_path\\("], [1, "Bash", "grep -n \"class \\|def get_source\\|def load\" src/jinja2/loaders.py"],
    [0, "Edit", "src/jinja2/loaders.py"], [1, "Bash", "sed -n 1,12p src/jinja2/loaders.py"],
    [0, "Bash", "python -m pytest tests/test_loader.py -q"], [1, "Edit", "src/jinja2/loaders.py"],
  ]),
  "pallets_jinja_task/1559/6+10": cooper([
    [0, "Grep", "def __init__|environment.extend|i18n_cache|^import"], [1, "Grep", "class InternationalizationExtension"],
    [0, "Read", "src/jinja2/ext.py"], [1, "Read", "src/jinja2/ext.py"], [0, "Edit", "src/jinja2/ext.py"],
    [1, "Edit", "src/jinja2/ext.py"], [1, "Bash", "python -m pytest tests/test_ext.py -q"],
  ], undefined, "src/jinja2/ext.py is already being created"),
  "samuelcolvin_dirty_equals_task/43/1+2": cooper([
    [0, "Grep", "^import|^from|^class IsUUID|Omit"], [1, "Grep", "class IsUUID|^import|^from"],
    [0, "Read", "dirty_equals/_other.py"], [1, "Read", "dirty_equals/_other.py"], [0, "Edit", "dirty_equals/_other.py"],
    [1, "Edit", "dirty_equals/_other.py"],
  ], "both edit dirty_equals/_other.py lines 2-2 vs 2-4", "dirty_equals/_other.py is already being created"),
  "pallets_click_task/2800/2+6": cooper([
    [0, "Grep", "def make_context|Context\\(|def close"], [1, "Grep", "^import|^from|def __init__"],
    [0, "Grep", "make_context|Context\\("], [1, "Read", "src/click/core.py"], [0, "Bash", "cd src/click; sed -n 255,300p core.py"],
    [1, "Edit", "src/click/core.py"], [1, "Read", "src/click/shell_completion.py"],
  ]),
};
