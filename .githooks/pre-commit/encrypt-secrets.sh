#!/bin/bash

travis encrypt-file .env-cmdrc.js --force \
  && git add .env-cmdrc.js.enc;
