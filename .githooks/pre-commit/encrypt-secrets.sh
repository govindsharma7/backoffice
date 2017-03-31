#!/bin/bash

travis encrypt-file .env-cmdrc --force \
  && git add .env-cmdrc.enc;
