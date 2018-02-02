#!/usr/bin/bash

docker run -it --rm mariadb mysqldump\
  --host=$SEQUELIZE_HOST --user=$SEQUELIZE_USERNAME --password=$SEQUELIZE_PASSWORD\
  backoffice > tmp/backoffice.sql\
&&\
docker run -i --rm mariadb mysql\
  --host=$SEQUELIZE_HOST --user=$SEQUELIZE_USERNAME --password=$SEQUELIZE_PASSWORD\
  backoffice-staging < tmp/backoffice.sql\
