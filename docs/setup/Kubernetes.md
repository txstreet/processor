# Setting up a Kubernetes Cluster and Load Balancer for the API and Websockets

These instructions are meant for DigitalOcean and DockerHub, but you can use the same steps with some modifications for other cloud providers.

## Setup

1. Create a DockerHub account and purchase the pro plan so you can build at least 2 images simultaneously.
- Link your github account to docker in the account settings.

2. Create the TxStreet API image
- Create a new repository on dockerhub called 'txstreet-api' and set it to Private or Public depending on your preferences.
- Go to the 'build' tab in the repository and find the 'processor' repository from your github account.
- Set 'autotest' to 'off'.
- Set 'repository links' to 'off'.
- In the build rules, enter the name of your branch and for the Dockerfile location, put in '**dockerfile.api**'.
- Enable autobuild if you would like to automatically deploy after each new commit to the branch.
- Enable build caching.
- Skip adding any environment variables, we will do this in the kubernetes cluster on Digital Ocean.
- Click Save and Build, and wait for the build to complete.
- Note the image tag which should look something like `yourusername/txstreet-api:latest`.

2. Create the TxStreet Websocket image
- Create a new repository on dockerhub called 'txstreet-websocket' and set it to Private or Public depending on your preferences.
- Go to the 'build' tab in the repository and find the 'processor' repository from your github account.
- Set 'autotest' to 'off'.
- Set 'repository links' to 'off'.
- In the build rules, enter the name of your branch and for the Dockerfile location, put in '**dockerfile.websocket**'.
- Enable autobuild if you would like to automatically deploy after each new commit to the branch.
- Enable build caching.
- Skip adding any environment variables, we will do this in the kubernetes cluster on Digital Ocean.
- Click Save and Build, and wait for the build to complete.
- Note the image tag which should look something like `yourusername/txstreet-websocket:latest`.

3. Create the Kubernetes Cluster on Digital Ocean
- On the Kubernetes page click Create Cluster.
- Use the same region and datacenter as your other droplets and databases.
- Use the recommended version.
- Set the scaling type to 'Autoscale'.
- Set the machine type to 'Basic Nodes (Premium AMD)'.
- Choose a node plan with at least 2GB of usable RAM per node.
- The minimum and maximum nodes are your own choice, but it is recommended to set the minimum to 2.
- For the name, you can put 'txstreet-k8s', and 'k8s' as a tag.
- **Make sure to add the 'k8s' tag or the kubernetes cluster as a trusted source for your databases.**
- Click 'Create Cluster' and wait for it to finish provisioning.
- Go to the marketplace tab on the kubernetes page, and install 'NGINX Ingress Controller'.
- You should now have a load balancer automatically created for you in digital ocean.

4. Add the load balancer ip to your DNS.
- Go to the load balancer page, find your newly created load balancer, and note the public ip address.
- Go into your domain registrar or cloudflare, and create two new A records both pointing to the IP address, `kapi`, and `ksocket`. You can customize these names as long as you remember to change them in the next steps.
- If you are using cloudflare, do not use the proxy for `ksocket`, just DNS only.

5. Install kubectl and doctl on your local machine.
- https://docs.digitalocean.com/products/kubernetes/how-to/connect-to-cluster/
- https://kubernetes.io/docs/tasks/tools/
- https://github.com/digitalocean/doctl

6. Connect to the cluster.
- Download the cluster config file on your Kubernetes page.
- Run the following command with the page to the config file:
 `kubectl --kubeconfig=/<pathtodirectory>/txstreet-k8s-kubeconfig.yaml get nodes`
- Use this --kubeconifg flag anytime you are using kubectl.

7. Create the kubernetes yaml config files.

- Create a file called `api-deploy.yaml` and add the following contents:
```
apiVersion: v1
kind: Service
metadata:
  name: txstreet-api-service
spec:
  selector:
    app: txstreet-api
  type: ClusterIP
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 8102
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: txstreet-api-deployment
spec: 
  replicas: 2
  selector:
    matchLabels:
      app: txstreet-api
  template:
    metadata:
      labels:
        app: txstreet-api
    spec:
      containers:
        - name: txstreet-api
          image: yourusername/txstreet-api:latest
          imagePullPolicy: Always
          ports:
          - containerPort: 8102
          livenessProbe:
            httpGet:
              path: /healthcheck
              port: 8102
            initialDelaySeconds: 30
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /healthcheck
              port: 8102
            initialDelaySeconds: 60
            periodSeconds: 3
          env:
          - name: MONGODB_DATABASE
            value: "txstreet"
          - name: MONGODB_URI
            value: "mongodb+srv://"
          - name: NODE_ENV
            value: "production"
          - name: REDIS_URI
            value: "rediss://"
          - name: TICKERS
            value: "[\"ETH\", \"LTC\", \"BTC\", \"RINKEBY\", \"BCH\", \"XMR\", \"ARBI\"]"
          - name: UPDATE_DATABASES
            value: "true"
          - name: USE_DATABASE
            value: "true"
          - name: API_PORT
            value: "8102"
      imagePullSecrets:
        - name: regcred
```
- Edit the file to add your image tag, mongo uri, redis uri, and enabled tickers.
- Create a file called `ws-deploy.yaml` and add the following contents:
```
apiVersion: v1
kind: Service
metadata:
  name: txstreet-websocket-service
spec:
  selector:
    app: txstreet-websocket
  type: ClusterIP
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 8101
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: txstreet-websocket-deployment
spec: 
  replicas: 2
  selector:
    matchLabels:
      app: txstreet-websocket
  template:
    metadata:
      labels:
        app: txstreet-websocket
    spec:
      containers:
        - name: txstreet-websocket
          image: yourusername/txstreet-websocket:latest
          imagePullPolicy: Always
          ports:
          - containerPort: 8101
          livenessProbe:
            httpGet:
              path: /healthcheck
              port: 8101
            initialDelaySeconds: 30
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /healthcheck
              port: 8101
            initialDelaySeconds: 60
            periodSeconds: 3
          env:
          - name: MONGODB_DATABASE
            value: "txstreet"
          - name: MONGODB_URI
            value: "mongodb+srv://"
          - name: NODE_ENV
            value: "production"
          - name: REDIS_URI
            value: "rediss://"
          - name: TICKERS
            value: "[\"ETH\", \"LTC\", \"BTC\", \"RINKEBY\", \"BCH\", \"XMR\", \"ARBI\"]"
          - name: UPDATE_DATABASES
            value: "true"
          - name: USE_DATABASE
            value: "true"
          - name: WEBSOCKET_PORT
            value: "8101"
      imagePullSecrets:
        - name: regcred
```
- Edit the file to add your image tag, mongo uri, redis uri, and enabled tickers.
- Create a file called `certificate.yaml` and add the following contents:
```
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: txstreet-api-cert
  namespace: default
spec:
  dnsNames:
    - kapi.yourdomain.com
  secretName: txstreet-api-tls
  issuerRef:
    name: letsencrypt-cluster-issuer
    kind: ClusterIssuer
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: txstreet-websocket-cert
  namespace: default
spec:
  dnsNames:
    - kwebsocket.yourdomain.com
  secretName: txstreet-websocket-tls
  issuerRef:
    name: letsencrypt-cluster-issuer
    kind: ClusterIssuer
```
- Edit the file to add your domain.
- Create a file called `issuer.yaml` and add the following:
```
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-cluster-issuer
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: my@email.address
    privateKeySecretRef:
      name: letsencrypt-cluster-issuer-key
    solvers:
    - http01:
       ingress:
         class: nginx
```
- Edit the file to add your email address.
- Create a file called `ingress.yaml` and add the following:
```
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: "nginx"
  name: txstreet-api-ingress
spec:
  tls:
  - hosts:
    - kapi.yourdomain.com
    secretName: txstreet-api-tls
  rules:
  - host: kapi.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service: 
            name: txstreet-api-service
            port: 
              number: 8102
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: "nginx"
  name: txstreet-websocket-ingress
spec:
  tls:
  - hosts:
    - kwebsocket.yourdomain.com
    secretName: txstreet-websocket-tls
  rules:
  - host: kwebsocket.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service: 
            name: txstreet-websocket-service
            port: 
              number: 8101
```

8. Create a dockerhub secret.

- Use the following command and replace your username, password and email. Remember to add the --kubeconfig flag.
```
kubectl create secret docker-registry regcred \
  --docker-server=docker.io \
  --docker-username=$DOCKER_USER \
  --docker-password=$DOCKER_PASSWORD \
  --docker-email=$DOCKER_EMAIL
```
- It should return 'secret/regcred created'.

9. Install cert-manager. Remember to add the --kubeconfig flag to all kubectl commands.
- `kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml` (make sure it's the latest version of v1)
- The above command should return a long list of created stuff in kubernetes.

10. Deploy the files. Remember to add the --kubeconfig flag to all kubectl commands.
- `cd` into the directory with the saved yaml files.
- `kubectl apply -f api-deploy.yaml`
- The above command should return: 
'service/txstreet-api-service created
deployment.apps/txstreet-api-deployment created'
- `kubectl apply -f ws-deploy.yaml`
- The above command should return: 
'service/txstreet-websocket-service created
deployment.apps/txstreet-websocket-deployment created'
- `kubectl apply -f issuer.yaml`
- The above command should return: 
'clusterissuer.cert-manager.io/letsencrypt-cluster-issuer created'
- `kubectl apply -f certificate.yaml`
- The above command should return: 
'certificate.cert-manager.io/txstreet-api-cert created
certificate.cert-manager.io/txstreet-websocket-cert created'
- `kubectl apply -f ingress.yaml`
- The above command should return: 
'ingress.networking.k8s.io/txstreet-api-ingress created
ingress.networking.k8s.io/txstreet-websocket-ingress created'

## Notes

- After the setup, if everything is running smoothly, the api and websocket services will automatically scale to add more machines when traffic loads increase.
- If you need to make changes to any of the yaml files, using the same `apply` commands will overwrite the old deployments and automatically handle creating new pods.