# Setting up the TxStreet servers

These instructions are meant for DigitalOcean, but you can use the same steps with some modifications for other cloud providers.

## Setup

1. Create a dedicated droplet on DigitalOcean to run the servers for the api and websocket. It is also possible to run these in a kubernetes cluster, but for now we will keep things simple.
- Use the same region and datacenter as your other droplets and databases.
- Ubuntu 23.04.
- Use any specs you like, but it should be at least 2 CPU cores and 4GB Ram.
- Add your SSH key if you wish.
- Add the tag 'processor'.
- Click create droplet.

2. Install processor and dependencies.
- Repeat step 2 from [Setting up the TxStreet backend processors](./Processor.md)
- `cd /root/processor`
- `nano .env`
- Paste the following lines at the bottom and save:
```
API_PORT=8080
WEBSOCKET_PORT=8081
```

3. Clone the wiki
- Repeat step 3 from [Setting up the TxStreet backend processors](./Processor.md)

4. Create pm2 processes.
- `cd /root/processor`
- `pm2 start "node ./dist/entry/websocket-server" --name "Websocket Server"`
- `pm2 start "node ./dist/entry/api" --name "REST API"`
- `pm2 save`
- `pm2 startup`
- Make sure the ports `8080` and `8081` are not being blocked by a firewall (unless using nginx in the next step, in which case don't block `443` and `80`).
- In the advanced setup, you can setup a kubernetes cluster and load balancer to run multiple instances of these processes, scale horizontally and serve more users.
- In the frontend .env file, you can now set these variables (replacing 0.0.0.0 with your droplet IP):
`VUE_APP_REST_API=http://0.0.0.0:8080`
`VUE_APP_WS_SERVER=http://0.0.0.0:8081`


5. (Optional) Domain name with NGINX proxy. If you want to use a domain name with the api to have the url look like http://api.yourdomain.com instead of http://0.0.0.0:8080, follow these next steps. Otherwise, you are done.
- `apt install nginx`
- `cd /etc/nginx/sites-enabled`
- `nano api.yourdomain.com` (replace yourdomain.com with your domain)
- Paste the following and save:
```server {
   listen 443 ssl;
   listen [::]:443 ssl;
   #include snippets/self-signed.conf;
   #include snippets/ssl-params.conf;

   listen 80;
   listen [::]:80;
   server_name api.yourdomain.com;


   location / {
        proxy_pass http://localhost:8080;

        proxy_set_header        Host $host;
        proxy_set_header        X-Real-IP $remote_addr;
        proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header        X-Forwarded-Proto $scheme;
        proxy_set_header        Upgrade $http_upgrade;
        proxy_set_header        Connection "upgrade";
        proxy_redirect          off;
        proxy_http_version      1.1;
   }
}
```
- `nano socket.yourdomain.com` (replace yourdomain.com with your domain)
- Paste the following and save:
```
server {
   listen 443 ssl;
   listen [::]:443 ssl;
   #include snippets/self-signed.conf;
   #include snippets/ssl-params.conf;

   listen 80;
   listen [::]:80;
   server_name socket.yourdomain.com;


   location / {
        proxy_pass http://localhost:8081;

        proxy_set_header        Host $host;
        proxy_set_header        X-Real-IP $remote_addr;
        proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header        X-Forwarded-Proto $scheme;
        proxy_set_header        Upgrade $http_upgrade;
        proxy_set_header        Connection "Upgrade";
        proxy_redirect          off;
        proxy_http_version      1.1;
   }
}
```
- `systemctl restart nginx`
- In your DNS records, create an A record for both subdomains `api` and `socket` pointing to the IP address of this droplet.

6. (Optional) Add a self-signed SSL cert to NGINX. This is useful if you are using a cloudflare proxy and need SSL for the websockets. Otherwise a self-signed cert will give you errors if connecting directly.
- `sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/nginx-selfsigned.key -out /etc/ssl/certs/nginx-selfsigned.crt`
- `sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048`
- `nano /etc/nginx/snippets/self-signed.conf`
- Paste the following and save:
```
ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;
ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;
```
- Uncomment `#include snippets/self-signed.conf;` in both nginx config files you created earlier.
- `systemctl restart nginx`