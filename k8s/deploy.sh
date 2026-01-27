#!/bin/bash

# Kubernetes Deployment Script for Video Processing Pipeline
# This script deploys all components in the correct order

set -e

NAMESPACE="video-processing"
TIMEOUT="120s"

echo "======================================"
echo "Video Processing Pipeline Deployment"
echo "======================================"
echo ""

# Function to print section headers
print_section() {
    echo ""
    echo ">>> $1"
    echo "--------------------------------------"
}

# Function to wait for pods
wait_for_pods() {
    local label=$1
    local name=$2
    echo "Waiting for $name to be ready..."
    kubectl wait --for=condition=ready pod -l "$label" -n "$NAMESPACE" --timeout="$TIMEOUT" || {
        echo "Error: Timeout waiting for $name"
        exit 1
    }
    echo "✓ $name is ready"
}

# Function to wait for job completion
wait_for_job() {
    local job=$1
    echo "Waiting for $job to complete..."
    kubectl wait --for=condition=complete "job/$job" -n "$NAMESPACE" --timeout="$TIMEOUT" || {
        echo "Error: Job $job failed or timed out"
        exit 1
    }
    echo "✓ $job completed"
}

# Step 1: Create Namespace
print_section "1. Creating Namespace"
kubectl apply -f namespace.yaml
echo "✓ Namespace created"

# Step 2: Create ConfigMap and Secrets
print_section "2. Creating ConfigMap and Secrets"
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
echo "✓ ConfigMap and Secrets created"

# Step 3: Deploy PostgreSQL
print_section "3. Deploying PostgreSQL"
kubectl apply -f postgres/init-configmap.yaml
kubectl apply -f postgres/pvc.yaml
kubectl apply -f postgres/statefulset.yaml
kubectl apply -f postgres/service.yaml
wait_for_pods "app=postgres" "PostgreSQL"

# Step 4: Deploy MinIO
print_section "4. Deploying MinIO"
kubectl apply -f minio/pvc.yaml
kubectl apply -f minio/statefulset.yaml
kubectl apply -f minio/service.yaml
wait_for_pods "app=minio" "MinIO"

# Step 5: Initialize MinIO Bucket
print_section "5. Initializing MinIO Bucket"
kubectl apply -f minio/init-job.yaml
wait_for_job "minio-init"

# Step 6: Deploy RabbitMQ
print_section "6. Deploying RabbitMQ"
kubectl apply -f rabbitmq/pvc.yaml
kubectl apply -f rabbitmq/statefulset.yaml
kubectl apply -f rabbitmq/service.yaml
wait_for_pods "app=rabbitmq" "RabbitMQ"

# Step 7: Deploy Producer
print_section "7. Deploying Producer (API Service)"
kubectl apply -f producer/deployment.yaml
kubectl apply -f producer/service.yaml
wait_for_pods "app=producer" "Producer"

# Step 8: Deploy Consumer
print_section "8. Deploying Consumer (Worker Service)"
kubectl apply -f consumer/deployment.yaml
kubectl apply -f consumer/hpa.yaml
wait_for_pods "app=consumer" "Consumer"

# Step 9: Deploy Frontend
print_section "9. Deploying Frontend"
kubectl apply -f frontend/deployment.yaml
kubectl apply -f frontend/service.yaml
wait_for_pods "app=frontend" "Frontend"

# Final Status
print_section "Deployment Complete!"
echo ""
echo "All components have been successfully deployed."
echo ""
echo "======================================"
echo "Access Information"
echo "======================================"
echo ""

# Get Node IP (works for most Kubernetes setups)
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')
if [ -z "$NODE_IP" ]; then
    NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
fi

echo "Frontend (Web UI):"
echo "  URL: http://$NODE_IP:30003"
echo ""
echo "Producer API:"
echo "  URL: http://$NODE_IP:30000"
echo ""
echo "MinIO Console:"
echo "  URL: http://$NODE_IP:30001"
echo "  Username: minioadmin"
echo "  Password: minioadmin123"
echo ""
echo "RabbitMQ Management:"
echo "  URL: http://$NODE_IP:30002"
echo "  Username: admin"
echo "  Password: admin"
echo ""

# Display pod status
print_section "Pod Status"
kubectl get pods -n "$NAMESPACE"

echo ""
echo "======================================"
echo "Useful Commands"
echo "======================================"
echo ""
echo "View logs:"
echo "  kubectl logs -f deployment/producer -n $NAMESPACE"
echo "  kubectl logs -f deployment/consumer -n $NAMESPACE"
echo ""
echo "Scale workers:"
echo "  kubectl scale deployment consumer -n $NAMESPACE --replicas=10"
echo ""
echo "Watch pods:"
echo "  kubectl get pods -n $NAMESPACE -w"
echo ""
echo "Delete all resources:"
echo "  kubectl delete namespace $NAMESPACE"
echo ""
