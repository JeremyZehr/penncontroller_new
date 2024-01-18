#!/usr/bin/python3

import json
import os

from flask import Flask, Response, request, make_response, send_from_directory

PORT = 3000
PRIVATE_DIRECTORY = "/home/jeremy/"
PUBLIC_DIRECTORY = "/home/jeremy/static_test/"

app = Flask(__name__)

@app.route('/<path:path>', methods=['GET'])
def send_report(path):
    return send_from_directory(PUBLIC_DIRECTORY, path)

@app.route('/', methods=['GET','POST','OPTIONS'])
def server():
  if request.method == "POST":
    data = request.data.decode("utf-8")
    data_json = json.loads(data)
    if data_json[0] is False:
      counter_value = 0
      counter_file = os.path.join(PRIVATE_DIRECTORY,"counter")
      if os.path.exists(counter_file):
        counter_from_file = open(counter_file,"r").read()
        counter_value = int(counter_from_file) if counter_from_file.isdigit() else counter_value
      open(counter_file,"w").write(str(counter_value+1))
    result_file = os.path.join(PRIVATE_DIRECTORY,"results")
    open_mode = "a" if os.path.exists(result_file) else "w"
    open(result_file,open_mode).write(f"{data}\n")

  elif request.method == "GET":
    getcounter = request.args.get("getcounter", None)
    setsquare = request.args.get("setsquare", None)
    counter_file = os.path.join(PRIVATE_DIRECTORY,"counter")
    if setsquare is not None:
      with open(counter_file,"w") as counter:
        counter.write(str(int(setsquare)))
    elif getcounter:
      if not os.path.exists(counter_file):
        open(counter_file,"w").write("0")
      return Response(f"window.__counter_value_from_server__ = {open(counter_file,'r').read()};", mimetype="text/javascript")

  return "Success"


@app.after_request
def after_request(response):
  response.headers["Access-Control-Allow-Origin"] = "*" # <- You can change "*" for a domain for example "http://localhost"
  response.headers["Access-Control-Allow-Credentials"] = "true"
  response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS, PUT, DELETE"
  response.headers["Access-Control-Allow-Headers"] = "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Requested-With"
  return response


app.run(port=PORT)
