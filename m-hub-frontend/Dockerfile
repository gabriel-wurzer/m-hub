FROM lipanski/docker-static-website:latest

# Copy the built Angular app
COPY dist/m-hub-frontend/browser /home/static

# Copy httpd.conf as the main config
COPY httpd.conf /etc/httpd.conf

# Expose port (for consistency, matches docker-compose)
EXPOSE 8080

CMD ["/busybox-httpd", "-f", "-v", "-p", "8080"]
