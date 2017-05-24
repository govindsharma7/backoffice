#!/bin/bash

travis encrypt-file .env.js --force \
  && git add .env.js.enc;
