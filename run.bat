@echo off
cd /d "%~dp0"
echo Life Organizer em http://localhost:3337
start "" http://localhost:3337
python server.py 3337