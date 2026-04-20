FROM postgis/postgis:17-3.6-alpine

# Copy initialization scripts into the initdb directory.
# --chmod=0644 guarantees the 'postgres' user can read them regardless of
# whatever mode the files happen to have on the host.
COPY --chmod=0644 ./init/*.sql /docker-entrypoint-initdb.d/
