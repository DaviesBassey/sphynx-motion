#!/bin/bash
cd "$(dirname "$0")"
echo "Starting SPHYNX MOTION..."
open http://localhost:4200
python3 -m http.server 4200
