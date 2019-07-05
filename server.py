import http.server
import socketserver
import urllib
import sys
import codecs
from os import curdir
from os.path import join as pjoin

PORT = 8089

class ServerHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        self.send_response(200)        
        self.end_headers()
        length = int(self.headers['Content-Length'])
        read_stuff = self.rfile.read(length)
        store_path = '.\\'+ self.path[1:]
        with open(store_path, 'w') as fh:
                fh.write(read_stuff.decode())

Handler = ServerHandler
httpd = socketserver.TCPServer(("", PORT), Handler)
print("serving at port", PORT)
#httpd.serve_forever()
