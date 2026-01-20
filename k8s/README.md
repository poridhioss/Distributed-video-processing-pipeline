# Kubernetes Manifests - Distributed Video Processing Pipeline

Production-ready Kubernetes deployment configuration for the distributed video processing system.

## 📁 Structure

```
k8s/
├── namespace.yaml              # Namespace definition
├── configmap.yaml              # Application configuration
├── secret.yaml                 # Sensitive credentials
├── DEPLOY.md                   # Deployment instructions
├── README.md                   # This file
├── minio/                      # MinIO object storage
│   ├── statefulset.yaml        # MinIO StatefulSet
│   ├── service.yaml            # API + Console services
│   ├── pvc.yaml                # Persistent volume (10Gi)
│   └── init-job.yaml           # Bucket initialization
├── rabbitmq/                   # RabbitMQ message broker
│   ├── statefulset.yaml        # RabbitMQ StatefulSet
│   ├── service.yaml            # AMQP + Management services
│   └── pvc.yaml                # Persistent volume (5Gi)
├── producer/                   # Video upload service
│   ├── deployment.yaml         # 2 replicas with init containers
│   └── service.yaml            # NodePort service (30000)
└── consumer/                   # Video processing workers
    ├── deployment.yaml         # 5 replicas with init containers
    └── hpa.yaml                # Auto-scaling (3-10 replicas)
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    video-processing                     │
│                       Namespace                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐ │
│  │   Producer   │───▶│   RabbitMQ   │───▶│ Consumer │ │
│  │  (2 replicas)│    │ (StatefulSet)│    │(3-10 HPA)│ │
│  └──────────────┘    └──────────────┘    └──────────┘ │
│         │                                       │       │
│         └───────────────┬──────────────────────┘       │
│                         ▼                               │
│                  ┌──────────────┐                      │
│                  │    MinIO     │                      │
│                  │ (StatefulSet)│                      │
│                  └──────────────┘                      │
│                                                         │
│  External Access (NodePort):                           │
│  • Producer API:        30000                          │
│  • MinIO Console:       30001                          │
│  • RabbitMQ Management: 30002                          │
└─────────────────────────────────────────────────────────┘
```

## ⚙️ Component Details

### **MinIO (Object Storage)**
- **Type**: StatefulSet (1 replica)
- **Storage**: 10Gi PVC
- **Ports**:
  - API: 9000 (ClusterIP: `minio-service`)
  - Console: 9001 (NodePort: 30001)
- **Resources**: 512Mi-2Gi RAM, 500m-2000m CPU
- **Init Job**: Automatically creates `videos` bucket

### **RabbitMQ (Message Broker)**
- **Type**: StatefulSet (1 replica)
- **Storage**: 5Gi PVC
- **Ports**:
  - AMQP: 5672 (ClusterIP: `rabbitmq-service`)
  - Management: 15672 (NodePort: 30002)
- **Resources**: 512Mi-2Gi RAM, 500m-1000m CPU
- **Credentials**: admin/admin (change in production!)

### **Producer (Upload Service)**
- **Type**: Deployment (2 replicas)
- **Image**: `konami98/producer:v1.0.0`
- **Port**: 4000 (NodePort: 30000)
- **Resources**: 256Mi-1Gi RAM, 250m-1000m CPU
- **Init Containers**: Wait for MinIO + RabbitMQ
- **Health Checks**: Liveness + Readiness probes on `/health`

### **Consumer (Processing Workers)**
- **Type**: Deployment (5 initial replicas)
- **Image**: `konami98/consumer:v1.0.0`
- **Resources**: 1Gi-2Gi RAM, 1000m-2000m CPU
- **Init Containers**: Wait for MinIO + RabbitMQ
- **Auto-scaling**: HPA 3-10 replicas @ 70% CPU

## 🚀 Quick Start

### Prerequisites
- Kubernetes cluster (v1.19+)
- kubectl configured
- StorageClass available
- Docker images pushed to registry

### Deploy
```bash
# Navigate to k8s directory
cd k8s

# Deploy all resources
kubectl apply -f namespace.yaml
kubectl apply -f secret.yaml
kubectl apply -f configmap.yaml
kubectl apply -f minio/
kubectl apply -f rabbitmq/
sleep 30  # Wait for infrastructure
kubectl apply -f producer/
kubectl apply -f consumer/

# Check status
kubectl get all -n video-processing
```

For detailed deployment instructions, see [DEPLOY.md](DEPLOY.md)

## 🔍 Monitoring

### Check Pod Status
```bash
kubectl get pods -n video-processing
kubectl describe pod <pod-name> -n video-processing
```

### View Logs
```bash
# Producer logs
kubectl logs -l app=producer -n video-processing --tail=100 -f

# Consumer logs
kubectl logs -l app=consumer -n video-processing --tail=100 -f

# MinIO logs
kubectl logs -l app=minio -n video-processing

# RabbitMQ logs
kubectl logs -l app=rabbitmq -n video-processing
```

### Resource Usage
```bash
kubectl top pods -n video-processing
kubectl top nodes
```

## 📊 Scaling

### Manual Scaling
```bash
# Scale producer
kubectl scale deployment producer -n video-processing --replicas=5

# Scale consumer
kubectl scale deployment consumer -n video-processing --replicas=10
```

### Auto-scaling (HPA)
Consumer auto-scaling is already configured in [consumer/hpa.yaml](consumer/hpa.yaml):
- Min: 3 replicas
- Max: 10 replicas
- Target: 70% CPU utilization

Check HPA status:
```bash
kubectl get hpa -n video-processing
kubectl describe hpa consumer-hpa -n video-processing
```

## 🌐 Access Services

### Get Node IP
```bash
kubectl get nodes -o wide
```

### Access URLs
- **Producer API**: `http://<node-ip>:30000`
- **MinIO Console**: `http://<node-ip>:30001`
- **RabbitMQ Management**: `http://<node-ip>:30002`

### Test Upload
```bash
curl -X POST http://<node-ip>:30000/api/upload \
  -F "video=@/path/to/video.mp4"
```

## 🔧 Configuration

### Update Secrets
Edit [secret.yaml](secret.yaml) to change credentials:
```yaml
stringData:
  MINIO_ACCESS_KEY: "your-access-key"
  MINIO_SECRET_KEY: "your-secret-key"
  RABBITMQ_DEFAULT_USER: "your-username"
  RABBITMQ_DEFAULT_PASS: "your-password"
```

Then apply:
```bash
kubectl apply -f secret.yaml
kubectl rollout restart deployment producer -n video-processing
kubectl rollout restart deployment consumer -n video-processing
```

### Update ConfigMap
Edit [configmap.yaml](configmap.yaml) and apply:
```bash
kubectl apply -f configmap.yaml
kubectl rollout restart deployment producer -n video-processing
kubectl rollout restart deployment consumer -n video-processing
```

## 🐛 Troubleshooting

### Pods Not Starting
```bash
# Check pod events
kubectl describe pod <pod-name> -n video-processing

# Check logs
kubectl logs <pod-name> -n video-processing

# Check init containers
kubectl logs <pod-name> -n video-processing -c wait-for-minio
kubectl logs <pod-name> -n video-processing -c wait-for-rabbitmq
```

### Storage Issues
```bash
# Check PVC status
kubectl get pvc -n video-processing

# Check PV
kubectl get pv

# Describe PVC
kubectl describe pvc minio-pvc -n video-processing
kubectl describe pvc rabbitmq-pvc -n video-processing
```

### Network Issues
```bash
# Test DNS
kubectl run -it --rm debug --image=busybox -n video-processing -- nslookup minio-service

# Test connectivity
kubectl run -it --rm debug --image=busybox -n video-processing -- nc -zv minio-service 9000
kubectl run -it --rm debug --image=busybox -n video-processing -- nc -zv rabbitmq-service 5672
```

### Common Issues

| Issue | Solution |
|-------|----------|
| ImagePullBackOff | Check image name and registry access |
| CrashLoopBackOff | Check logs: `kubectl logs <pod> -n video-processing` |
| Pending PVC | Check storage class: `kubectl get sc` |
| Init containers stuck | Check if MinIO/RabbitMQ services are ready |

## 🗑️ Cleanup

```bash
# Delete namespace (removes everything)
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

## 📝 Environment Variables

All configuration is managed through:
- **ConfigMap** ([configmap.yaml](configmap.yaml)) - Non-sensitive config
- **Secret** ([secret.yaml](secret.yaml)) - Credentials

| Variable | Source | Description |
|----------|--------|-------------|
| MINIO_ENDPOINT | ConfigMap | MinIO service hostname |
| MINIO_PORT | ConfigMap | MinIO API port |
| MINIO_ACCESS_KEY | Secret | MinIO access key |
| MINIO_SECRET_KEY | Secret | MinIO secret key |
| MINIO_BUCKET | ConfigMap | Bucket name (videos) |
| RABBITMQ_URL | ConfigMap | RabbitMQ connection URL |
| RABBITMQ_QUEUE | ConfigMap | Queue name |
| MAX_FILE_SIZE | ConfigMap | Max upload size |
| ALLOWED_MIME_TYPES | ConfigMap | Allowed video types |

## 🔒 Security Notes

**⚠️ Before Production:**
1. Change default credentials in [secret.yaml](secret.yaml)
2. Use proper secret management (Sealed Secrets, External Secrets)
3. Enable RBAC and network policies
4. Set resource quotas
5. Scan images for vulnerabilities
6. Enable TLS for external services

## 📈 Production Considerations

- **High Availability**: Increase StatefulSet replicas for MinIO/RabbitMQ
- **Storage**: Use distributed storage (Ceph, GlusterFS, or cloud provider)
- **Monitoring**: Deploy Prometheus + Grafana
- **Logging**: Set up ELK/EFK stack
- **Ingress**: Use Ingress controller instead of NodePort
- **Backups**: Configure automated backups for PVCs
- **CI/CD**: Implement GitOps with ArgoCD/Flux

## 📚 Additional Resources

- [Deployment Guide](DEPLOY.md) - Detailed step-by-step instructions
- [Main README](../README.md) - Project documentation
- [Kubernetes Docs](https://kubernetes.io/docs/)
- [StatefulSet Best Practices](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)

## 🤝 Support

For issues or questions:
1. Check logs: `kubectl logs <pod-name> -n video-processing`
2. Review events: `kubectl get events -n video-processing --sort-by='.lastTimestamp'`
3. Refer to troubleshooting section above
