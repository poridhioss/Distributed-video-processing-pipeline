# Kubernetes Deployment Order

Deploy the manifests in this specific order to ensure proper dependency resolution:

## 1. Namespace & Configuration (Required First)
```bash
kubectl apply -f namespace.yaml
kubectl apply -f secret.yaml
kubectl apply -f configmap.yaml
```

## 2. Storage (Required for StatefulSets)
```bash
kubectl apply -f minio/pvc.yaml
kubectl apply -f rabbitmq/pvc.yaml
```

## 3. Stateful Services (Order matters)
```bash
# Deploy MinIO first
kubectl apply -f minio/statefulset.yaml
kubectl apply -f minio/service.yaml

# Wait for MinIO to be ready
kubectl wait --for=condition=ready pod -l app=minio -n video-processing --timeout=300s

# Initialize MinIO bucket
kubectl apply -f minio/init-job.yaml

# Deploy RabbitMQ
kubectl apply -f rabbitmq/statefulset.yaml
kubectl apply -f rabbitmq/service.yaml

# Wait for RabbitMQ to be ready
kubectl wait --for=condition=ready pod -l app=rabbitmq -n video-processing --timeout=300s
```

## 4. Application Services (Can be parallel)
```bash
# Deploy Producer
kubectl apply -f producer/deployment.yaml
kubectl apply -f producer/service.yaml

# Deploy Consumer
kubectl apply -f consumer/deployment.yaml

# Optional: Enable auto-scaling
kubectl apply -f consumer/hpa.yaml
```

## Quick Deploy (All at once)
```bash
# Apply everything in order
kubectl apply -f namespace.yaml
kubectl apply -f secret.yaml
kubectl apply -f configmap.yaml
kubectl apply -f minio/pvc.yaml
kubectl apply -f rabbitmq/pvc.yaml
kubectl apply -f minio/statefulset.yaml
kubectl apply -f minio/service.yaml
kubectl apply -f rabbitmq/statefulset.yaml
kubectl apply -f rabbitmq/service.yaml

# Wait for infrastructure
sleep 30

# Apply application
kubectl apply -f minio/init-job.yaml
kubectl apply -f producer/
kubectl apply -f consumer/
```

## Verification
```bash
# Check all resources
kubectl get all -n video-processing

# Check PVCs
kubectl get pvc -n video-processing

# Check pods status
kubectl get pods -n video-processing -w

# Check services
kubectl get svc -n video-processing
```

## Access Services

### NodePort Access
- **Producer API**: http://<node-ip>:30000
- **MinIO Console**: http://<node-ip>:30001  
  - Username: minioadmin  
  - Password: minioadmin123
- **RabbitMQ Management**: http://<node-ip>:30002  
  - Username: admin  
  - Password: admin

### Port Forwarding (Local Development)
```bash
# Producer API
kubectl port-forward -n video-processing svc/producer-service 4000:4000

# MinIO Console
kubectl port-forward -n video-processing svc/minio-console 9001:9001

# RabbitMQ Management
kubectl port-forward -n video-processing svc/rabbitmq-management-console 15672:15672
```

## Cleanup
```bash
# Delete all resources
kubectl delete namespace video-processing

# Or delete individually
kubectl delete -f consumer/
kubectl delete -f producer/
kubectl delete -f rabbitmq/
kubectl delete -f minio/
kubectl delete -f configmap.yaml
kubectl delete -f secret.yaml
kubectl delete -f namespace.yaml
```
