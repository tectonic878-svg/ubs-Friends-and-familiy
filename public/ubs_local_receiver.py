#!/usr/bin/env python3
"""
UBS - Friends & Family Chegirma Tizimi
Admin shaxsiy kompyuteriga arizachilarning asl PDF hujjatlarini qabul qilish serveri.
Hech qanday qo'shimcha kutubxona talab qilmaydi (Faqat standart Python 3).

Ishga tushirish:
    python ubs_local_receiver.py
"""

import os
import sys
import json
import base64
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

PORT = 8080
SAVE_DIR = os.path.abspath("UBS_Qabul_Qilingan_Hujjatlar")
os.makedirs(SAVE_DIR, exist_ok=True)

class UBSReceiverHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Document-Id, X-Document-Name, X-Document-Size")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health" or self.path == "/api/health":
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = {
                "status": "ok",
                "message": "UBS Local Server faol ishlab turibdi",
                "save_dir": SAVE_DIR,
                "time": datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))
            return

        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        html = f"""
        <html>
        <head><title>UBS Local Receiver</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #16a34a;">✅ UBS Shaxsiy Serveri Faol!</h1>
            <p>Arizachilarning barcha asl PDF hujjatlari quyidagi papkaga kelib tushadi:</p>
            <p><code style="background: #f1f5f9; padding: 6px 12px; border-radius: 6px;">{SAVE_DIR}</code></p>
        </body>
        </html>
        """
        self.wfile.write(html.encode("utf-8"))

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # 1. Binary PDF upload
        if "/upload" in self.path or "/receive-document" in self.path:
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)

            raw_name = params.get("name", ["hujjat.pdf"])[0]
            filename = urllib.parse.unquote(self.headers.get("X-Document-Name", raw_name))
            if not filename.lower().endswith(".pdf"):
                filename += ".pdf"

            file_path = os.path.join(SAVE_DIR, filename)

            # Check if JSON with base64 or direct binary bytes
            content_type = self.headers.get("Content-Type", "")
            if "application/json" in content_type:
                try:
                    payload = json.loads(body.decode("utf-8"))
                    data_url = payload.get("dataUrl", "")
                    filename = payload.get("name", filename)
                    if not filename.lower().endswith(".pdf"):
                        filename += ".pdf"
                    file_path = os.path.join(SAVE_DIR, filename)

                    if "," in data_url:
                        data_url = data_url.split(",")[1]
                    file_bytes = base64.b64decode(data_url)
                    with open(file_path, "wb") as f:
                        f.write(file_bytes)
                except Exception as e:
                    self.send_response(400)
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                    return
            else:
                with open(file_path, "wb") as f:
                    f.write(body)

            size_mb = os.path.getsize(file_path) / (1024 * 1024)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 📥 YANGI HUJJAT SAQLANDI: {filename} ({size_mb:.2f} MB)")
            print(f"    Manzil: {file_path}")

            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "filename": filename,
                "saved_to": file_path
            }, ensure_ascii=False).encode("utf-8"))
            return

        self.send_response(404)
        self._send_cors_headers()
        self.end_headers()

def run():
    server = HTTPServer(("0.0.0.0", PORT), UBSReceiverHandler)
    print("=" * 65)
    print("  UBS - Shaxsiy Kompyuter Serveri Ishga Tushdi!")
    print(f"  Port: {PORT}")
    print(f"  Fayllar saqlanadigan papka: {SAVE_DIR}")
    print(f"  Admin panelida ko'rsatiladigan URL: http://localhost:{PORT}")
    print("=" * 65)
    print("Arizachilarning hujjatlari kutilmoqda...\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer to'xtatildi.")
        sys.exit(0)

if __name__ == "__main__":
    run()
