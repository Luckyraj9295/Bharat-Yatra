FROM nginx:alpine

# Copy ALL frontend files (this is the key fix)
COPY . /usr/share/nginx/html

# Copy nginx proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80