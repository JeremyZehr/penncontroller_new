#!/usr/bin/python3

import json
import os
import re
import sys

from shutil import copyfile

input_dir = next((x for n, x in enumerate(sys.argv) if n>0 and sys.argv[n-1]=="-i"), ".")
output_dir = next((x for n, x in enumerate(sys.argv) if n>0 and sys.argv[n-1]=="-o"), "static")

if not os.path.exists(output_dir):
  os.mkdir(output_dir)

CHUNKS_DICT = {}

chunk_dir = os.path.join(input_dir,"chunk_includes")
for file in os.listdir(chunk_dir):
  path = os.path.join(chunk_dir,file)
  f = file.lower()
  if f.endswith(".html") or f.endswith(".htm") or f.endswith(".tsv") or f.endswith(".csv"):
    CHUNKS_DICT[file] = open(path,"r").read()
  else:
    copyfile(path, os.path.join(output_dir,file))

open(os.path.join(output_dir,"chunks.js"), "w").write(f"window.CHUNKS_DICT = {CHUNKS_DICT};")

# copying
js_and_css = {
  'css': {
    'ext': '.css',
    'files': [],
    'format': "<link rel='stylesheet' type='text/css' href='./css_includes/{file}'>"
  },
  'js': {
    'ext': '.js',
    'files': [],
    'format': "<script type='text/javascript' src='./js_includes/{file}'></script>"
  },
  'data': {
    'ext': '.js',
    'files': [],
    'format': "<script type='text/javascript' src='./data_includes/{file}'></script>"
  }
}

for d in js_and_css:
  dirname = f"{d}_includes"
  dirs = {
    'in': os.path.join(input_dir,dirname),
    'out': os.path.join(output_dir,dirname),
  }
  if not os.path.exists(dirs['out']):
    os.mkdir(dirs['out'])
  for file in os.listdir(dirs['in']):
    if not file.lower().endswith(js_and_css[d]['ext']):
      continue
    if d == "css" and not file.lower().startswith("global_"):
      prefix = file.rstrip(".css")
      in_bracket = 0
      css_lines = []
      with open(os.path.join(dirs['out'],file),"w") as css_output:
        with open(os.path.join(dirs['in'],file),"r") as css_code:
          for line in css_code.readlines():
            if in_bracket == 0:
              line = re.sub(r"^([^{]+)", lambda x: re.sub(r"\.",f".{prefix}-", x[0]), line)
            css_output.write(line)
            in_bracket += line.count('{')
            in_bracket -= line.count('}')
            print("file", file, "line", line, "in_bracket", in_bracket)
    else:
      copyfile(os.path.join(dirs['in'],file), os.path.join(dirs['out'],file))
    js_and_css[d]['files'].append(js_and_css[d]['format'].format(file=file))


for jsfile in (
  "jquery.min.js","jquery-ui.min.js","jsDump.js","PluginDetect.js","util.js",
  "shuffle.js","json.js","soundmanager2-jsmin.js","backcompatcruft.js","conf.js"
):
  copyfile(os.path.join(input_dir,'www',jsfile), os.path.join(output_dir,jsfile))

copyfile(os.path.join(input_dir,'other_includes','main.js'), os.path.join(output_dir,'main.js'))


static_js = """
  const get_params = Object.fromEntries(window.location.search.replace(/^\?/,'').split("&").map(v=>v.split('=')));
  const is_static = ("static" in get_params || !window.location.protocol.toLowerCase().match(/^https?:$/));

  window.__server_py_script_name__ = window.__server_py_script_name__ || "/";

  if (window.__counter_value_from_server__ === undefined)
    window.__counter_value_from_server__ = Math.round(1000 * Math.random());
  if ("withsquare" in get_params)
      window.__counter_value_from_server__ = parseInt(get_params.withsquare);

  const oldAjax = $.ajax;
  $.ajax = function(...params) {
      const splitUrl = ((params[0]||Object()).url||"").split("?");
      const localDict = window.CHUNKS_DICT||Object();
      if (splitUrl[1] == "allchunks=1" && (is_static || Object.keys(localDict).length>0))
        return params[0].success.call(this, JSON.stringify(localDict));
      else if (!is_static)
        return oldAjax.apply(this, params);
      else if (params[0].type == "POST") {
        const blob = new Blob([params[0].data], {type: "text/plain"});
        const link = document.createElement("A");
        link.download = "results_"+Date.now()+".bak";
        link.href = URL.createObjectURL(blob);
        document.body.append(link);
        link.click();
      }
      if (params[0].success instanceof Function)
        return params[0].success.call(this);
  }
"""


open(os.path.join(output_dir,"experiment.html"), "w").write(f"""
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv = "Content-Type" content = "text/html; charset=utf-8">

    <!-- JQuery -->
    <script type="text/javascript" src="jquery.min.js"></script>
    <script type="text/javascript" src="jquery-ui.min.js"></script>

    <!-- JSDump debugging utility. -->
    <script type="text/javascript" src="jsDump.js"></script>

    <!-- Script for detecting plugins used to create unique MD5 hash. -->
    <script type="text/javascript" src="PluginDetect.js"></script>

    <!-- General utilities (map, filter, ...) -->
    <script type="text/javascript" src="util.js"></script>
    <!-- Code for executing shuffle sequences. -->
    <script type="text/javascript" src="shuffle.js"></script>
    <!-- JSON serialization code. -->
    <script type="text/javascript" src="json.js"></script>
    <!-- Sound manager. -->
    <script type="text/javascript" src="soundmanager2-jsmin.js"></script>
    <!-- Backwards compatability cruft to ensure that old JS data files work. -->
    <script type="text/javascript" src="backcompatcruft.js"></script>
    <!-- JS includes. -->
    {' '.join(sorted(js_and_css['js']['files']))}
    <!-- Data file JS includes. -->
    {' '.join(sorted(js_and_css['data']['files']))}
    <!-- Set up configuration variables. -->
    <script type="text/javascript" src="conf.js"></script>

    <script type="text/javascript" src="chunks.js"></script>

    <script type="text/javascript" src="/?getcounter=1"></script>

    <script type="text/javascript">
{static_js}
    </script>

    <!-- The main body of JS code. -->
    <script type="text/javascript" src="main.js"></script>

    {' '.join(sorted(js_and_css['css']['files']))}

    <!-- To be reset by JavaScript. -->
    <title>Experiment</title>
    <script type="text/javascript">
    <!--
    document.title = conf_pageTitle;
    -->
    </script>
</head>
<body id="bod">

<script type="text/javascript">
<!--
-->
</script>
<noscript>
<p>You need to have Javascript enabled in order to use this page.</p>
</noscript>
</body>
</html>
""")

