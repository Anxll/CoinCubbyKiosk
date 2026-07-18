#!/bin/bash

PROCESS="python"

if pgrep -x "$PROCESS" > /dev/null
then
  echo "Server already running. Halting execution"
  exit 0
fi

cd /home/coincubby/CoinCubbyKiosk
source venv/bin/activate
venv/bin/python -u run.py > /var/log/coincubby.log 2>&1
