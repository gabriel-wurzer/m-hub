FROM postgis/postgis:17-3.6-alpine

# Copy initialization scripts into the initdb directory
COPY ./init/*.sql /docker-entrypoint-initdb.d/
