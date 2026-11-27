@echo off 
start "" "http://localhost:8000/treinamento/sim.html" 
python -m http.server 8000
