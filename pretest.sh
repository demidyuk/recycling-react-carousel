#!/bin/bash
if ! [ -f test-config/setupPointerEvent.js ]; then
  curl -o test-config/setupPointerEvent.js "https://raw.githubusercontent.com/pmndrs/react-use-gesture/a7e8ef444779fd4faafa37a6a218e319f91af9e5/setupPointerEvent.js"
fi
